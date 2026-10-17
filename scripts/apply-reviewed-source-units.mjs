#!/usr/bin/env node
import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const key = value => value.replace(/\s+/g, '');

export function mergeReviewedGrammar(course, review) {
  if (review.fileName !== course.source.fileName || !nonempty(review.method)) throw new Error('Review source identity/method missing');
  if (!review.lessons || typeof review.lessons !== 'object') throw new Error('Reviewed lessons missing');
  const revised = structuredClone(course);
  const updated = [];
  for (const [id, entries] of Object.entries(review.lessons)) {
    const lesson = revised.lessons.find(item => String(item.id) === id);
    if (!lesson) throw new Error('Review references missing lesson ' + id);
    if (!Array.isArray(entries) || !entries.length) throw new Error('Empty grammar review for lesson ' + id);
    const patterns = new Set();
    const retainedIds = new Set();
    lesson.grammar = entries.map((entry, index) => {
      if (!nonempty(entry.pattern) || !nonempty(entry.meaning) || !nonempty(entry.explanation) ||
        !Array.isArray(entry.examples) || entry.examples.some(example => !nonempty(example)) ||
        !Array.isArray(entry.pages) || !entry.pages.length || entry.pages.some(n => !Number.isSafeInteger(n) || n < 1 || n > course.source.pageCount)) {
        throw new Error('Invalid reviewed grammar at lesson ' + id + ' item ' + index);
      }
      if (patterns.has(key(entry.pattern))) throw new Error('Duplicate reviewed pattern in lesson ' + id);
      patterns.add(key(entry.pattern));
      const previous = lesson.grammar.find(item => !retainedIds.has(item.id) && (key(item.pattern) === key(entry.pattern) || key(item.pattern).includes(key(entry.pattern))));
      if (previous) retainedIds.add(previous.id);
      return {
        id: previous?.id ?? 'reviewed:' + lesson.id + ':grammar:' + (index + 1),
        pattern: entry.pattern, meaning: entry.meaning, explanation: entry.explanation,
        examples: [...entry.examples],
        sourceRef: review.fileName + ' · ' + entry.pages.map(n => 'p.' + n).join(', ') + ' · ngữ pháp ' + (index + 1),
      };
    });
    lesson.sourceRecovery = {
      ...lesson.sourceRecovery,
      status: 'partial',
      grammarReview: { method: review.method, sourcePages: [...new Set(entries.flatMap(entry => entry.pages))], patterns: entries.length, examples: entries.reduce((n,entry) => n + entry.examples.length,0) },
      independentlyVerified: false,
    };
    delete lesson.quality;
    updated.push({ lessonId: lesson.id, grammar: lesson.grammar.length, examples: lesson.grammar.reduce((n,item) => n + item.examples.length,0) });
  }
  for (const [id, entries] of Object.entries(review.vocabulary ?? {})) {
    const lesson=revised.lessons.find(item=>String(item.id)===id);
    if (!lesson || !Array.isArray(entries) || !entries.length) throw new Error('Invalid reviewed vocabulary lesson '+id);
    const retained=new Set(),canonical=[],pairMap=new Map();
    for (const [index,entry] of entries.entries()) {
      if (!nonempty(entry.ko) || !nonempty(entry.vi) || !Array.isArray(entry.pages) || !entry.pages.length || entry.pages.some(n=>!Number.isSafeInteger(n)||n<1||n>course.source.pageCount)) throw new Error('Invalid vocabulary at lesson '+id+' item '+index);
      if (entry.meaningOrigin && !['source','derived'].includes(entry.meaningOrigin)) throw new Error('Invalid meaning origin');
      const ref=review.fileName+' · '+entry.pages.map(n=>'p.'+n).join(', ')+' · mục từ '+(index+1)+(entry.meaningOrigin==='derived'?' · nghĩa Việt bổ trợ, không có trong nguồn':'');
      const pair=entry.ko+'\0'+entry.vi;
      if (pairMap.has(pair)) {pairMap.get(pair).sourceRef+='; '+ref;continue;}
      const previous=lesson.vocabulary.find(word=>!retained.has(word.id)&&key(word.ko)===key(entry.ko));
      if (previous) retained.add(previous.id);
      const word={id:previous?.id??'reviewed:'+lesson.id+':vocabulary:'+(index+1),ko:entry.ko,targetText:entry.ko,vi:entry.vi,learnerMeaning:entry.vi,example:'',sourceRef:ref,learnerMeaningOrigin:entry.meaningOrigin??'source'};
      canonical.push(word);pairMap.set(pair,word);
    }
    const targets=new Set(canonical.map(word=>key(word.ko))),byId=new Map(canonical.map(word=>[word.id,word]));
    const previousIds=new Set(lesson.vocabulary.map(word=>word.id));
    lesson.vocabulary=[...lesson.vocabulary.filter(word=>byId.has(word.id)||!targets.has(key(word.ko))).map(word=>byId.get(word.id)??word),...canonical.filter(word=>!previousIds.has(word.id))];
    lesson.sourceRecovery={...lesson.sourceRecovery,status:'partial',vocabularyReview:{method:review.method,sourceEntries:entries.length,canonicalEntries:canonical.length,pages:[...new Set(entries.flatMap(word=>word.pages))]},independentlyVerified:false};
    delete lesson.quality;
    updated.push({lessonId:lesson.id,vocabulary:lesson.vocabulary.length,reviewedVocabulary:entries.length});
  }
  revised.source.curriculumCoverage = {
    ...revised.source.curriculumCoverage, status: 'partial',
    basis: 'Reviewed grammar source units; remaining textbook units require reconciliation.',
  };
  return { course: revised, updated };
}

