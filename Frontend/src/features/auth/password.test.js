import { describe, expect, it } from "vitest";
import { passwordProblem } from "./password";

describe("passwordProblem (same rules as the server)", () => {
  it.each([
    ["abc123", /at least 8/],
    [`a1${"x".repeat(71)}`, /at most 72/],
    ["password-only", /letter and a number/],
    ["12345678", /letter and a number/]
  ])("rejects %s", (password, message) => {
    expect(passwordProblem(password)).toMatch(message);
  });

  it("accepts 8+ characters with a letter and a number", () => {
    expect(passwordProblem("new-pass-123")).toBe("");
  });
});
