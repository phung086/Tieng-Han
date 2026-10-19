import { readFile, writeFile, mkdir, access, readdir } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const compose=["compose","--env-file",".env.docker"];
const exists=file=>access(file).then(()=>true,()=>false);
export async function runtimeFingerprint(directory=root){
  const names=[];
  async function walk(relative){for(const item of await readdir(path.join(directory,relative),{withFileTypes:true})){const name=path.join(relative,item.name);if(item.isDirectory())await walk(name);else if(item.isFile())names.push(name);}}
  for(const name of ["src","public","curriculum","migrations","scripts","docker"])if(await exists(path.join(directory,name)))await walk(name);
  for(const name of ["Dockerfile",".dockerignore","compose.yaml","package.json","pnpm-lock.yaml","pnpm-workspace.yaml","next.config.ts","tsconfig.json"])if(await exists(path.join(directory,name)))names.push(name);
  const hash=createHash("sha256");for(const name of names.sort()){hash.update(name.replaceAll(path.sep,"/")+"\0");hash.update(await readFile(path.join(directory,name)));}return hash.digest("hex");
}
function capture(args){return spawnSync("docker",args,{cwd:root,encoding:"utf8",windowsHide:true});}
function run(command,args){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:root,stdio:"inherit",windowsHide:true});child.once("error",reject);child.once("exit",code=>code===0?resolve():reject(Error("Tác vụ chưa thành công: "+command+" "+args.slice(0,2).join(" "))));});}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function dockerReady(){
  if(capture(["info","--format","{{.ServerVersion}}"]).status===0)return;
  if(process.platform==="win32"){
    const desktop=path.join(process.env.ProgramFiles??"C:/Program Files","Docker","Docker","Docker Desktop.exe");
    if(await exists(desktop)){const child=spawn(desktop,[],{detached:true,stdio:"ignore",windowsHide:true});child.unref();console.log("Đang chờ Docker Desktop sẵn sàng…");for(let i=0;i<30;i++){await pause(2000);if(capture(["info","--format","{{.ServerVersion}}"]).status===0)return;}}
  }
  throw Error("Hãy bật Docker Desktop rồi mở lại Start-Haneul.cmd.");
}
async function portOccupied(port){return new Promise(resolve=>{const probe=net.createServer();probe.once("error",()=>resolve(true));probe.listen(port,"127.0.0.1",()=>probe.close(()=>resolve(false)));});}
async function prepare(){
  await run(process.execPath,["scripts/docker-setup.mjs"]);
  const file=path.join(root,".env.docker"),source=await readFile(file,"utf8");
  process.loadEnvFile(file);
  if(!process.env.HANEUL_MCP_TOKEN?.trim()){
    await writeFile(file,source.replace(/^\s*HANEUL_MCP_TOKEN\s*=.*$/gm,"")+"\nHANEUL_MCP_TOKEN="+randomBytes(32).toString("base64url")+"\n",{mode:0o600});
    console.log("Đã tạo khóa MCP riêng; xem cấu hình kết nối trong ứng dụng khi cần.");
  }
}
export async function startRuntime(action="start"){
  await dockerReady();
  if(!["start","stop","status","backup","logs"].includes(action))throw Error("Dùng start, stop, status, backup hoặc logs.");
  await prepare();
  if(action==="stop")return run("docker",[...compose,"stop"]);
  if(action==="status")return run("docker",[...compose,"ps"]);
  if(action==="logs")return run("docker",[...compose,"logs","--tail=60","-f"]);
  if(action==="backup"){await run("docker",[...compose,"up","-d","--wait","db"]);return run(process.execPath,["scripts/docker-backup.mjs"]);}
  const port=Number(process.env.HANEUL_WEB_PORT??3000);
  const owned=capture([...compose,"ps","-q","--status","running","app"]).stdout?.trim();
  if(!owned&&await portOccupied(port))throw Error("Cổng "+port+" đang do ứng dụng khác dùng. Dừng đúng máy chủ cũ trước khi mở Haneul; không tự dừng tiến trình lạ.");
  await mkdir(path.join(root,".haneul","courses"),{recursive:true});
  const fingerprint=await runtimeFingerprint();
  const image=capture(["image","inspect","haneul-app:latest","--format","{{index .Config.Labels \"vn.haneul.build-fingerprint\"}}"]);
  const rebuild=image.status!==0||image.stdout.trim()!==fingerprint;
  if(rebuild){console.log("Đang build bản ứng dụng hiện tại…");await run("docker",[...compose,"build","--build-arg","HANEUL_BUILD_FINGERPRINT="+fingerprint,"app"]);}
  await run("docker",[...compose,"up","-d","--wait","db"]);
  const record=path.join(root,".haneul","runtime.json");
  let previous;try{previous=JSON.parse(await readFile(record,"utf8"));}catch{/* First launch. */}
  if(previous?.fingerprint!==fingerprint)await run(process.execPath,["scripts/docker-backup.mjs"]);
  await run("docker",[...compose,"up","-d","--no-build","--wait","--wait-timeout","120","app"]);
  const health=await fetch("http://127.0.0.1:"+port+"/api/health",{signal:AbortSignal.timeout(10000)});
  const data=await health.json();if(!health.ok||data.status!=="ready"||data.build!==fingerprint)throw Error("Máy chủ chưa xác nhận đúng build hoặc database.");
  await writeFile(record,JSON.stringify({projectDir:root,dataDir:path.join(root,".haneul"),fingerprint,at:new Date().toISOString()},null,2));
  console.log("Haneul sẵn sàng: http://127.0.0.1:"+port+" · giao diện + backend + PostgreSQL.");
  console.log("Dữ liệu dự án: "+path.join(root,".haneul")+". Đăng nhập để lưu tiến độ theo tài khoản.");
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startRuntime(process.argv[2]).catch(error=>{console.error(error.message);console.error("Dữ liệu và bản sao lưu được giữ nguyên.");process.exitCode=1;});
