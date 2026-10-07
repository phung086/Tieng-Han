import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminApiAccess } from "@/lib/auth/api-guard";
import { getCurrentUser, isSameOrigin } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  isDatabaseConfigured: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getCurrentUser: vi.fn(),
  isSameOrigin: vi.fn(),
}));

describe("admin API guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSameOrigin).mockReturnValue(true);
  });

  it("keeps local-first APIs available when PostgreSQL is disabled", async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false);

    await expect(requireAdminApiAccess()).resolves.toBeNull();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("rejects cross-origin mutations before auth checks", async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(true);
    vi.mocked(isSameOrigin).mockReturnValue(false);

    const response = await requireAdminApiAccess(
      new Request("http://localhost/api/import-jobs", {
        method: "POST",
        headers: { origin: "https://example.com" },
      }),
      { mutation: true },
    );

    expect(response?.status).toBe(403);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("requires authentication when the database is enabled", async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(true);
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const response = await requireAdminApiAccess(
      new Request("http://localhost/api/import-jobs"),
    );

    expect(response?.status).toBe(401);
  });

  it("rejects authenticated learners", async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(true);
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "learner-1",
      email: "learner@example.com",
      name: "Learner",
      role: "learner",
    });

    const response = await requireAdminApiAccess(
      new Request("http://localhost/api/import-jobs"),
    );

    expect(response?.status).toBe(403);
  });

  it("allows authenticated admins", async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(true);
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      name: "Admin",
      role: "admin",
    });

    await expect(
      requireAdminApiAccess(
        new Request("http://localhost/api/import-jobs"),
      ),
    ).resolves.toBeNull();
  });
});
