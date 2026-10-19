import { readFile, readdir, mkdir, copyFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const compactSource = text => text.normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "");
const nonempty = text => typeof text === "string" && text.trim().length > 0;
const safeName = text => nonempty(text) && path.basename(text) === text && !/[\\/]/.test(text) && ![".",".."].includes(text);
function sharesPage(reference, pages) {
  return [...(reference??"").matchAll(/\bpp?\.\s*(\d+(?:\s*[-–—]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–—]\s*\d+)?)*)/gi)].some(match=>match[1].split(",").some(part=>{
    const range=part.split(/[-–—]/).map(Number),start=range[0],end=range.at(-1);
    return pages.some(page=>page>=start&&page<=end);
  }));
}

/** Add reviewed turns without deleting old practice, illustrations or progress IDs.
 * Literal evidence is a guard, not a substitute for the reviewer's PDF inspection. */
export function mergeReviewedDialogues(course, review, sourcePages) {
  if (review.version !== 1 || review.courseId !== course.id || review.fileName !== course.source.fileName || !nonempty(review.method) || !nonempty(review.reviewedBy) || !Array.isArray(review.lessons) || !review.lessons.length) throw Error("Reviewed source identity/method missing");
  const result = structuredClone(course), seenLessons = new Set();
  for (const draft of review.lessons) {
    const lesson = result.lessons.find(item=>item.id===draft.id);
    if (!lesson || seenLessons.has(draft.id) || !Array.isArray(draft.dialogues) || !draft.dialogues.length) throw Error("Missing/duplicate/empty reviewed lesson");
    seenLessons.add(draft.id);
    const merged = new Map((lesson.dialogues ?? []).map(item=>[item.id,item]));
    for (const id of draft.derivedIds ?? []) {
      const previous = merged.get(id);
      if (!previous) throw Error("Cannot relabel a missing dialogue");
      merged.set(id,{...previous,origin:"derived",sourceRef:"Biên soạn bổ trợ; tham khảo chủ đề " + (lesson.sourceRef ?? review.fileName)});
    }
    const seen = new Set();
    for (const dialogue of draft.dialogues) {
      if (!nonempty(dialogue.id) || seen.has(dialogue.id) || !nonempty(dialogue.title) || dialogue.origin!=="source" || !["source","derived"].includes(dialogue.translationOrigin) || !Array.isArray(dialogue.pages) || !dialogue.pages.length || dialogue.pages.some(n=>!Number.isSafeInteger(n)||n<1||n>course.source.pageCount) || !Array.isArray(dialogue.lines) || !dialogue.lines.length) throw Error("Invalid reviewed dialogue");
      seen.add(dialogue.id);
      const evidence = dialogue.pages.map(n=>sourcePages.get(n));
      if (evidence.some(text=>!nonempty(text))) throw Error("Missing source page evidence");
      const searchable = evidence.map(compactSource);
      for (const line of dialogue.lines) {
        if (!nonempty(line.ko) || !nonempty(line.speaker) || (line.vi!==undefined&&!nonempty(line.vi)) || !searchable.some(text=>text.includes(compactSource(line.ko)))) throw Error("A reviewed turn does not occur on its cited source page");
      }
      const signature = dialogue.lines.map(line=>compactSource(line.ko)).join("|");
      if([...merged.values()].some(item=>item.id!==dialogue.id&&item.origin!=="derived"&&sharesPage(item.sourceRef,dialogue.pages)&&item.lines.map(line=>compactSource(line.targetText||line.ko)).join("|")===signature)) throw Error("Identical dialogue already exists on the cited page; retain its ID instead of adding a duplicate");
      const {pages,...fields} = dialogue;
      merged.set(dialogue.id,{...merged.get(dialogue.id),...fields,lines:dialogue.lines.map(line=>({...line,targetText:line.ko,learnerMeaning:line.vi})),sourceRef:review.fileName+" · "+pages.map(n=>"p."+n).join(", ")});
    }
    // Keep existing order: legacy drill IDs include collection positions.
    lesson.dialogues = [...merged.values()];
    lesson.sourceRecovery = {...lesson.sourceRecovery,status:"partial",independentlyVerified:false,dialogueReview:{method:review.method,reviewedBy:review.reviewedBy,sourcePages:[...new Set(draft.dialogues.flatMap(item=>item.pages))],reviewedDialogues:draft.dialogues.length,reviewedTurns:draft.dialogues.reduce((n,d)=>n+d.lines.length,0)}};
    delete lesson.quality;
  }
  const ids = result.lessons.flatMap(lesson=>(lesson.dialogues??[]).map(item=>item.id));
  if (new Set(ids).size!==ids.length) throw Error("Duplicate dialogue ID across course");
  return result;
}

