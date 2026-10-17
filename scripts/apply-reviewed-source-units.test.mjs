import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeReviewedGrammar } from './apply-reviewed-source-units.mjs';

const course={id:'synthetic',source:{fileName:'synthetic.pdf',pageCount:500},questions:[{id:'retained'}],lessons:Array.from({length:37},(_,i)=>({id:i+1,vocabulary:[{id:'word'}],grammar:[{id:'stable-'+(i+1),pattern:'-는',examples:['old']}]}))};
const review={fileName:'synthetic.pdf',method:'Synthetic review fixture',lessons:Object.fromEntries(course.lessons.map(lesson=>[lesson.id,[{pattern:'-는',meaning:'synthetic meaning',explanation:'synthetic explanation',pages:[lesson.id],examples:Array.from({length:77},(_,i)=>'Example '+i)}]]))};

test('applies every reviewed lesson/example without altering IDs, questions, words, or completion evidence',()=>{
  const result=mergeReviewedGrammar(course,review);
  assert.equal(result.updated.length,37);
  assert.equal(result.course.lessons.at(-1).grammar[0].examples.at(-1),'Example 76');
  assert.equal(result.course.lessons.at(-1).grammar[0].id,'stable-37');
  assert.deepEqual(result.course.questions,course.questions);
  assert.deepEqual(result.course.lessons[0].vocabulary,course.lessons[0].vocabulary);
  assert.equal(course.lessons[0].grammar[0].examples[0],'old');
  assert.equal(result.course.source.curriculumCoverage.status,'partial');
  assert.deepEqual(mergeReviewedGrammar(result.course,review),result);
});

test('rejects wrong source, missing lessons, duplicate patterns, empty examples and out-of-range pages before mutation',()=>{
  for (const mutate of [r=>r.fileName='wrong.pdf',r=>r.lessons['999']=r.lessons['1'],r=>r.lessons['1'].push(r.lessons['1'][0]),r=>r.lessons['1'][0].examples.push(''),r=>r.lessons['1'][0].pages.push(501)]) {
    const input=structuredClone(review);mutate(input);
    assert.throws(()=>mergeReviewedGrammar(course,input));
  }
  assert.deepEqual(course.questions,[{id:'retained'}]);
});

test('updates vocabulary in place, preserves unmatched material, retains repeated-source provenance and labels derived translations',()=>{
  const input={...structuredClone(course),lessons:[{id:1,vocabulary:[{id:'keep-id',ko:'학교',vi:'old'},{id:'other',ko:'나',vi:'preserve'}],grammar:[]}]};
  const value={fileName:'synthetic.pdf',method:'Synthetic review',lessons:{},vocabulary:{1:[{ko:'학교',vi:'school',pages:[1]},{ko:'학교',vi:'school',pages:[2]},{ko:'눈',vi:'eye',pages:[3],meaningOrigin:'derived'}]}};
  const result=mergeReviewedGrammar(input,value);
  assert.equal(result.course.lessons[0].vocabulary.length,3);
  assert.equal(result.course.lessons[0].vocabulary[0].id,'keep-id');
  assert.equal(result.course.lessons[0].vocabulary[0].vi,'school');
  assert.match(result.course.lessons[0].vocabulary[0].sourceRef,/p\.1.*p\.2/);
  assert.equal(result.course.lessons[0].vocabulary[1].vi,'preserve');
  assert.equal(result.course.lessons[0].vocabulary[2].learnerMeaningOrigin,'derived');
  assert.match(result.course.lessons[0].vocabulary[2].sourceRef,/không có trong nguồn/);
  assert.deepEqual(mergeReviewedGrammar(result.course,value),result);
});
