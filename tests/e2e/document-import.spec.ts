import { test, expect } from "@playwright/test";
import JSZip from "jszip";

// Synthetic source, created at test time. No copyrighted textbook fixture.
async function docxFixture() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const paragraphs = Array.from({ length: 130 }, (_, index) => `<w:p><w:r><w:t>학생 ${index + 1} — Mục nguồn ${index + 1}</w:t></w:r></w:p>`).join("");
  const table = '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>학교</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>trường học</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}${table}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

test("uploads every DOCX paragraph and table with explicit logical source locations, without an AI key", async ({ page }) => {
  const uploaded: Array<{ pageNumber: number; text: string; sourceLocation?: string }> = [];
  let created: Record<string, unknown> | undefined;
  await page.route("**/api/ingest/status", route => route.fulfill({ json: { configured: false } }));
  await page.route("**/api/mcp-bridge/status", route => route.fulfill({ json: { configured: false, activeSubscriptions: 0 } }));
  await page.route("**/api/import-jobs**", async route => {
    const request = route.request();
    if (request.method() === "PUT") {
      uploaded.push(...request.postDataJSON().pages);
      return route.fulfill({ json: { ok: true } });
    }
    if (request.method() === "POST") {
      created = request.postDataJSON();
      return route.fulfill({ status: 201, json: { job: { id: "import-docx-synthetic", status: "uploading" } } });
    }
    if (request.method() === "PATCH") return route.fulfill({ json: { job: { id: "import-docx-synthetic", status: "queued" } } });
    return route.fulfill({ json: { jobs: [], job: { id: "import-docx-synthetic", status: "queued" } } });
  });
  await page.goto("/import");
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({
    name: "synthetic-source.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: await docxFixture(),
  });
  await expect.poll(() => uploaded.length, { timeout: 20_000 }).toBe(131);
  expect(created?.documents).toEqual([expect.objectContaining({ pageCount: 131, pagination: "logical-blocks" })]);
  expect(uploaded[129].text).toContain("Mục nguồn 130");
  expect(uploaded[130].text).toContain("학교");
  expect(uploaded[130].text).toContain("trường học");
  expect(uploaded.every(item => item.sourceLocation?.includes("not a printed page"))).toBe(true);
  await expect(page.getByText("DOCX dùng chỉ mục khối nội dung", { exact: false })).toBeVisible();
});
