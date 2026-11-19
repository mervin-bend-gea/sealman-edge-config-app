import { describe, expect, it } from "vitest";
import { jsonProblem } from "../jsonProblem";

describe("jsonProblem", () => {
  it("is null for valid JSON", () => {
    expect(jsonProblem('{"a": [1, 2, {"b": null}]}')).toBeNull();
  });

  it("locates a syntax error by line and column", () => {
    const problem = jsonProblem('{\n  "a": 1\n  "b": 2\n}');
    expect(problem).toMatchObject({ line: 2, column: 9 });
    expect(problem?.message).toMatch(/^Expected ','/);
    expect(problem?.message).not.toMatch(/position|line \d/);
  });

  it("reports a bad token where it is", () => {
    expect(jsonProblem('{\n  "a": tru\n}')).toMatchObject({ line: 2 });
  });

  it("points at the end of truncated input", () => {
    const problem = jsonProblem('{\n  "a": [1, 2');
    expect(problem?.line).toBe(2);
    expect(problem?.column).toBeGreaterThan(1);
  });

  it("hints at a trailing comma", () => {
    expect(jsonProblem('{\n  "a": 1,\n}')?.message).toMatch(/trailing comma/);
    expect(jsonProblem("[1, 2,]")?.message).toMatch(/trailing comma/);
  });
});
