import { expect, test } from "@playwright/test";

const words = Array.from({ length: 13 }, (_, i) => ({
  id: "v-" + i,
  ko: "단어" + i,
  vi: "nghĩa " + i,
  example: "저는 단어" + i + " 좋아합니다.",
  sourceRef: "Sơ cấp 1 trang " + (20 + i),
}));

const course = {
  id: "course-drills-e2e",
  title: "Sơ cấp 1",
  level: "초급 1",
  language: {
    target: "ko", learner: "vi",
    targetName: "Tiếng Hàn", learnerName: "Tiếng Việt",
    locale: "ko-KR", script: "hangul",
  },
  lessons: [{
    id: 1,
    title: "제1과",
    vi: "Bài 1",
    objective: "Tập từ mới",
    vocabulary: words,
    grammar: [{
      id: "grammar-1",
      pattern: "-입니다",
      meaning: "là",
      explanation: "Giới thiệu",
      examples: ["저는 학생입니다."],
      sourceRef: "Sơ cấp 1 trang 40",
    }],
    listening: [{
      id: "listening-1", text: "안녕하세요.", meaning: "Xin chào",
      choices: ["안녕하세요.", "감사합니다."], answer: "안녕하세요.",
    }],
    speaking: ["반갑습니다."],
    reading: null,
    writing: null,
    dialogues: [{
      id: "dialogue-1",
      title: "Đối thoại",
      sourceRef: "Sơ cấp 1 trang 35",
      lines: [{ speaker: "A", ko: "안녕하세요.", vi: "Xin chào." }],
    }],
  }],
  questions: [],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/courses", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      courses: [course], activeCourseId: course.id,
    }) }),
  );
  await page.route("**/api/auth/me", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      configured: false, user: null,
    }) }),
  );
});

test("real textbook drill screen grades one entry and resumes the next across refresh", async ({ page }) => {
  await page.goto("/practice/drills?lesson=1");
  await expect(page.getByRole("heading", { name: "Luyện theo dạng bài" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Điền từ.*14 câu/ })).toBeVisible();
  await expect(page.getByText("Điền từ vựng 1")).toBeVisible();
  await expect(page.getByText("저는 ＿＿＿ 좋아합니다.")).toBeVisible();
  await page.getByLabel("Câu trả lời của bạn").fill("단어0");
  await page.getByRole("button", { name: "Kiểm tra câu trả lời" }).click();
  await expect(page.getByText("Khớp câu mẫu!")).toBeVisible();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(page.getByText("Điền từ vựng 2")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Điền từ vựng 2")).toBeVisible();
  await expect(page.getByText(/Đã khôi phục lượt luyện trước/)).toBeVisible();
});

test("translation and dictation modes use the imported dialogue, not invented examples", async ({ page }) => {
  await page.goto("/practice/drills?lesson=1");
  await page.getByRole("button", { name: /Luyện dịch.*1 câu/ }).click();
  await expect(page.getByText("Xin chào.", { exact: true })).toBeVisible();
  await page.getByLabel("Câu trả lời của bạn").fill("안녕하세요.");
  await page.getByRole("button", { name: "Kiểm tra câu trả lời" }).click();
  await expect(page.getByText("Khớp câu mẫu!")).toBeVisible();

  await page.getByRole("button", { name: /Nghe chép.*\d+ câu/ }).click();
  await expect(page.getByRole("button", { name: "Nghe chậm" })).toBeVisible();
  await expect(page.getByLabel("Câu trả lời của bạn")).toBeVisible();

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
