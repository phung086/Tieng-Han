import { expect, test, type Page } from "@playwright/test";

const lesson = {
  id: 1,
  title: "자기소개와 학교 생활",
  vi: "Giới thiệu bản thân và trường học",
  objective:
    "Tự giới thiệu, nói về trường học và dùng các mẫu câu cơ bản trong hội thoại hằng ngày.",
  vocabulary: [
    {
      id: "v-1",
      ko: "학교",
      vi: "trường học",
      example: "저는 학교에 갑니다.",
    },
  ],
  grammar: [
    {
      id: "g-1",
      pattern: "N은/는 N입니다",
      meaning: "N là N",
      explanation: "Mẫu câu giới thiệu cơ bản.",
      examples: ["저는 학생입니다."],
    },
  ],
  listening: [
    {
      id: "l-1",
      text: "저는 학생입니다.",
      meaning: "Tôi là học sinh.",
      choices: ["Tôi là học sinh.", "Tôi là giáo viên.", "Tôi đi học."],
      answer: "Tôi là học sinh.",
    },
    {
      id: "l-2",
      text: "학교에 갑니다.",
      meaning: "Tôi đi đến trường.",
      choices: ["Tôi đi đến trường.", "Tôi về nhà.", "Tôi ăn cơm."],
      answer: "Tôi đi đến trường.",
    },
  ],
  speaking: ["저는 학생입니다.", "학교에 갑니다."],
  reading: {
    title: "민수의 학교",
    text: "민수 씨는 학생입니다. 아침에 학교에 갑니다. 학교에서 한국어를 공부합니다.",
    translation:
      "Minsu là học sinh. Buổi sáng cậu ấy đi đến trường. Cậu ấy học tiếng Hàn ở trường.",
    questions: [
      {
        id: "read-1",
        q: "민수 씨는 아침에 어디에 갑니까?",
        choices: ["회사", "학교", "은행"],
        answer: "학교",
      },
      {
        id: "read-2",
        q: "민수 씨는 학교에서 무엇을 공부합니까?",
        choices: ["영어", "한국어", "수학"],
        answer: "한국어",
      },
    ],
  },
  writing: {
    prompt: "Viết 3 câu giới thiệu bản thân.",
    hint: "Dùng 저는 ...입니다.",
    targetWords: ["저는", "학생"],
  },
  dialogues: [
    {
      id: "d-1",
      title: "처음 만났을 때",
      lines: [
        { speaker: "A", ko: "안녕하세요?", vi: "Xin chào." },
        { speaker: "B", ko: "안녕하세요. 저는 민수입니다.", vi: "Xin chào. Tôi là Minsu." },
      ],
    },
    {
      id: "d-2",
      title: "학교에서",
      lines: [
        { speaker: "A", ko: "어디에 갑니까?", vi: "Bạn đi đâu?" },
        { speaker: "B", ko: "학교에 갑니다.", vi: "Tôi đi đến trường." },
      ],
    },
  ],
  pronunciation: [
    {
      id: "p-1",
      title: "받침 연음",
      explanation: "Luyện nối âm cơ bản trong cụm từ ngắn.",
      examples: ["한국어", "학생입니다"],
    },
  ],
  culture: [],
  extraSections: [],
  media: [],
};

const questions = [
  {
    id: "q-1",
    lessonId: 1,
    skill: "vocabulary",
    type: "choice",
    title: "Chọn nghĩa đúng",
    prompt: "안녕하세요",
    choices: ["Xin chào", "Cảm ơn", "Tạm biệt"],
    answer: "Xin chào",
    explanation: "안녕하세요 nghĩa là xin chào.",
  },
  {
    id: "q-2",
    lessonId: 1,
    skill: "vocabulary",
    type: "choice",
    title: "Chọn nghĩa đúng",
    prompt: "학교",
    choices: ["nhà", "trường học", "công ty"],
    answer: "trường học",
    explanation: "학교 nghĩa là trường học.",
  },
];

