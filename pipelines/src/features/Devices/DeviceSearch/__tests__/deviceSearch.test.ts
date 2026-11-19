import { describe, expect, it } from "vitest";
import type { DeviceSearchMatch } from "@/generated/edge-administration/hooks/devices/useSearchDevices";
import { getDeviceSearchJumpPath, readAssetsHighlight, splitByTerm } from "../deviceSearch";

const match = (m: Partial<DeviceSearchMatch> & Pick<DeviceSearchMatch, "kind">): DeviceSearchMatch => ({ fields: [], ...m });

describe("getDeviceSearchJumpPath", () => {
  it("sends device id and metadata matches to the device's Info page", () => {
    expect(getDeviceSearchJumpPath("1230", match({ kind: "device_id" }))).toBe("/devices/1230");
    expect(getDeviceSearchJumpPath("1230", match({ kind: "metadata" }))).toBe("/devices/1230");
  });

  it("sends endpoint matches to the Assets page, highlighting the endpoint", () => {
    expect(getDeviceSearchJumpPath("1230", match({ kind: "endpoint", endpoint_id: "e 1" }))).toBe(
      "/devices/1230/assets?highlight=e+1",
    );
  });

  it("sends service matches to the Assets page, highlighting the endpoint that owns the service", () => {
    expect(getDeviceSearchJumpPath("1230", match({ kind: "service", endpoint_id: "e1", service_id: "s1" }))).toBe(
      "/devices/1230/assets?highlight=e1",
    );
  });
});

describe("readAssetsHighlight", () => {
  it("reads the endpoint id from the query string", () => {
    expect(readAssetsHighlight("?highlight=e1")).toBe("e1");
    expect(readAssetsHighlight("?highlight=e+1")).toBe("e 1");
  });
  it("is null when absent or empty", () => {
    expect(readAssetsHighlight("")).toBeNull();
    expect(readAssetsHighlight("?highlight=")).toBeNull();
  });
});

describe("splitByTerm", () => {
  it("marks every case-insensitive occurrence", () => {
    expect(splitByTerm("My test Machine 1", "ma")).toEqual([
      { text: "My test ", match: false },
      { text: "Ma", match: true },
      { text: "chine 1", match: false },
    ]);
    expect(splitByTerm("aXa", "a").filter((p) => p.match)).toHaveLength(2);
  });
  it("treats regex characters literally and handles empty terms", () => {
    expect(splitByTerm("a.b", ".")).toEqual([
      { text: "a", match: false },
      { text: ".", match: true },
      { text: "b", match: false },
    ]);
    expect(splitByTerm("abc", "  ")).toEqual([{ text: "abc", match: false }]);
  });
});
