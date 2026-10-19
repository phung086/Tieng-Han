import {beforeAll,afterAll,describe,expect,it} from "vitest";
import {randomUUID} from "node:crypto";
import {readFile,readdir} from "node:fs/promises";
import path from "node:path";
import {getDbPool,dbQuery} from "@/lib/db";
import {getLearningState,saveLearningState} from "@/lib/db/learning-state-store";
import {createLearningState} from "@/lib/learning-model";
const url=process.env.HANEUL_TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL progress isolation and concurrent saves",()=>{
 const users=["probe-"+randomUUID(),"probe-"+randomUUID()],course="synthetic-progress";
 beforeAll(async()=>{
   if(!new URL(url!).pathname.endsWith("_test"))throw Error("Integration tests require a dedicated *_test database");
   process.env.DATABASE_URL=url;
   for(const file of (await readdir("migrations")).filter(f=>f.endsWith(".sql")).sort())await dbQuery(await readFile(path.join("migrations",file),"utf8"));
   for(const id of users)await dbQuery("INSERT INTO haneul_users (id,email,name,password_hash) VALUES ($1,$2,'Synthetic test','unusable')",[id,id+"@example.invalid"]);
 });
 afterAll(async()=>{try{await dbQuery("DELETE FROM haneul_users WHERE id=ANY($1::text[])",[users]);}finally{await getDbPool().end();}});
 it("round trips full progress, resumption and drafts with microsecond revisions",async()=>{
   const state={...createLearningState(),xp:30,lessonProgress:{1:100},practiceSessions:{quiz:JSON.stringify({index:17,checked:true}),draft:"Synthetic saved answer"}};
   const revision=await saveLearningState({userId:users[0],courseId:course,state,expectedUpdatedAt:null});
   expect(revision).toMatch(/\.\d{6}Z$/);
   expect(await getLearningState(users[0],course)).toEqual({state,revision});
   expect((await getLearningState(users[1],course)).state).toBeNull();
   expect((await getLearningState(users[0],"other-course")).state).toBeNull();
 });
 it("rejects stale overwrites, accepts exact retries and lets only one concurrent changed snapshot win",async()=>{
   const old=await getLearningState(users[0],course),state={...(old.state as object),xp:40};
   const revision=await saveLearningState({userId:users[0],courseId:course,state,expectedUpdatedAt:old.revision});
   expect(await saveLearningState({userId:users[0],courseId:course,state,expectedUpdatedAt:old.revision})).toBe(revision);
   expect(await saveLearningState({userId:users[0],courseId:course,state:{...state,xp:1},expectedUpdatedAt:old.revision})).toBeNull();
   const saves=await Promise.all([50,60].map(xp=>saveLearningState({userId:users[0],courseId:course,state:{...state,xp},expectedUpdatedAt:revision})));
   expect(saves.filter(Boolean)).toHaveLength(1);
 });
});