async function atomic(file,value) {
  const temp = file + '.review.tmp';
  await writeFile(temp,JSON.stringify(value,null,2),'utf8');
  await rename(temp,file);
}

async function main(args) {
  const option = name => {const i=args.indexOf(name);return i < 0 ? undefined : args[i+1];};
  const directory=option('--data-dir'),reviewFile=option('--review');
  if (!directory || !reviewFile) throw new Error('Usage: --data-dir DIR --review FILE [--apply]');
  const root=path.resolve(directory),review=JSON.parse(await readFile(reviewFile,'utf8'));
  const courses=[];
  for (const file of await readdir(path.join(root,'courses'))) {
    if (!file.endsWith('.json')) continue;
    const location=path.join(root,'courses',file),bytes=await readFile(location);
    const value=JSON.parse(bytes);
    if (value.source.fileName === review.fileName) courses.push({location,value,bytes});
  }
  if (courses.length!==1) throw new Error('Review must match exactly one course');
  const {location,value,bytes}=courses[0];
  if (path.basename(review.fileName)!==review.fileName) throw new Error('Invalid source name');
  const original=await readFile(path.join(root,'originals',review.fileName));
  if (!review.originalSha256 || createHash('sha256').update(original).digest('hex')!==review.originalSha256) throw new Error('Review does not match original PDF checksum');
  const result=mergeReviewedGrammar(value,review);
  if (args.includes('--apply')) {
    // Validate everything before the first write. Keep the previous course and
    // learner-facing active-course selection; question/history data is retained.
    const backup=path.join(root,'review','before-reviewed-units-'+Date.now());
    await mkdir(backup,{recursive:true});
    await writeFile(path.join(backup,path.basename(location)),bytes);
    await atomic(location,result.course);
    const activeFile=path.join(root,'active-course.json');
    const active=JSON.parse(await readFile(activeFile,'utf8'));
    if (active.id===value.id) {await atomic(path.join(backup,'active-course.json'),active);await atomic(activeFile,result.course);}
  }
  console.log(JSON.stringify({courseId:value.id,applied:args.includes('--apply'),updated:result.updated,status:'partial'}));
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
