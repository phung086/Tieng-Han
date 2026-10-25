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

const lessonTwo = {
  ...lesson,
  id: 2,
  title: "학교와 일상",
  vi: "Trường học và sinh hoạt",
  objective: "Mở rộng từ vựng và ngữ pháp sang bài tiếp theo.",
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
  lessons: [lesson, lessonTwo],
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

  await page.getByLabel("Tìm giáo trình").fill("Sơ cấp 2");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Sơ cấp 2");

  await page.getByLabel("Tìm giáo trình").fill("");
  await page.getByLabel("Lọc theo cấp độ").selectOption("중급 3");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Trung cấp 3");

  await page.getByLabel("Lọc theo cấp độ").selectOption("all");
  await cards.nth(1).click();
  await expect(page.locator(".journey-title-v2 h1")).toHaveText(courses[1].title);
  await expectNoPageOverflow(page);
});

test("all lessons remain open with zero progress and no completed activities", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "haneul-learning-state-v2:course-1",
      JSON.stringify({
        version: 2,
        xp: 30,
        streak: 1,
        dailyGoal: 50,
        todayXp: 30,
        lastActiveDate: null,
        lessonProgress: { "1": 33 },
        skills: {
          vocabulary: { correct: 1, total: 1 },
          grammar: { correct: 1, total: 1 },
          listening: { correct: 0, total: 0 },
          speaking: { correct: 0, total: 0 },
          reading: { correct: 0, total: 0 },
          writing: { correct: 0, total: 0 },
        },
        completedActivities: [],
        dailyStats: {},
        mastery: {},
      }),
    );
  });

  await page.goto("/learn");

  const lessonTwoCard = page.locator(".journey-stop-v2").filter({
    hasText: "Bài 02",
  });

  await expect(lessonTwoCard).toHaveClass(/available/);
  await expect(lessonTwoCard).toContainText("TỰ DO HỌC");
  await expect(
    lessonTwoCard.locator('a[href="/learn/2"]'),
  ).toHaveCount(1);
  await lessonTwoCard.locator('a[href="/learn/2"]').click();
  await expect(page).toHaveURL(/\/learn\/2$/);
  await page.getByLabel("Đổi bài").selectOption("1");
  await expect(page).toHaveURL(/\/learn\/1$/);
  await expect(page.getByRole("link", { name: "Sang Bài 2", exact: true })).toBeVisible();
});

test("speaking works without a microphone and never invents a pronunciation pass", async ({ page }) => {
  await page.goto("/speaking?lesson=1");
  await page.getByRole("button", { name: "Không dùng mic · tự luyện" }).click();
  await page.locator(".speaking-bottom .primary-button").click();
  await page.locator(".speaking-bottom .primary-button").click();
  await expect(page.getByRole("heading", { name: "Đã kết thúc lượt tự luyện" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tiếp:/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("haneul-learning-state-v2:course-1") || "{}").completedActivities ?? [])).not.toContain("lesson:1:speaking");
});

test("games retain the complete deck, record weak items and restore a graded turn", async ({ page }) => {
  await page.goto("/practice");
  const arcade = page.locator("#review-games");
  await arcade.getByLabel("Phạm vi trò chơi").selectOption("1");
  await arcade.getByRole("button", { name: "Bắt đầu chơi" }).click();
  await arcade.getByRole("button", { name: "Chưa nhớ · xem và ôn lại" }).click();
  await expect(arcade.getByRole("status")).toContainText("trường học");
  await page.reload();
  await arcade.getByLabel("Phạm vi trò chơi").selectOption("1");
  await arcade.getByRole("button", { name: "Bắt đầu chơi" }).click();
  await expect(arcade.getByRole("status")).toContainText("1 mục cần gặp lại");
  await arcade.getByRole("button", { name: "Chơi lại các mục sai" }).click();
  await expect(arcade.getByRole("heading", { name: "학교", exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("input questions can be answered by touch and skipped without a Korean keyboard", async ({ page }) => {
  await page.goto("/practice/quiz?lesson=1&skill=grammar");
  await page.getByRole("button",{name:"Tự chuyển câu đúng: Bật",exact:true}).click();
  await page.getByRole("button", { name: "Không có bàn phím tiếng Hàn · chạm để xếp" }).click();
  const pieces = page.getByLabel("Mảnh câu trả lời");
  // The generated pattern question uses the exact source pattern as its answer.
  for (const word of ["N은/는", "N입니다"]) await pieces.getByRole("button", { name: word, exact: true }).click();
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.getByText("Chính xác!", { exact: true })).toBeVisible();
  await page.locator(".session-footer .primary-button").click();
  await page.getByRole("button", { name: "Chưa làm được · xem đáp án và ôn lại" }).click();
  await expect(page.getByText("Đáp án đúng:")).toBeVisible();
  await expect(page.locator(".session-footer .primary-button")).toBeEnabled();
});

test("correct quiz answers auto-advance while wrong answers keep feedback visible", async ({
  page,
}) => {
  await page.goto("/practice/quiz?lesson=1&mode=quick");

  await expect(page.locator(".question-prompt")).toContainText("안녕하세요");
  await page.getByRole("button", { name: /Xin chào/ }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();

  await expect(page.locator(".question-prompt")).toContainText("학교", {
    timeout: 5_500,
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
  ).toBeVisible({ timeout: 5_500 });
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


test("account settings expose profile password and session controls without overflow", async ({
  page,
}) => {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        user: {
          id: "user-1",
          email: "learner@example.com",
          name: "Người học Haneul",
          role: "learner",
          avatarKey: "moon",
          joinedAt: "2026-10-01T00:00:00.000Z",
        },
      }),
    });
  });

  await page.route("**/api/me/sessions", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessions: [
            {
              id: "9f9cde4b-fac1-4e72-9920-3f9066251cb5",
              createdAt: "2026-10-07T00:00:00.000Z",
              lastSeenAt: "2026-10-07T01:00:00.000Z",
              expiresAt: "2026-11-06T00:00:00.000Z",
              userAgent:
                "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/154.0 Safari/537.36",
              current: true,
            },
            {
              id: "0fd442fb-e32d-45ec-b766-7e3d922e524d",
              createdAt: "2026-10-05T00:00:00.000Z",
              lastSeenAt: "2026-10-06T01:00:00.000Z",
              expiresAt: "2026-11-04T00:00:00.000Z",
              userAgent:
                "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/154.0 Mobile Safari/537.36",
              current: false,
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, revoked: 1 }),
    });
  });

  await page.goto("/settings");

  await expect(page.getByText("Tài khoản Haneul")).toBeVisible();
  await expect(page.getByLabel("Tên hiển thị")).toHaveValue("Người học Haneul");
  await expect(
    page.getByRole("button", { name: "Chọn avatar Mặt trăng" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Windows · Chrome · Thiết bị này/)).toBeVisible();
  await expect(page.getByText(/Android · Chrome/)).toBeVisible();
  await expect(page.locator('a[href="/import"]')).toHaveCount(0);
  await expectNoPageOverflow(page);
});


