import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const script=path.resolve("scripts/apply-reviewed-illustrations.mjs");
async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),"haneul-figures-"));
 for(const dir of ["courses","originals","import-jobs/import-12345678"])await mkdir(path.join(root,dir),{recursive:true});
 const course={id:"course-test",source:{importJobId:"import-12345678",fileName:"book.pdf"},lessons:[{id:1,vocabulary:[{id:"w",ko:"word"}],grammar:[],explanation:"Preserve source"}],questions:[{id:"q",answer:"Preserve question"}]};
 const image={id:"f",kind:"vocabulary",targetIds:["w"],relation:"exact",fileName:"book.pdf",pageNumber:1,region:[.1,.2,.3,.4],alt:"word",caption:"",sourceRef:"book.pdf p.1"};
 const review={version:1,reviewedBy:"Synthetic test",approvedIds:["f"],courses:[{courseId:course.id,sourceSha256:createHash("sha256").update("original bytes").digest("hex"),lessons:[{id:1,illustrations:[image]}]}]};
 await writeFile(path.join(root,"courses/course.json"),JSON.stringify(course));await writeFile(path.join(root,"originals/book.pdf"),"original bytes");
 await writeFile(path.join(root,"import-jobs/import-12345678/job.json"),JSON.stringify({documents:[{fileName:"book.pdf",pageCount:2}],resultBundle:{course:{lessons:course.lessons}}}));
 await writeFile(path.join(root,"review.json"),JSON.stringify(review));await writeFile(path.join(root,"learner-progress.json"),"untouched");
 return {root,review,course};
}
test("dry-run leaves data unchanged and approved apply keeps all curriculum plus a backup",async()=>{
 const {root,course}=await fixture();try{
  const run=apply=>spawnSync(process.execPath,[script,"--data-dir",root,"--review",path.join(root,"review.json"),...(apply?["--apply"]:[])],{encoding:"utf8"});
  assert.equal(run(false).status,0);assert.deepEqual(JSON.parse(await readFile(path.join(root,"courses/course.json"))),course);
  const result=run(true);assert.equal(result.status,0,result.stderr);
  const updated=JSON.parse(await readFile(path.join(root,"courses/course.json")));assert.equal(updated.lessons[0].illustrations.length,1);delete updated.lessons[0].illustrations;assert.deepEqual(updated,course);
  assert.equal(await readFile(path.join(root,"learner-progress.json"),"utf8"),"untouched");assert.equal((await readdir(path.join(root,"review"))).length,1);
  assert.equal(JSON.parse(await readFile(path.join(root,"import-jobs/import-12345678/job.json"))).resultBundle.course.lessons[0].illustrations[0].id,"f");
 }finally{await rm(root,{recursive:true,force:true});}
});
test("invalid target or changed original prevents any writes",async()=>{
 const {root,review}=await fixture();try{
  const before=await readFile(path.join(root,"courses/course.json"),"utf8");review.courses[0].lessons[0].illustrations[0].targetIds=["unknown"];
  await writeFile(path.join(root,"review.json"),JSON.stringify(review));
  const result=spawnSync(process.execPath,[script,"--data-dir",root,"--review",path.join(root,"review.json"),"--apply"],{encoding:"utf8"});
  assert.notEqual(result.status,0);assert.equal(await readFile(path.join(root,"courses/course.json"),"utf8"),before);
  await writeFile(path.join(root,"originals/book.pdf"),"changed");
  const altered=spawnSync(process.execPath,[script,"--data-dir",root,"--review",path.join(root,"review.json"),"--apply"],{encoding:"utf8"});assert.match(altered.stderr,/Original changed/);
 }finally{await rm(root,{recursive:true,force:true});}
});
