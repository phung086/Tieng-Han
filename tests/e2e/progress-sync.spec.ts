import {test,expect} from "@playwright/test";
test("account backend restores a graded quiz turn without awarding its score twice",async({page})=>{
  const lesson={id:1,title:"Synthetic",vi:"Fixture",objective:"Synthetic test only",vocabulary:[],grammar:[],listening:[],speaking:[],reading:null,writing:null};
  const questions=[1,2].map(n=>({id:"question-"+n,lessonId:1,skill:"vocabulary",type:"choice",title:"Synthetic "+n,prompt:"Synthetic prompt "+n,choices:["Correct "+n,"Wrong "+n],answer:"Correct "+n,explanation:"Synthetic feedback."}));
  let state:Record<string,unknown>|null=null,revision:string|null=null,writes=0;
  await page.route("**/api/auth/me",route=>route.fulfill({json:{configured:true,user:{id:"synthetic-user",name:"Synthetic",role:"admin",email:"synthetic@example.invalid"}}}));
  await page.route("**/api/courses",route=>route.fulfill({json:{activeCourseId:"synthetic-account",courses:[{id:"synthetic-account",title:"Synthetic",level:"test",lessons:[lesson],questions}]}}));
  await page.route("**/api/me/learning-state**",async route=>{
    if(route.request().method()==="PUT"){
      const body=route.request().postDataJSON();expect(body.expectedUserId).toBe("synthetic-user");expect(body.courseId).toBe("synthetic-account");
      state=body.state;revision="2026-10-19T12:00:00."+String(++writes).padStart(6,"0")+"Z";
      await route.fulfill({json:{ok:true,revision}});
    }else await route.fulfill({json:{configured:true,state,revision}});
  });
  const savedXp=()=>state?.xp;
  await page.goto("/practice/quiz?lesson=1&mode=guided");
  await expect(page.locator(".question-prompt")).toContainText("Synthetic prompt 1");
  await page.getByRole("button",{name:"Tự chuyển câu đúng: Bật",exact:true}).click();
  await page.getByRole("button",{name:/Correct 1/}).dblclick();
  await expect(page.getByText("Chính xác!",{exact:true})).toBeVisible();
  await expect.poll(()=>state?.xp).toBe(10);
  await expect.poll(()=>Object.values(state?.practiceSessions??{}).some(raw=>JSON.parse(String(raw)).checked===true)).toBe(true);
  await page.reload();
  await expect(page.getByText("Chính xác!",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:/Correct 1/})).toBeDisabled();
  expect(savedXp()).toBe(10);
  await page.locator(".session-footer > button.primary-button").click();
  await expect(page.locator(".question-prompt")).toContainText("Synthetic prompt 2");
  expect(savedXp()).toBe(10);
});