async function main(args) {
  const option = name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
  if (!option("--data-dir") || !option("--review")) throw Error("Use --data-dir DIR --review FILE [--apply]");
  const root=path.resolve(option("--data-dir")), review=JSON.parse(await readFile(option("--review"),"utf8"));
  if(!safeName(review.courseId)||!safeName(review.fileName))throw Error("Invalid source path");
  const file=path.join(root,"courses",review.courseId+".json"),course=JSON.parse(await readFile(file,"utf8"));
  const sha=createHash("sha256").update(await readFile(path.join(root,"originals",review.fileName))).digest("hex");
  if(sha!==review.originalSha256)throw Error("Original PDF checksum mismatch");
  if(!safeName(course.source.importJobId))throw Error("Invalid import job path");
  const pages=new Map();
  for(const n of new Set(review.lessons.flatMap(lesson=>lesson.dialogues.flatMap(item=>item.pages)))){
    if(!Number.isSafeInteger(n)||n<1||n>course.source.pageCount)throw Error("Invalid source page");
    const page=JSON.parse(await readFile(path.join(root,"recovered-source",course.source.importJobId,String(n).padStart(5,"0")+".json"),"utf8"));
    if(page.sourceSha256!==sha||page.fileName!==review.fileName||page.pageNumber!==n)throw Error("Source page identity mismatch");
    pages.set(n,page.text);
  }
  const revised=mergeReviewedDialogues(course,review,pages),mutations=[{file,value:revised}];
  const jobFile=path.join(root,"import-jobs",course.source.importJobId,"job.json"),job=JSON.parse(await readFile(jobFile,"utf8"));
  if(job.id!==course.source.importJobId)throw Error("Import job identity mismatch");
  if(job.resultBundle){
    if(!Array.isArray(job.resultBundle.course?.lessons)||(job.resultBundle.course.id&&job.resultBundle.course.id!==course.id))throw Error("Import result does not match course");
    job.resultBundle.course.lessons=revised.lessons;
    mutations.push({file:jobFile,value:job});
  }
  // Some local libraries also store the selected course's entire bundle.
  if((await readdir(root)).includes("active-course.json")){
    const activeFile=path.join(root,"active-course.json"),active=JSON.parse(await readFile(activeFile,"utf8"));
    if(active.id===course.id)mutations.push({file:activeFile,value:revised});
  }
  let backup;
  if(args.includes("--apply")){
    backup=path.join(root,"review","before-reviewed-dialogues-"+new Date().toISOString().replaceAll(":","-"));
    for(const mutation of mutations){const target=path.join(backup,path.relative(root,mutation.file));await mkdir(path.dirname(target),{recursive:true});await copyFile(mutation.file,target);}
    for(const mutation of mutations){const temp=mutation.file+".dialogues.tmp";await writeFile(temp,JSON.stringify(mutation.value,null,2));await rename(temp,mutation.file);}
  }
  console.log(JSON.stringify({applied:args.includes("--apply"),courseId:course.id,lessons:review.lessons.length,reviewedDialogues:review.lessons.reduce((n,l)=>n+l.dialogues.length,0),reviewedTurns:review.lessons.reduce((n,l)=>n+l.dialogues.reduce((m,d)=>m+d.lines.length,0),0),status:"partial",backup}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
