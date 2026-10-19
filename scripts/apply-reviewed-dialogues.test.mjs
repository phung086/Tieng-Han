import test from "node:test";
import assert from "node:assert/strict";
import { mergeReviewedDialogues } from "./apply-reviewed-dialogues.mjs";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const course={id:"test",source:{fileName:"book.pdf",pageCount:2},questions:[{id:"keep"}],lessons:[{id:1,sourceRef:"book.pdf pp.1-2",vocabulary:[{id:"v"}],grammar:[],illustrations:[{id:"picture"}],dialogues:[{id:"old",lines:[{speaker:"A",ko:"old"}],sourceRef:"wrong"}]}]};
const review={version:1,courseId:"test",fileName:"book.pdf",method:"Manual inspection",reviewedBy:"reviewer",lessons:[{id:1,derivedIds:["old"],dialogues:[{id:"verified",title:"Model",origin:"source",translationOrigin:"derived",pages:[1],lines:[{speaker:"A",ko:"학교에 가요.",vi:"Đi đến trường."}]}]}]};
const evidence=new Map([[1,"A 학교에\n가요."]]);
test("adds every turn, retains legacy material and IDs, labels added translation, is idempotent",()=>{
 const updated=mergeReviewedDialogues(course,review,evidence);
 assert.equal(updated.lessons[0].dialogues.length,2);
 assert.equal(updated.lessons[0].dialogues[0].id,"old");
 assert.equal(updated.lessons[0].dialogues[0].origin,"derived");
 assert.match(updated.lessons[0].dialogues[0].sourceRef,/Biên soạn bổ trợ/);
 assert.equal(updated.lessons[0].dialogues[1].translationOrigin,"derived");
 assert.deepEqual(updated.questions,course.questions);
 assert.deepEqual(updated.lessons[0].vocabulary,course.lessons[0].vocabulary);
 assert.deepEqual(updated.lessons[0].illustrations,course.lessons[0].illustrations);
 assert.deepEqual(mergeReviewedDialogues(updated,review,evidence),updated);
 assert.equal(course.lessons[0].dialogues[0].sourceRef,"wrong");
});
test("rejects unsupported turns, wrong identities and missing or out-of-range source pages",()=>{
 for(const mutate of [r=>r.fileName="other.pdf",r=>r.lessons[0].dialogues[0].lines[0].ko="없어요",r=>r.lessons[0].dialogues[0].pages=[3],r=>r.lessons[0].dialogues[0].pages=[2],r=>r.lessons[0].derivedIds=["missing"],r=>r.lessons[0].dialogues[0].translationOrigin="invented"]){const invalid=structuredClone(review);mutate(invalid);assert.throws(()=>mergeReviewedDialogues(course,invalid,evidence));}
 assert.equal(course.lessons[0].dialogues.length,1);
});
test("rejects a duplicate model so a review must retain the existing stable ID",()=>{
 const duplicate=structuredClone(course);duplicate.lessons[0].dialogues[0].sourceRef="book.pdf p.1";duplicate.lessons[0].dialogues[0].lines=[{speaker:"A",ko:"학교에 가요."}];
 const input=structuredClone(review);input.lessons[0].derivedIds=[];
 assert.throws(()=>mergeReviewedDialogues(duplicate,input,evidence),/retain its ID/);
});
test("retains repeated source models on different pages as distinct source occurrences",()=>{
 const repeated=structuredClone(course);repeated.lessons[0].dialogues[0].sourceRef="book.pdf p.2";repeated.lessons[0].dialogues[0].lines=[{speaker:"A",ko:"학교에 가요."}];
 const input=structuredClone(review);input.lessons[0].derivedIds=[];
 assert.equal(mergeReviewedDialogues(repeated,input,evidence).lessons[0].dialogues.length,2);
});
test("CLI checks evidence before writes, backs up course/job/selection and never alters learner state",async t=>{
 const root=await mkdtemp(path.join(tmpdir(),"haneul-dialogue-review-"));
 t.after(()=>rm(root,{recursive:true,force:true}));
 for(const dir of ["courses","originals","recovered-source/job-test","import-jobs/job-test"])await mkdir(path.join(root,dir),{recursive:true});
 const bytes=Buffer.from("synthetic PDF fixture"),sha=createHash("sha256").update(bytes).digest("hex");
 const initial=structuredClone(course);initial.source.importJobId="job-test";
 const job={id:"job-test",resultBundle:{course:initial}};
 const files={"courses/test.json":initial,"active-course.json":initial,"import-jobs/job-test/job.json":job,"progress.json":{unchanged:true}};
 for(const [name,value] of Object.entries(files))await writeFile(path.join(root,name),JSON.stringify(value));
 await writeFile(path.join(root,"originals/book.pdf"),bytes);
 await writeFile(path.join(root,"recovered-source/job-test/00001.json"),JSON.stringify({fileName:"book.pdf",pageNumber:1,sourceSha256:sha,text:"학교에 가요."}));
 const reviewPath=path.join(root,"review.json"),input={...review,originalSha256:sha};
 const run=(...flags)=>execFileSync(process.execPath,["scripts/apply-reviewed-dialogues.mjs","--data-dir",root,"--review",reviewPath,...flags],{encoding:"utf8"});
 await writeFile(reviewPath,JSON.stringify({...input,originalSha256:"wrong"}));
 assert.throws(()=>run("--apply"));
 assert.deepEqual(JSON.parse(await readFile(path.join(root,"courses/test.json"),"utf8")),initial);
 assert.equal((await readdir(root)).includes("review"),false);
 await writeFile(reviewPath,JSON.stringify(input));
 assert.equal(JSON.parse(run()).applied,false);
 const applied=JSON.parse(run("--apply"));
 assert.deepEqual(JSON.parse(await readFile(path.join(applied.backup,"courses/test.json"),"utf8")),initial);
 const updated=JSON.parse(await readFile(path.join(root,"courses/test.json"),"utf8"));
 assert.deepEqual(JSON.parse(await readFile(path.join(root,"active-course.json"),"utf8")),updated);
 const updatedJob=JSON.parse(await readFile(path.join(root,"import-jobs/job-test/job.json"),"utf8"));
 assert.deepEqual(updatedJob.resultBundle.course.lessons,updated.lessons);
 assert.equal(await readFile(path.join(root,"progress.json"),"utf8"),JSON.stringify(files["progress.json"]));
 await writeFile(path.join(root,"import-jobs/job-test/job.json"),JSON.stringify({id:"job-test",status:"recovered"}));
 run("--apply");
 assert.deepEqual(JSON.parse(await readFile(path.join(root,"import-jobs/job-test/job.json"),"utf8")),{id:"job-test",status:"recovered"});
});
