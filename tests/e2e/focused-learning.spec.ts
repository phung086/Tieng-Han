import { expect, test } from "@playwright/test";
const lesson = { id: 1, title: "학교", vi: "Trường học", objective: "Nhận biết địa điểm và dùng mẫu câu.", sourceRef: "private-book.pdf p.4", vocabulary: Array.from({length:13}, (_,i)=>({id:"v"+i,ko:"단어 "+i,vi:"nghĩa "+i,example:"저는 학생입니다."})), grammar:[{id:"g1",pattern:"입니다",meaning:"là",explanation:"Gắn sau danh từ.\nLưu ý: giữ nguyên danh từ khi kết hợp.\n학생입니다.\nTôi là học sinh.",examples:["학생입니다.","선생님입니다."],sourceRef:"private-book.pdf p.5"},{id:"g2",pattern:"입니까?",meaning:"là phải không?",explanation:"Dùng để hỏi lịch sự.",examples:["학생입니까?"],sourceRef:"private-book.pdf p.6"}],dialogues:[],listening:[],speaking:[],reading:null,writing:null };
test.beforeEach(async({page})=>{
 await page.route("**/api/auth/me",r=>r.fulfill({json:{configured:false,user:null}}));
 await page.route("**/api/courses",r=>r.fulfill({json:{activeCourseId:"focused-fixture",courses:[{id:"focused-fixture",title:"Synthetic focused flow",level:"test",lessons:[lesson,{...lesson,id:2,title:"일상",vi:"Hàng ngày"}],questions:[]}]}}));
});
test("keeps every word reachable in small groups, remembers position and opens later lessons freely",async({page})=>{
 await page.goto("/learn/1");
 const words=page.getByRole("region",{name:"Học từ vựng cùng hình"});
 await expect(words.getByRole("heading",{level:3})).toHaveCount(6);
 await page.getByRole("combobox",{name:"Nhóm từ",exact:true}).selectOption("2");
 await expect(words.getByRole("heading",{name:"단어 12",exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole("combobox",{name:"Nhóm từ",exact:true})).toHaveValue("2");
 await page.getByRole("button",{name:"Xem toàn bộ",exact:true}).click();
 await expect(words.getByRole("heading",{level:3})).toHaveCount(13);
 await expect(page.getByText("private-book.pdf",{exact:false})).toHaveCount(0);
 await page.getByRole("link",{name:"Sang Bài 2",exact:true}).click();
 await expect(page.getByRole("heading",{name:"일상",exact:true})).toBeVisible();
});
test("keeps every grammar caveat and example accessible through understand, example and self-recall",async({page})=>{
 await page.goto("/learn/1");
 await page.getByRole("navigation",{name:"Các chặng học"}).getByRole("button",{name:"Mẫu câu"}).click();
 await expect(page.getByText("Lưu ý: giữ nguyên danh từ khi kết hợp.",{exact:false})).toBeVisible();
 const steps=page.getByRole("navigation",{name:"Các bước học mẫu 입니다"});
 await steps.getByRole("button",{name:"Ví dụ",exact:true}).click();
 await expect(page.getByRole("button",{name:"Nghe ví dụ 학생입니다.",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Ví dụ tiếp",exact:true}).click();
 await expect(page.getByRole("button",{name:"Nghe ví dụ 선생님입니다.",exact:true})).toBeVisible();
 await steps.getByRole("button",{name:"Tự thử"}).click();
 await expect(page.getByRole("button",{name:"Xem câu mẫu",exact:true})).toHaveAttribute("aria-expanded","false");
 await page.getByRole("button",{name:"Xem câu mẫu",exact:true}).click();
 await expect(page.getByRole("button",{name:"Nghe ví dụ 선생님입니다.",exact:true})).toBeVisible();
 await page.getByRole("navigation",{name:"Chọn mẫu câu"}).getByRole("button",{name:"입니까?",exact:true}).click();
 await expect(page.getByText("Dùng để hỏi lịch sự.",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Xem toàn bộ",exact:true}).click();
 await expect(page.getByRole("button",{name:"Nghe ví dụ 학생입니까?",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Nghe ví dụ 선생님입니다.",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("guided practice keeps all source-derived questions above 20 and resumes across reloads", async ({page}) => {
 await page.addInitScript(() => window.localStorage.setItem("haneul:auto-advance", "off"));
 const longLesson = {
  ...lesson,
  vocabulary: Array.from({length:25}, (_,i)=>({
   id:"long-v"+i,
   ko:"단어"+i,
   vi:"nghĩa "+i,
   example:"예문 "+i,
   sourceRef:"synthetic-book.pdf · p.1 · word-"+i
  })),
  grammar:[],
  dialogues:[],
  listening:[],
  speaking:[],
  reading:null,
  writing:null,
  pronunciation:[],
  culture:[],
  extraSections:[]
 };
 await page.unroute("**/api/courses");
 await page.route("**/api/courses",r=>r.fulfill({json:{
  activeCourseId:"long-guided-fixture",
  courses:[{id:"long-guided-fixture",title:"Long synthetic course",level:"test",lessons:[longLesson],questions:[]}]
 }}));
 await page.goto("/practice/quiz?lesson=1&mode=guided");
 const counter=page.locator(".session-hud-v3 strong");
 await expect(counter).toHaveText("1/75");
 await page.getByRole("button",{name:/nghĩa 0/}).click();
 await expect(page.getByRole("status")).toContainText("Chính xác!");
 await page.reload();
 await expect(counter).toHaveText("1/75");
 await expect(page.getByText("Đã khôi phục bài luyện đang dở: tiếp tục từ câu 1/75.")).toBeVisible();
 await page.locator(".session-footer-v3 .primary-button").click();
 await expect(counter).toHaveText("2/75");
 await page.reload();
 await expect(counter).toHaveText("2/75");
 await expect(page.getByText("Đã khôi phục bài luyện đang dở: tiếp tục từ câu 2/75.")).toBeVisible();
});
