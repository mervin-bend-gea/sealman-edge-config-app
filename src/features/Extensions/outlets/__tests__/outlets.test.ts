import { describe, expect, it } from "vitest";
import { isSupportedOutlet } from "../outlets";

describe("module outlets", () => {
  it.each(["tab", "replace:config", "replace:page"])("renders module/%s", (placement) => {
    expect(isSupportedOutlet("module", placement)).toBe(true);
  });

  it("ignores placements the module page does not have", () => {
    expect(isSupportedOutlet("module", "section")).toBe(false);
    expect(isSupportedOutlet("module", "replace:tabs")).toBe(false);
  });
});
