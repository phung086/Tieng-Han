import {inspectLibrary} from "./local.mjs";
import {runtimeFingerprint} from "./runtime.mjs";
import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
try{
  const data=path.join(root,".haneul"),library=await inspectLibrary(data);
  console.table(library.courses.map(c=>({"Giáo trình":c.title,"Bài":c.lessons,"Ngữ pháp":c.grammar,"Nguồn":c.coverage})));
  console.log(library.courses.length+" khóa · "+library.lessons+" bài · "+library.grammar+" mục ngữ pháp; chưa chứng nhận đủ nội dung sách.");
  process.loadEnvFile(path.join(root,".env.docker"));
  const port=Number(process.env.HANEUL_WEB_PORT??3000),response=await fetch("http://127.0.0.1:"+port+"/api/health",{signal:AbortSignal.timeout(5000)});
  const health=await response.json();
  if(!response.ok||health.status!=="ready"||health.build!==await runtimeFingerprint(root))throw Error("Backend/database chưa sẵn sàng hoặc đang chạy build khác.");
  const result=spawnSync("docker",["inspect","haneul-app-1"],{encoding:"utf8",windowsHide:true});
  if(result.status!==0)throw Error("Chưa xác định được container Haneul.");
  const mount=JSON.parse(result.stdout)[0].Mounts.find(m=>m.Destination==="/app/.haneul");
  const canonical=value=>value.replaceAll("\\","/").replace(/^\/run\/desktop\/mnt\/host\//,"/").replace(/^\/host_mnt\//,"/").replace(/^\/([a-z])\//i,"$1:/").replace(/\/+$/g,"").toLowerCase();
  if(!mount||canonical(mount.Source)!==canonical(data))throw Error("Container đang dùng thư mục dữ liệu khác.");
  console.log("Đúng build, PostgreSQL sẵn sàng và dữ liệu được mount từ "+data);
}catch(error){console.error(error.message);process.exitCode=1;}
