import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { illustrationSchema, illustrationsFor, cropPixels } from "./learning-illustrations";
import { normalizeLessonContent, parseCourseBundle } from "./course-bundle";
const image = { id:"fig-1",kind:"vocabulary",targetIds:["v1"],relation:"exact",fileName:"book.pdf",pageNumber:2,region:[.1,.2,.3,.4],alt:"학교",caption:"",sourceRef:"book.pdf p.2 · figure" };
const lesson=normalizeLessonContent({id:1,title:"학교",vi:"Trường",objective:"test",vocabulary:[{id:"v1",ko:"학교",vi:"trường",example:""}],grammar:[],listening:[],speaking:[],reading:null,writing:null,illustrations:[image]});
describe("authored learning illustration contract",()=>{
  it("preserves item bindings and regions through bundle parsing",()=>{
    const bundle=parseCourseBundle(JSON.stringify({format:"haneul-course-bundle",version:1,course:{title:"Test",level:"test",lessons:[lesson],questions:[]}}));
    expect(bundle.course.lessons[0].illustrations).toEqual([image]);
    expect(illustrationsFor(bundle.course.lessons[0],"vocabulary","v1",true)).toHaveLength(1);
    expect(illustrationsFor(bundle.course.lessons[0],"vocabulary","other",true)).toHaveLength(0);
  });
  it("rejects off-page, full-page, nonfinite regions and ambiguous exact targets",()=>{
    for(const change of [{region:[.9,0,.3,.1]},{region:[0,0,1,1]},{region:[0,0,0,.1]},{region:[0,NaN,.1,.2]},{targetIds:["v1","v2"]},{targetIds:[]}])expect(illustrationSchema.safeParse({...image,...change}).success).toBe(false);
  });
  it("rejects unknown target IDs and course-wide duplicate asset IDs",()=>{
    const bundle={format:"haneul-course-bundle",version:1,course:{title:"Test",level:"test",lessons:[lesson],questions:[]}};
    expect(()=>parseCourseBundle(JSON.stringify({...bundle,course:{...bundle.course,lessons:[{...lesson,illustrations:[{...image,targetIds:["unknown"]}]}]}}))).toThrow();
    expect(()=>parseCourseBundle(JSON.stringify({...bundle,course:{...bundle.course,lessons:[lesson,{...lesson,id:2}]}}))).toThrow();
  });
  it("uses only the authored crop, without labels or neighboring page pixels",async()=>{
    const original=await sharp({create:{width:100,height:100,channels:3,background:"red"}}).composite([{input:await sharp({create:{width:30,height:40,channels:3,background:"blue"}}).png().toBuffer(),left:10,top:20}]).png().toBuffer();
    const cropped=await sharp(original).extract(cropPixels([.1,.2,.3,.4],100,100)).raw().toBuffer({resolveWithObject:true});
    expect(cropped.info).toMatchObject({width:30,height:40});expect([...cropped.data.subarray(0,3)]).toEqual([0,0,255]);
  });
});
