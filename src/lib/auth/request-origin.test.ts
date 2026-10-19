import { expect, it } from "vitest";
import { isSameOrigin } from "@/lib/auth/request-origin";
it("checks the browser destination when Docker binds to 0.0.0.0", () => {
  expect(isSameOrigin(new Request("http://0.0.0.0:3000/api/auth/login", { headers: { host: "localhost:3000", origin: "http://localhost:3000" } }))).toBe(true);
  expect(isSameOrigin(new Request("http://0.0.0.0:3000/api/auth/login", { headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" } }))).toBe(true);
});
it("rejects foreign origins, port changes and forwarded-host spoofing", () => {
  for (const origin of ["http://evil.example", "https://localhost:3000", "http://localhost:3001", "null"]) {
    expect(isSameOrigin(new Request("http://0.0.0.0:3000/api/auth/login", { headers: { host: "localhost:3000", origin, "x-forwarded-host": "evil.example" } }))).toBe(false);
  }
});
it("retains direct requests and rejects malformed host headers", () => {
  expect(isSameOrigin(new Request("http://localhost:3000/api/auth/login", { headers: { origin: "http://localhost:3000" } }))).toBe(true);
  expect(isSameOrigin(new Request("http://localhost:3000/api/auth/login"))).toBe(true);
  expect(isSameOrigin(new Request("http://localhost:3000/api/auth/login", { headers: { origin: "http://evil.example", host: "evil.example/path" } }))).toBe(false);
});
