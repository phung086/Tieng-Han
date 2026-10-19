import type { LearningState } from "@/lib/learning-model";
type SessionStorage = Pick<Storage,"getItem"|"setItem"|"removeItem">;
export function scopedPracticeKey(scope:string,key:string){return scope+":session:"+key;}
/** Server state and its offline account cache win. Legacy checkpoints belong to guests only. */
export function readPracticeSession(state:LearningState, storage:SessionStorage, scope:string, key:string){
  if(state.practiceSessions?.[key]!==undefined)return state.practiceSessions[key];
  try{return storage.getItem(scopedPracticeKey(scope,key)) ?? (scope.includes(":guest:")?storage.getItem(key):null);}catch{return null;}
}
export function writePracticeSession(storage:SessionStorage,scope:string,key:string,value:string|null){
  try{if(value===null){storage.removeItem(scopedPracticeKey(scope,key));if(scope.includes(":guest:"))storage.removeItem(key);}else storage.setItem(scopedPracticeKey(scope,key),value);}catch{/* Account state remains authoritative when browser storage is unavailable. */}
}
