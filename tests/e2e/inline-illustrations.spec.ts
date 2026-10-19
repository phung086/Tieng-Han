import { expect, test } from "@playwright/test";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=","base64");
const lesson={id:1,title:"학교",vi:"Trường học",objective:"Synthetic test",sourceRef:"book.pdf pp.1-3",vocabulary:[{id:"school",ko:"학교",vi:"trường học",example:"학교에 갑니다."},{id:"library",ko:"도서관",vi:"thư viện",example:""}],grammar:[{id:"g",pattern:"에 가다",meaning:"đi tới",explanation:"Chỉ nơi đến.",examples:["학교에 갑니다."]}],listening:[],speaking:[],reading:null,writing:null,illustrations:[{id:"school-picture",kind:"vocabulary",targetIds:["school"],relation:"exact",fileName:"book.pdf",pageNumber:1,region:[.1,.2,.2,.2],alt:"학교",caption:"",sourceRef:"book.pdf p.1"}]};
test.beforeEach(async({page})=>{
 await page.route("**/api/courses",r=>r.fulfill({json:{activeCourseId:"course-inline",courses:[{id:"course-inline",title:"Synthetic",level:"test",lessons:[lesson],questions:[]}]}}));
 await page.route("**/api/auth/me",r=>r.fulfill({json:{configured:false,user:null}}));
 await page.route("**/illustrations?*",r=>r.fulfill({contentType:"image/png",body:png}));
});
test("teaches with an item image in the lesson, without opening a source page",async({page})=>{
 const sourceRequests:string[]=[];page.on("request",r=>{if(/\/(source-image|lesson-book)\?/.test(r.url()))sourceRequests.push(r.url());});
 await page.goto("/learn/1");
 await expect(page.getByRole("button",{name:"Bài học có hình",exact:true})).toHaveAttribute("aria-pressed","true");
 const words=page.getByRole("region",{name:"Học từ vựng cùng hình"});
 await expect(words.getByRole("img",{name:"학교",exact:true})).toBeVisible();
 await expect.poll(()=>words.getByRole("img",{name:"학교",exact:true}).evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 await expect(words.getByRole("heading",{name:"도서관"})).toBeVisible();
 await words.getByRole("button",{name:"trường học",exact:true}).click();
 await expect(words.getByRole("button",{name:"Hiện nghĩa để kiểm tra"})).toBeVisible();
 await expect(page.getByRole("figure",{name:"Sơ đồ câu ví dụ của mẫu 에 가다"})).toBeVisible();
 expect(sourceRequests).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test("flashcards carry only the current word image and missing images do not block study",async({page})=>{
 await page.goto("/vocabulary?lesson=1");
 await expect(page.getByRole("img",{name:"Hình gợi nhớ của mục từ"})).toBeVisible();
 await page.locator(".flashcard").click();
 await page.getByRole("button",{name:/Đã nhớ/}).click();
 await expect(page.locator(".flash-front")).toContainText("도서관");
 await expect(page.getByRole("img",{name:"Hình gợi nhớ của mục từ"})).toHaveCount(0);
 await page.route("**/illustrations?*",r=>r.fulfill({status:404}));
 await page.goto("/learn/1");
 await expect(page.getByText("Chưa tải được hình. Bạn vẫn có thể học nội dung bên dưới.")).toBeVisible();
 await expect(page.getByRole("heading",{name:"도서관"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Tải lại hình"})).toBeEnabled();
});
