import { describe, expect, it } from "vitest";
import { isCourseStatusAccessible } from "@/lib/db/course-access";

describe("course access policy", () => {
  it("lets learners access only published courses", () => {
    expect(isCourseStatusAccessible("learner", "published")).toBe(true);
    expect(isCourseStatusAccessible("learner", "draft")).toBe(false);
    expect(isCourseStatusAccessible("learner", "archived")).toBe(false);
    expect(isCourseStatusAccessible("learner", null)).toBe(false);
  });

  it("lets admins access every catalogued course status", () => {
    expect(isCourseStatusAccessible("admin", "published")).toBe(true);
    expect(isCourseStatusAccessible("admin", "draft")).toBe(true);
    expect(isCourseStatusAccessible("admin", "archived")).toBe(true);
    expect(isCourseStatusAccessible("admin", null)).toBe(false);
  });
});
