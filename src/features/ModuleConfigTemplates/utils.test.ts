import { describe, expect, it } from "vitest";
import { placeholderMarkers } from "./utils";

const classes = (text: string, declared: string[]) =>
  placeholderMarkers(text, declared).map((m) => [m.className, text.split("\n")[m.startRow].slice(m.startCol, m.endCol)]);

describe("placeholderMarkers", () => {
  it("classifies declared variables, device metadata, escapes and invalid placeholders", () => {
    const text = '{\n  "a": "${host}:${port}",\n  "b": "${device.site.name}", "c": "$${host}", "d": "${bad name} ${nope}"\n}';
    expect(classes(text, ["host"])).toEqual([
      ["tpl-ph-variable", "${host}"],
      ["tpl-ph-invalid", "${port}"],
      ["tpl-ph-device", "${device.site.name}"],
      ["tpl-ph-escape", "$${"],
      ["tpl-ph-invalid", "${bad name}"],
      ["tpl-ph-invalid", "${nope}"],
    ]);
  });

  it("reports positions per line", () => {
    const [m] = placeholderMarkers('{\n  "x": "${a}"\n}', ["a"]);
    expect(m).toMatchObject({ startRow: 1, endRow: 1, startCol: 8, endCol: 12, type: "text" });
  });

  it("treats a bare 'device' reference as a variable name, not device metadata", () => {
    expect(classes('"${device}"', ["device"])[0][0]).toBe("tpl-ph-variable");
  });
});