const makeCourse = (id: string, title: string, level: string) => ({
  id,
  title,
  level,
  language: {
    target: "ko",
    learner: "vi",
    targetName: "Tiếng Hàn",
    learnerName: "Tiếng Việt",
    locale: "ko-KR",
    script: "hangul",
  },
  source: {
    fileName: title + " - source textbook file with a very long name.pdf",
    pageCount: 380,
    importedAt: "2026-10-07T00:00:00.000Z",
  },
  lessons: [lesson],
  questions,
});

const courses = [
  makeCourse(
    "course-1",
    "Tiếng Hàn Sơ cấp 1 dành cho người Việt Nam — phiên bản đầy đủ",
    "초급 1",
  ),
  makeCourse(
    "course-2",
    "Sách bài tập bổ trợ Tiếng Hàn tổng hợp Sơ cấp 2 với tiêu đề rất dài",
    "초급 2",
  ),
  makeCourse(
    "course-3",
    "Tiếng Hàn tổng hợp dành cho người Việt Nam Trung cấp 3",
    "중급 3",
  ),
  makeCourse(
    "course-4",
    "Giáo trình luyện phản xạ giao tiếp và ngữ pháp theo tình huống",
    "Practice",
  ),
];

async function mockRuntime(page: Page) {
  await page.route("**/api/courses", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        courses,
        activeCourseId: courses[0].id,
      }),
    });
  });

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: false, user: null }),
    });
  });

  await page.route("**/api/me/enrollments", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));

  expect(overflow.html).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await mockRuntime(page);
});

test("course library keeps long titles readable and switches course cleanly", async ({
  page,
}) => {
  await page.goto("/learn");

  const cards = page.locator(".course-library-card-v2");
  await expect(cards).toHaveCount(4);
  await expectNoPageOverflow(page);

  for (let index = 0; index < 4; index += 1) {
    const box = await cards.nth(index).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(260);
  }

  await cards.nth(1).click();
  await expect(page.locator(".journey-title-v2 h1")).toHaveText(courses[1].title);
  await expectNoPageOverflow(page);
});

test("correct quiz answers auto-advance while wrong answers keep feedback visible", async ({
  page,
}) => {
  await page.goto("/practice/quiz?lesson=1&mode=quick");

  await expect(page.locator(".question-prompt")).toContainText("안녕하세요");
  await page.getByRole("button", { name: /Xin chào/ }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();

  await expect(page.locator(".question-prompt")).toContainText("학교", {
    timeout: 2_500,
  });

  await page.getByRole("button", { name: /nhà/ }).click();
  await expect(page.getByText(/Chưa đúng/)).toBeVisible();
  await page.waitForTimeout(1_100);
  await expect(page.locator(".question-prompt")).toContainText("학교");
});

test("reading shows one question at a time and auto-advances on a correct answer", async ({
  page,
}) => {
  await page.goto("/reading?lesson=1");

  await expect(page.getByText("민수 씨는 아침에 어디에 갑니까?")).toBeVisible();
  await expect(
    page.getByText("민수 씨는 학교에서 무엇을 공부합니까?"),
  ).not.toBeVisible();

  await page
    .locator(".reading-choice-row button")
    .filter({ hasText: "학교" })
    .click();

  await expect(
    page.getByText("민수 씨는 학교에서 무엇을 공부합니까?"),
  ).toBeVisible({ timeout: 2_500 });
  await expectNoPageOverflow(page);
});

test("core learner and account routes avoid document-level horizontal overflow", async ({
  page,
}) => {
  const routes = [
    "/",
    "/learn",
    "/practice",
    "/review",
    "/stats",
    "/profile",
    "/settings",
    "/vocabulary?lesson=1",
    "/grammar?lesson=1",
    "/listening?lesson=1",
    "/speaking?lesson=1",
    "/reading?lesson=1",
    "/writing?lesson=1",
    "/conversation?lesson=1",
    "/pronunciation?lesson=1",
    "/login",
    "/register",
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("body")).toBeVisible();
    await expectNoPageOverflow(page);
  }
});
