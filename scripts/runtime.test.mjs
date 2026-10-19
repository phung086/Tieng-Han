import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {runtimeFingerprint} from "./runtime.mjs";
test("build identity ignores private lessons/progress and changes for app, Docker and migration updates",async t=>{
 const root=await mkdtemp(path.join(tmpdir(),"haneul-runtime-"));t.after(()=>rm(root,{recursive:true,force:true}));
 for(const dir of ["src",".haneul","scripts","migrations"])await mkdir(path.join(root,dir));
 await writeFile(path.join(root,"src/app.ts"),"first");const first=await runtimeFingerprint(root);
 await writeFile(path.join(root,".haneul/course.json"),"private updated");assert.equal(await runtimeFingerprint(root),first);
 await writeFile(path.join(root,"compose.yaml"),"new config");const compose=await runtimeFingerprint(root);assert.notEqual(compose,first);
 await writeFile(path.join(root,"migrations/002.sql"),"SELECT 1");assert.notEqual(await runtimeFingerprint(root),compose);
});
