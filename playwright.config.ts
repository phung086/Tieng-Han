import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { randomUUID } from "node:crypto";

const testRuntime = path.resolve(".haneul", "e2e-runtime");
const testToken = process.env.HANEUL_E2E_MCP_TOKEN ||= randomUUID();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3107",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
  webServer: {
    command: "pnpm start --hostname 127.0.0.1 --port 3107",
    url: "http://127.0.0.1:3107",
    reuseExistingServer: false,
    env: {
      DATABASE_URL: "", OPENAI_API_KEY: "", HANEUL_MCP_TOKEN: testToken,
      HANEUL_IMPORT_DIR: path.join(testRuntime, "import-jobs"),
      HANEUL_EVENT_DIR: path.join(testRuntime, "mcp-events"),
      HANEUL_COURSE_LIBRARY: path.join(testRuntime, "courses"),
      HANEUL_ACTIVE_COURSE_FILE: path.join(testRuntime, "active-course.json"),
    },
    timeout: 120_000,
  },
});
