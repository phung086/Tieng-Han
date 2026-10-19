// Isolated fixture database and files. Never connects an app to the owner's database.
import {spawnSync} from "node:child_process";
import {mkdir,writeFile,rm} from "node:fs/promises";
import {randomBytes} from "node:crypto";
import path from "node:path";
import assert from "node:assert/strict";
const suffix=randomBytes(5).toString("hex"),database="haneul_http_"+suffix+"_test",container="haneul-smoke-"+suffix;
const directory=path.resolve(".haneul","smoke",suffix),root=path.resolve(".haneul","smoke");
const base="http://127.0.0.1:3108",token=randomBytes(32).toString("base64url");
const docker=args=>{const result=spawnSync("docker",args,{encoding:"utf8",windowsHide:true});if(result.status!==0)throw Error("Docker smoke operation failed (diagnostics withheld)");return result.stdout.trim();};
const sql=query=>docker(["exec","haneul-db-1","sh","-c","psql -U \"$POSTGRES_USER\" -d \"$1\" -At -c \"$2\"","sh",database,query]);
let created=false,started=false;
try{
  const info=JSON.parse(docker(["inspect","haneul-db-1"]))[0];
  const env=Object.fromEntries(info.Config.Env.map(value=>{const i=value.indexOf("=");return[value.slice(0,i),value.slice(i+1)];}));
  const network=Object.keys(info.NetworkSettings.Networks).find(name=>name==="haneul_default");assert.ok(network);
  const url=new URL("postgresql://haneul-db-1:5432/"+database);url.username=env.POSTGRES_USER;url.password=env.POSTGRES_PASSWORD;
  docker(["exec","haneul-db-1","sh","-c","createdb -U \"$POSTGRES_USER\" \"$1\"","sh",database]);created=true;
  await mkdir(path.join(directory,"courses"),{recursive:true});
  const course={id:"synthetic-course",title:"Synthetic Docker smoke",level:"test",lessons:[{id:1,title:"Synthetic",vi:"Mẫu kiểm thử",objective:"Test only",vocabulary:[{id:"word",ko:"학교",vi:"trường học",example:""}],grammar:[],listening:[],speaking:[],reading:null,writing:null}],questions:[]};
  await writeFile(path.join(directory,"courses",course.id+".json"),JSON.stringify(course));
  await writeFile(path.join(directory,"active-course.json"),JSON.stringify(course));
  const envFile=path.join(directory,"runtime.env");
  await writeFile(envFile,["DATABASE_URL="+url.href,"HANEUL_MCP_TOKEN="+token,"HANEUL_COURSE_LIBRARY=/app/.haneul/courses","HANEUL_ACTIVE_COURSE_FILE=/app/.haneul/active-course.json","HANEUL_IMPORT_DIR=/app/.haneul/import-jobs","HANEUL_EVENT_DIR=/app/.haneul/mcp-events"].join("\n"),{mode:0o600});
  docker(["run","-d","--name",container,"--network",network,"--env-file",envFile,"-p","127.0.0.1:3108:3000","--mount","type=bind,source="+directory+",target=/app/.haneul",process.argv[2]??"haneul-app:consolidation-test"]);started=true;
  for(let i=0;i<60;i++){try{const r=await fetch(base+"/api/health",{signal:AbortSignal.timeout(1000)});if(r.ok)break;}catch{/* Wait for migration and startup. */}if(i===59)throw Error("Smoke app did not become ready");await new Promise(resolve=>setTimeout(resolve,500));}
  const request=(route,{cookie,body,method="GET",...rest}={})=>fetch(base+route,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),...rest});
  const register=async name=>{const r=await request("/api/auth/register",{method:"POST",body:{name,email:name+"@example.invalid",password:randomBytes(24).toString("base64url")}});assert.equal(r.status,201);const data=await r.json();return{id:data.user.id,cookie:r.headers.get("set-cookie").split(";")[0]};};
  const a=await register("Synthetic A".replaceAll(" ","")),b=await register("Synthetic B".replaceAll(" ",""));
  assert.match(a.id,/^[a-f0-9-]+$/);sql("UPDATE haneul_users SET role='admin' WHERE id='"+a.id+"'");
  let r=await request("/api/auth/me",{cookie:a.cookie});assert.equal((await r.json()).user.id,a.id);
  assert.equal((await request("/api/courses",{cookie:a.cookie})).status,200);
  sql("UPDATE haneul_course_catalog SET status='published' WHERE course_id='synthetic-course'");
  const state={version:2,xp:30,streak:1,dailyGoal:50,todayXp:30,lastActiveDate:"2026-10-19",lessonProgress:{1:100},skills:Object.fromEntries(["vocabulary","grammar","listening","speaking","reading","writing"].map(k=>[k,{correct:0,total:0}])),completedActivities:[],dailyStats:{},mastery:{},practiceSessions:{quiz:JSON.stringify({index:17,checked:true}),draft:"Synthetic saved draft"}};
  const save=(cookie,userId,value,expectedUpdatedAt)=>request("/api/me/learning-state",{method:"PUT",cookie,body:{courseId:course.id,state:value,expectedUserId:userId,expectedUpdatedAt}});
  r=await save(a.cookie,a.id,state,null);assert.equal(r.status,200);const revision=(await r.json()).revision;
  r=await request("/api/me/learning-state?courseId="+course.id,{cookie:a.cookie});assert.deepEqual((await r.json()).state,state);
  r=await request("/api/me/learning-state?courseId="+course.id,{cookie:b.cookie});assert.equal((await r.json()).state,null);
  assert.equal((await save(a.cookie,b.id,state,revision)).status,409);
  r=await save(a.cookie,a.id,{...state,xp:40},revision);assert.equal(r.status,200);
  assert.equal((await save(a.cookie,a.id,{...state,xp:5},revision)).status,409);
  assert.equal((await request("/api/import-jobs",{cookie:a.cookie})).status,200);
  assert.equal((await request("/api/import-jobs",{cookie:b.cookie})).status,403);
  assert.equal((await request("/api/worksheets")).status,200);
  assert.equal((await request("/mcp",{method:"POST",body:{jsonrpc:"2.0",id:1,method:"tools/list"}})).status,401);
  assert.equal((await request("/api/health")).status,200);
  console.log(JSON.stringify({productionDocker:true,authentication:true,accountIsolation:true,checkpointAndDraftRoundTrip:true,staleSaveRejected:true,accountSwitchRejected:true,importPermissions:true,worksheetRoute:true,mcpUnauthenticatedRejected:true}));
}finally{
  if(started)docker(["rm","-f",container]);
  if(created)docker(["exec","haneul-db-1","sh","-c","dropdb -U \"$POSTGRES_USER\" \"$1\"","sh",database]);
  if(directory.startsWith(root+path.sep))await rm(directory,{recursive:true,force:true});
}
