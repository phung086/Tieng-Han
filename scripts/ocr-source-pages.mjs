#!/usr/bin/env node
// Optional offline OCR worker. Textbook images stay on this machine.
import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
async function main() {
  const directory=option('--data-dir');
  if (!directory) throw new Error('Usage: --data-dir DIR [--module TESSERACT_PACKAGE_DIR] [--workers N]');
  const root=path.resolve(directory),require=createRequire(import.meta.url);
  const { createWorker }=require(option('--module')?path.resolve(option('--module')):'tesseract.js');
  const concurrency=Number(option('--workers')??2);
  if (!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>32) throw new Error('Workers must be 1..32; this does not limit total pages.');
  const tasks=[],failures=[];
  for (const file of await readdir(path.join(root,'courses'))) {
    if (!file.endsWith('.json')) continue;
    const course=JSON.parse(await readFile(path.join(root,'courses',file),'utf8'));
    const jobId=course.source.importJobId;
    if (!/^[a-z0-9-]+$/i.test(jobId)) throw new Error('Invalid import identity');
    const job=JSON.parse(await readFile(path.join(root,'import-jobs',jobId,'job.json'),'utf8'));
    for (const document of job.documents) {
      if (document.fileName!==course.source.fileName) continue;
      for (let n=1;n<=document.pageCount;n++) {
        const archiveFile=path.join(root,'recovered-source',jobId,String(n).padStart(5,'0')+'.json');
        try {
          const page=JSON.parse(await readFile(archiveFile,'utf8'));
          if (page.needsOcr) tasks.push({jobId,document,n,archiveFile,page});
        } catch(error) {failures.push({jobId,page:n,error:error.message});}
      }
    }
  }
  const cache=path.join(root,'ocr-model-cache');await mkdir(cache,{recursive:true});
  let completed=0,cursor=0;
  const run=async worker=>{
    try {
      while(cursor<tasks.length) {
        const task=tasks[cursor++];
        try {
          const source=JSON.parse(await readFile(path.join(root,'import-jobs',task.jobId,'pages',task.document.documentId+'-'+String(task.n).padStart(5,'0')+'.json'),'utf8'));
          if (!source.previewImageDataUrl) throw new Error('Original page image unavailable; retain for retry.');
          const {data}=await worker.recognize(source.previewImageDataUrl,{}, {text:true,tsv:true});
          const words=data.tsv.split('\n').slice(1).filter(Boolean).map(row=>row.split('\t')).filter(row=>row[0]==='5'&&row[11]?.trim()).map(row=>({text:row.slice(11).join('\t'),x0:+row[6],top:+row[7],x1:+row[6]+ +row[8],bottom:+row[7]+ +row[9],confidence:+row[10],block:+row[2],paragraph:+row[3],line:+row[4]}));
          const result={...task.page,originalText:task.page.text,text:data.text,words,method:'tesseract.js kor+vie+eng',needsOcr:false,ocrConfidence:data.confidence,reviewRequired:true};
          const temp=task.archiveFile+'.ocr.tmp';await writeFile(temp,JSON.stringify(result),'utf8');await rename(temp,task.archiveFile);
          completed++;console.log(JSON.stringify({jobId:task.jobId,page:task.n,completed,total:tasks.length,confidence:data.confidence,reviewRequired:true}));
        } catch(error) {failures.push({jobId:task.jobId,page:task.n,error:error.message});}
      }
    } finally {await worker.terminate();}
  };
  if (tasks.length) {
    // Download/cache language models once before starting concurrent workers.
    const first=await createWorker(['kor','vie','eng'],1,{cachePath:cache});
    const workers=[first];
    try {for(let i=1;i<Math.min(concurrency,tasks.length);i++) workers.push(await createWorker(['kor','vie','eng'],1,{cachePath:cache}));}
    catch(error) {await Promise.all(workers.map(worker=>worker.terminate()));throw error;}
    await Promise.all(workers.map(run));
  }
  const report=path.join(root,'review','ocr-recovery-latest.json');await mkdir(path.dirname(report),{recursive:true});
  await writeFile(report,JSON.stringify({completed,expected:tasks.length,failures,independentlyVerified:false},null,2),'utf8');
  if (failures.length) throw new Error(failures.length+' OCR/source failures retained in '+report);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
