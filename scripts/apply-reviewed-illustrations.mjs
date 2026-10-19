import { readFile, readdir, mkdir, writeFile, copyFile, rename } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
const args=process.argv.slice(2), flag=name=>args[args.indexOf(name)+1];
if(!args.includes("--data-dir")||!args.includes("--review"))throw Error("Use --data-dir PATH --review reviewed.json [--apply]. The review must explicitly list approved image IDs.");
const root=path.resolve(flag("--data-dir")), review=JSON.parse(await readFile(flag("--review"),"utf8"));
if(review.version!==1||!Array.isArray(review.courses)||!Array.isArray(review.approvedIds)||!review.reviewedBy)throw Error("A reviewed candidate manifest with approvedIds and reviewedBy is required");
const approved=new Set(review.approvedIds), mutations=[],rows=[];
const digest=bytes=>createHash("sha256").update(bytes).digest("hex");
const strip=course=>({...course,lessons:course.lessons.map(({illustrations:_,...lesson})=>lesson)});
for(const filename of await readdir(path.join(root,"courses"))){
 if(!filename.endsWith(".json"))continue;
 const file=path.join(root,"courses",filename),course=JSON.parse(await readFile(file,"utf8"));
 const plan=review.courses.find(item=>item.courseId===course.id);if(!plan)continue;
 if(digest(await readFile(path.join(root,"originals",course.source.fileName)))!==plan.sourceSha256)throw Error("Original changed: "+course.id);
 const jobFile=path.join(root,"import-jobs",course.source.importJobId,"job.json"),job=JSON.parse(await readFile(jobFile,"utf8"));
 const seen=new Set();
 const lessons=course.lessons.map(lesson=>{
  const draft=plan.lessons.find(item=>item.id===lesson.id);if(!draft)throw Error("Missing lesson "+lesson.id);
  const images=draft.illustrations.filter(image=>approved.has(image.id));
  for(const image of images){
   if(!image || !["vocabulary","grammar","dialogue","context"].includes(image.kind)||!["exact","context"].includes(image.relation)||!Array.isArray(image.targetIds)||!image.targetIds.every(id=>typeof id==="string"&&id.trim())||!["id","alt","sourceRef"].every(key=>typeof image[key]==="string"&&image[key].trim())||typeof image.caption!=="string"||!Array.isArray(image.region)||image.region.length!==4)throw Error("Malformed illustration metadata");
   const doc=job.documents.find(doc=>doc.fileName===image.fileName),[x,y,w,h]=image.region;
   if(seen.has(image.id)||!doc||!Number.isSafeInteger(image.pageNumber)||image.pageNumber<1||image.pageNumber>doc.pageCount||!image.region.every(Number.isFinite)||x<0||y<0||x>=1||y>=1||w<=0||h<=0||x+w>1.000001||y+h>1.000001||w*h>=.8)throw Error("Invalid crop "+image.id);
   if(image.kind!=="context"&&!image.targetIds.length)throw Error("Missing target "+image.id);
   const collection=image.kind==='vocabulary'?lesson.vocabulary:image.kind==='grammar'?lesson.grammar:image.kind==='dialogue'?(lesson.dialogues??[]):[];
   if(image.targetIds.some(id=>!collection.some(item=>item.id===id)))throw Error("Unknown target "+image.id);
   if(image.relation==='exact'&&(image.kind!=='vocabulary'||image.targetIds.length!==1))throw Error("Ambiguous exact image "+image.id);
   seen.add(image.id);
  }
  // An approved update adds/replaces selected IDs; it never drops old assets.
  const merged=new Map((lesson.illustrations??[]).map(image=>[image.id,image]));for(const image of images)merged.set(image.id,image);
  return {...lesson,illustrations:[...merged.values()]};
 });
 const updated={...course,lessons};if(!isDeepStrictEqual(strip(course),strip(updated)))throw Error("Non-illustration curriculum changed");
 mutations.push({file,updated});
 if(job.resultBundle?.course?.lessons){
  const revised=structuredClone(job);revised.resultBundle.course.lessons=revised.resultBundle.course.lessons.map(lesson=>({...lesson,illustrations:lessons.find(item=>item.id===lesson.id)?.illustrations??lesson.illustrations??[]}));
  mutations.push({file:jobFile,updated:revised});
 }
 rows.push({courseId:course.id,lessons:lessons.length,images:lessons.reduce((n,l)=>n+l.illustrations.length,0),exact:lessons.flatMap(l=>l.illustrations).filter(i=>i.relation==='exact').length,withoutSourceImages:lessons.filter(l=>!l.illustrations.length).map(l=>l.id)});
}
if(args.includes("--apply")){
 const backup=path.join(root,"review","before-inline-illustrations-"+new Date().toISOString().replaceAll(":","-"));
 for(const mutation of mutations){const target=path.join(backup,path.relative(root,mutation.file));await mkdir(path.dirname(target),{recursive:true});await copyFile(mutation.file,target);}
 for(const mutation of mutations){const temp=mutation.file+".illustrations.tmp";await writeFile(temp,JSON.stringify(mutation.updated,null,2));await rename(temp,mutation.file);}
 await writeFile(path.join(backup,"audit.json"),JSON.stringify({reviewedBy:review.reviewedBy,rows},null,2));console.log("Backup: "+backup);
}
console.log(JSON.stringify({applied:args.includes("--apply"),rows}));
