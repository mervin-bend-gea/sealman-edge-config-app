import { describe, expect, it } from "vitest";
import {
  addSearchChip,
  buildSearchParameters,
  chipsToFilters,
  columnFiltersToRequest,
  getDeviceSearchJumpPath,
  readAssetsHighlight,
  SearchChip,
  splitByTerms,
} from "../deviceSearch";

const city: SearchChip = { type: "field", field: "city", label: "City", value: "Berlin" };

describe("buildSearchParameters", () => {
  it("offers Device ID, every metadata field, Endpoints and Services - in that order", () => {
    const parameters = buildSearchParameters([
      ["country_code", { label: "Country Code" }],
      ["city", { label: "City" }],
    ]);
    expect(parameters.map((p) => p.label)).toEqual([
      "Device ID",
      "Country Code",
      "City",
      "Endpoints",
      "Services",
    ]);
    expect(parameters[1]).toMatchObject({ type: "field", field: "country_code", exact: true });
    expect(parameters.filter((p) => p.fieldPicker).map((p) => p.fieldPicker)).toEqual(["endpoint", "service"]);
  });

  it("matches ids and fields exactly, everything else by containing", () => {
    const exact = Object.fromEntries(buildSearchParameters([["city", { label: "City" }]]).map((p) => [p.id, p.exact]));
    expect(exact).toEqual({ device_id: true, "field:city": true, endpoint: false, service: false });
  });
});

describe("addSearchChip", () => {
  it("adds a chip, trimmed", () => {
    expect(addSearchChip([], { ...city, value: "  Berlin " })).toEqual([city]);
  });

  it("ignores blank values and duplicates (ignoring case)", () => {
    const chips = [city];
    expect(addSearchChip(chips, { ...city, value: "   " })).toBe(chips);
    expect(addSearchChip(chips, { ...city, value: "berlin" })).toBe(chips);
  });

  it("keeps same value on a different field as a different chip", () => {
    expect(addSearchChip([city], { ...city, field: "region", label: "Region" })).toHaveLength(2);
  });
});

describe("request building", () => {
  it("turns chips into API filters, with the field only on field filters", () => {
    expect(
      chipsToFilters([city, { type: "endpoint", label: "Endpoints", value: "press" }]),
    ).toEqual([
      { type: "field", field: "city", value: "Berlin" },
      { type: "endpoint", value: "press" },
    ]);
  });

  it("sends the field of an endpoint chip on one field", () => {
    expect(
      chipsToFilters([{ type: "endpoint", field: "serial", label: "Endpoints \u203a Serial", value: "123456" }]),
    ).toEqual([{ type: "endpoint", field: "serial", value: "123456" }]);
  });

  it("turns column selections into column filters, leaving out empty ones", () => {
    expect(columnFiltersToRequest({ city: ["Berlin", "LKO"], country_code: [] })).toEqual([
      { field: "city", values: ["Berlin", "LKO"] },
    ]);
  });
});

describe("getDeviceSearchJumpPath", () => {
  it("always sends every match type to the device's Assets page", () => {
    expect(getDeviceSearchJumpPath("1230", { kind: "device_id", fields: [] })).toBe("/devices/1230/assets");
    expect(getDeviceSearchJumpPath("1230", { kind: "metadata", fields: [] })).toBe("/devices/1230/assets");
  });

  it("sends endpoints and services to the Assets page, naming the endpoint to flash", () => {
    expect(getDeviceSearchJumpPath("1230", { kind: "endpoint", fields: [], endpoint_id: "e1" })).toBe(
      "/devices/1230/assets?highlight=e1",
    );
    expect(
      getDeviceSearchJumpPath("1230", { kind: "service", fields: [], endpoint_id: "e 1", service_id: "s1" }),
    ).toBe("/devices/1230/assets?highlight=e+1");
  });
});

describe("readAssetsHighlight", () => {
  it("reads the endpoint id from the location search", () => {
    expect(readAssetsHighlight("?highlight=e1")).toBe("e1");
    expect(readAssetsHighlight("")).toBeNull();
    expect(readAssetsHighlight("?highlight=")).toBeNull();
  });
});

describe("splitByTerms", () => {
  it("marks every occurrence of every term, ignoring case", () => {
    expect(splitByTerms("Berlin Mitte", ["BER", "mit"])).toEqual([
      { text: "Ber", match: true },
      { text: "lin ", match: false },
      { text: "Mit", match: true },
      { text: "te", match: false },
    ]);
  });

  it("merges overlapping matches", () => {
    expect(splitByTerms("abcd", ["abc", "bcd"])).toEqual([{ text: "abcd", match: true }]);
  });

  it("returns the text unmarked when nothing matches", () => {
    expect(splitByTerms("Berlin", ["x", " "])).toEqual([{ text: "Berlin", match: false }]);
  });
});
