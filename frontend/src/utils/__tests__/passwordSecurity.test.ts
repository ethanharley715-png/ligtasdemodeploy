import { describe, test, expect } from "vitest";
import { analyzePassword } from "../passwordSecurity";

describe("analyzePassword", () => {
  test("returns weak for very short password", () => {
    const result = analyzePassword("123");
    expect(result.strength).toBe("weak");
  });

  test("returns medium for partially valid password", () => {
    const result = analyzePassword("Password1");
    expect(result.strength).toBe("medium");
  });

  test("returns strong for secure password", () => {
    const result = analyzePassword("StrongPass1!");
    expect(result.strength).toBe("strong");
  });

  test("detects common password", () => {
    const result = analyzePassword("password");
    expect(result.checks.notCommon).toBe(false);
  });

  test("passes all checks for strong password", () => {
    const result = analyzePassword("StrongPass1!");
    expect(result.checks.lengthValid).toBe(true);
    expect(result.checks.uppercase).toBe(true);
    expect(result.checks.number).toBe(true);
    expect(result.checks.special).toBe(true);
    expect(result.checks.notCommon).toBe(true);
  });
});