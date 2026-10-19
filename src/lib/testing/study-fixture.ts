import type { LessonContent, StudyQuestion } from "@/data/content";
import type { RuntimeCourse } from "@/lib/content-store";
const empty = (id:number): LessonContent => ({id,title:"Synthetic "+id,vi:"Bài mẫu kiểm thử",objective:"Fixture only",vocabulary:[],grammar:[],listening:[],speaking:[],reading:null,writing:null});
export const studyQuestions: StudyQuestion[] = [{id:"g-3-1",lessonId:3,skill:"grammar",type:"choice",title:"Synthetic",prompt:"Chọn câu mẫu",choices:["가요","가다"],answer:"가요",explanation:"Giải thích mẫu được lưu trong fixture."}];
const lesson: LessonContent = {...empty(3),vocabulary:[
  {id:"v-school",ko:"학교",vi:"trường học",example:"저는 학교에 갑니다."},
  {id:"v-home",ko:"집",vi:"nhà",example:"집에 가요."},
  {id:"v-company",ko:"회사",vi:"công ty",example:"회사에 가요."},
],grammar:[{id:"g",pattern:"에",meaning:"đến",explanation:"Giải thích kiểm thử.",examples:["학교에 가요.","집에 가요.","회사에 가요."]}],listening:[{id:"listen",text:"안녕하세요.",meaning:"Xin chào.",choices:["chào","cảm ơn"],answer:"chào"}],speaking:["학교에 가요."],reading:{title:"Synthetic reading",text:"민수는 학생입니다.",translation:"Mẫu kiểm thử.",questions:[{id:"read-1",q:"민수?",choices:["학생","선생님"],answer:"학생"}]},writing:{prompt:"Viết một câu mẫu.",hint:"Mẫu kiểm thử.",targetWords:["학교"]}};
export const course: RuntimeCourse = {id:"synthetic-support",title:"Synthetic support fixture",level:"test",lessons:[empty(1),empty(2),lesson],questions:studyQuestions};
