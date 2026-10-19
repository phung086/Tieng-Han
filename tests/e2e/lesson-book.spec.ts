import { expect, test } from "@playwright/test";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const course = { id: "course-import-book-e2e", title: "Synthetic illustrated book", level: "test", source: { importJobId: "import-book-e2e", fileName: "book.pdf", pageCount: 40 }, questions: [],
  lessons: [1,2].map(id => ({ id, title: "학교", vi: "Trường học " + id, objective: "Synthetic test, not textbook content", sourceRef: "book.pdf pp.1-23; appendix pp.31-32",
    vocabulary: Array.from({ length: 28 }, (_, i) => ({ id: id + "-v" + i, ko: "단어" + i, vi: "nghĩa " + i, example: "", sourceRef: "book.pdf p.2" })),
    grammar: [{ id: "g", pattern: "입니다", meaning: "là", explanation: "Source explanation", examples: ["학생입니다."], sourceRef: "book.pdf p.3" }], listening: [], speaking: [], reading: null, writing: null })) };
const pages = [...Array.from({ length: 23 }, (_, i) => ({ documentId: "doc-0", fileName: "book.pdf", pageNumber: i + 1, role: "lesson" })), ...[31,32].map(pageNumber => ({ documentId: "doc-0", fileName: "book.pdf", pageNumber, role: "related" }))];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/courses", route => route.fulfill({ json: { courses: [course], activeCourseId: course.id } }));
  await page.route("**/api/auth/me", route => route.fulfill({ json: { configured: false, user: null } }));
  await page.route("**/lesson-book?*", route => route.fulfill({ json: { documents: [{ documentId: "doc-0", fileName: "book.pdf", pageCount: 40 }], pages, issues: [] } }));
  await page.route("**/source-image?*", route => new URL(route.request().url()).searchParams.get("page") === "31" ? route.fulfill({ status: 404, json: { error: "Missing original image" } }) : route.fulfill({ contentType: "image/png", body: png }));
  await page.route("**/source?*", route => route.fulfill({ json: { page: { text: "Complete source transcript, independent of illustration status." } } }));
});

test("illustrated book opens every page, zooms locally and restores reading position", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", request => { if (request.url().includes("/source-image?")) requested.push(new URL(request.url()).searchParams.get("page")!); });
  await page.goto("/learn/1");
  await expect(page.getByRole("button", { name: "Bài học có hình", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Sách gốc", exact: true }).click();
  const book = page.getByRole("region", { name: "Sách điện tử có hình minh họa", exact: true });
  await expect(book.getByRole("img", { name: /Trang sách gốc 1 / })).toBeVisible();
  await expect(book.getByLabel("Chọn trang sách trong bài").locator("option")).toHaveCount(25);
  await expect.poll(() => requested).toEqual(["1"]);
  await book.getByLabel("Chọn trang sách trong bài").selectOption("22");
  await expect(book.getByRole("img", { name: /Trang sách gốc 23 / })).toBeVisible();
  await expect(book.getByRole("img", { name: /Trang sách gốc/ })).toHaveCount(1);
  await book.getByRole("button", { name: "Phóng to trang sách" }).click();
  await expect(book.getByText("125%", { exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await book.getByLabel("Chọn trang sách trong bài").selectOption("1");
  await expect(book.getByRole("img", { name: /Trang sách gốc/ })).toHaveCount(1);
  await expect(book.getByRole("definition")).toHaveCount(28);
  await page.reload();
  await page.getByRole("button", { name: "Sách gốc", exact: true }).click();
  await expect(book.getByRole("img", { name: /Trang sách gốc 2 / })).toBeVisible();
  await expect.poll(() => book.getByRole("img", { name: /Trang sách gốc/ }).evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await book.getByLabel("Phạm vi đọc sách").selectOption("document");
  await expect(book.getByLabel("Chọn trang sách trong bài").locator("option")).toHaveCount(40);
  await book.getByLabel("Chọn trang sách trong bài").selectOption("39");
  await expect(book.getByRole("img", { name: /Trang sách gốc 40 / })).toBeVisible();
  await expect(book.getByRole("img", { name: /Trang sách gốc/ })).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Sách gốc", exact: true }).click();
  await expect(book.getByLabel("Phạm vi đọc sách")).toHaveValue("document");
  await expect(book.getByRole("img", { name: /Trang sách gốc 40 / })).toBeVisible();
  await page.getByRole("button", { name: "Từ vựng", exact: true }).click();
  await page.goto("/learn/1?page=2&file=book.pdf");
  await expect(page.getByRole("button", { name: "Sách gốc", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(book.getByRole("img", { name: /Trang sách gốc 2 / })).toBeVisible();
});

test("missing illustrations remain visible and never block text or the next page", async ({ page }) => {
  await page.goto("/learn/1?page=31&file=book.pdf");
  const book = page.getByRole("region", { name: "Sách điện tử có hình minh họa", exact: true });
  await expect(book.getByRole("alert")).toContainText("Chưa tải được ảnh trang 31");
  await book.getByText("Đọc văn bản hỗ trợ / dùng trình đọc màn hình", { exact: true }).click();
  await expect(book.getByText("Complete source transcript, independent of illustration status.")).toBeVisible();
  await book.getByRole("button", { name: "Trang sau của bài" }).click();
  await expect(book.getByRole("img", { name: /Trang sách gốc 32 / })).toBeVisible();
  await page.getByLabel("Đổi bài").selectOption("2");
  await expect(page).toHaveURL(/\/learn\/2$/);
});