test("source workbook paginates long item groups and preserves progress across refresh", async ({ page }) => {
  const longLesson = {
    ...lesson,
    vocabulary: Array.from({ length: 45 }, (_, index) => ({
      id: "long-v-" + (index + 1),
      ko: "단어" + (index + 1),
      vi: "từ " + (index + 1),
      sourceRef: "synthetic-book.pdf · p.1 · vocabulary-" + (index + 1),
    })),
    grammar: [],
    listening: [],
    speaking: [],
    reading: null,
    writing: null,
    dialogues: [],
    pronunciation: [],
    culture: [],
    extraSections: [],
    media: [],
  };
  const longCourse = {
    ...courses[0],
    lessons: [longLesson, lessonTwo],
    questions: [],
  };
  const longCourses = [longCourse, ...courses.slice(1)];

  // Register after mockRuntime so this fixture takes precedence for this test.
  await page.route("**/api/courses", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ courses: longCourses, activeCourseId: longCourse.id }),
    });
  });

  await page.goto("/practice/workbook?lesson=1");

  const pager = page.getByRole("navigation", { name: "Phân trang Từ vựng" });
  const group = page.locator("details.lesson-content-card").filter({ has: pager });
  await expect(group.locator(".supplement-card")).toHaveCount(20);
  await expect(pager).toContainText("Trang 1/3 · mục 1–20/45");
  await expect(group.locator("summary")).toContainText("0/45 mục");

  await pager.getByRole("button", { name: "Trang tiếp theo trong nhóm Từ vựng" }).click();
  await expect(group.locator(".supplement-card")).toHaveCount(20);
  await expect(pager).toContainText("Trang 2/3 · mục 21–40/45");
  await group.getByRole("button", { name: "Đã luyện mục này" }).first().click();
  await expect(group.locator("summary")).toContainText("1/45 mục");

  await page.reload();
  const reloadedPager = page.getByRole("navigation", { name: "Phân trang Từ vựng" });
  const reloadedGroup = page.locator("details.lesson-content-card").filter({ has: reloadedPager });
  await expect(reloadedPager).toContainText("Trang 1/3 · mục 1–20/45");
  await expect(reloadedGroup.locator("summary")).toContainText("1/45 mục");

  // The completed item was on page 2 before reload; revisit that page to
  // verify its individual completion state survived, not just the aggregate.
  await reloadedPager.getByRole("button", { name: "Trang tiếp theo trong nhóm Từ vựng" }).click();
  await expect(reloadedGroup.getByRole("button", { name: "Đánh dấu chưa luyện" })).toHaveCount(1);
  await reloadedPager.getByRole("button", { name: "Trang tiếp theo trong nhóm Từ vựng" }).click();
  await expect(reloadedPager).toContainText("Trang 3/3 · mục 41–45/45");
  await expect(reloadedGroup.locator(".supplement-card")).toHaveCount(5);
  await expect(reloadedGroup.locator("summary")).toContainText("1/45 mục");
  await expectNoPageOverflow(page);
});
