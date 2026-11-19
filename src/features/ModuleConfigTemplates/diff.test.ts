import { describe, expect, it } from "vitest";
import { canonicalJson, diffJson, diffLines, diffStats, foldUnchanged } from "./diff";

const summary = (lines: ReturnType<typeof diffLines>) => lines.map((l) => `${l.kind === "add" ? "+" : l.kind === "del" ? "-" : " "}${l.text}`);

describe("diffLines", () => {
  it("returns only unchanged lines for identical input", () => {
    expect(diffStats(diffLines(["a", "b"], ["a", "b"]))).toEqual({ added: 0, removed: 0 });
  });

  it("finds additions, removals and changes with line numbers", () => {
    const lines = diffLines(["a", "b", "c", "d"], ["a", "x", "c", "d", "e"]);
    expect(summary(lines)).toEqual([" a", "-b", "+x", " c", " d", "+e"]);
    expect(lines[1]).toMatchObject({ oldNo: 2, newNo: undefined });
    expect(lines[2]).toMatchObject({ oldNo: undefined, newNo: 2 });
    expect(lines[5]).toMatchObject({ newNo: 5 });
  });

  it("handles empty sides", () => {
    expect(diffStats(diffLines([], ["a", "b"]))).toEqual({ added: 2, removed: 0 });
    expect(diffStats(diffLines(["a"], []))).toEqual({ added: 0, removed: 1 });
  });
});

describe("diffJson", () => {
  it("ignores key order but not values", () => {
    expect(diffStats(diffJson({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }))).toEqual({ added: 0, removed: 0 });
    expect(summary(diffJson({ a: 1, b: 2 }, { a: 1, b: 3 }))).toEqual([" {", '   "a": 1,', '-  "b": 2', '+  "b": 3', " }"]);
  });

  it("canonicalizes nested keys", () => {
    expect(canonicalJson({ b: [{ z: 1, y: 2 }], a: 1 })).toBe(canonicalJson({ a: 1, b: [{ y: 2, z: 1 }] }));
  });
});

describe("foldUnchanged", () => {
  it("collapses long unchanged runs but keeps context around changes", () => {
    const before = Array.from({ length: 30 }, (_, i) => `l${i}`);
    const after = [...before];
    after[15] = "changed";
    const rows = foldUnchanged(diffLines(before, after), 2);
    const skips = rows.filter((r) => r.kind === "skip");
    expect(skips).toHaveLength(2);
    expect(skips.map((s) => s.kind === "skip" && s.count)).toEqual([13, 12]);
    expect(rows.filter((r) => r.kind !== "skip")).toHaveLength(6);
  });

  it("does not fold short runs", () => {
    expect(foldUnchanged(diffLines(["a", "b", "c"], ["a", "x", "c"]), 3).some((r) => r.kind === "skip")).toBe(false);
  });
});
