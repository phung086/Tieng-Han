import {expect,it} from "vitest";
import {createLearningState} from "@/lib/learning-model";
import {learningStateSchema} from "@/lib/db/learning-state-contract";
import {readPracticeSession,writePracticeSession} from "@/lib/practice-session-storage";
const store=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};};
it("keeps resume data scoped to one account and lets only guests read old checkpoints",()=>{
 const storage=store(),state=createLearningState();storage.setItem("quiz","legacy guest");
 expect(readPracticeSession(state,storage,"v3:guest:book","quiz")).toBe("legacy guest");
 expect(readPracticeSession(state,storage,"v3:user:A:book","quiz")).toBeNull();
 writePracticeSession(storage,"v3:user:A:book","quiz","answer A");
 expect(readPracticeSession(state,storage,"v3:user:B:book","quiz")).toBeNull();
 expect(readPracticeSession(state,storage,"v3:user:A:book","quiz")).toBe("answer A");
});
it("round trips optional checkpoints through the server contract without changing old progress",()=>{
 const original={...createLearningState(),xp:75,lessonProgress:{1:100},practiceSessions:{quiz:JSON.stringify({index:17,correctCount:12})}};
 const parsed=learningStateSchema.parse(original);
 expect(parsed).toEqual(original);
 expect(readPracticeSession(parsed,store(),"v3:user:A:book","quiz")).toBe(original.practiceSessions.quiz);
 writePracticeSession(store(),"v3:user:A:book","quiz",null);
 expect(learningStateSchema.safeParse(createLearningState()).success).toBe(true);
});
