import { describe, expect, it } from "vitest";
import { insertList, insertPlaceholder, insertRef, placeholderHelp, placeholderMarkers, refMarkers, syncVariables } from "./utils";

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

describe("service placeholders", () => {
  it("are highlighted like endpoint placeholders", () => {
    expect(classes('"${service[machine].port}"', [])).toEqual([["tpl-ph-endpoint", "${service[machine].port}"]]);
  });
});

describe("block references in the text", () => {
  const body = '{\n  "clients": {\n    "separatorA": {"$ref": "Client"},\n    "separatorB": { "$ref": "Client" }\n  },\n  "x": 1\n}';

  it("writes the reference as the value at the cursor, else under a new key in the root", () => {
    // cursor on the value 1 of "x"
    expect(JSON.parse(insertRef(body, { row: 5, column: 8 }, "Items")).x).toEqual({ $ref: "Items" });
    // cursor on a key: not a value position
    const added = insertRef('{\n  "block1": 0\n}', { row: 1, column: 4 }, "Items");
    expect(added).toBe('{\n  "block1": 0,\n  "block2": { "$ref": "Items" }\n}');
    // JSON being typed: at the cursor, with a comma before the next member
    expect(insertRef('{\n  "Operations": \n  "x": 1\n}', { row: 1, column: 16 }, "Items"))
      .toBe('{\n  "Operations": { "$ref": "Items" },\n  "x": 1\n}');
  });
});

describe("insertList", () => {
  it("writes the list as the value at the cursor", () => {
    expect(insertList('{\n  "clients": \n}', { row: 1, column: 13 }, ["ClientSeparator", "ClientDecanter"]))
      .toBe('{\n  "clients": { "$list": ["ClientSeparator", "ClientDecanter"] }\n}');
  });
});

describe("insertList label", () => {
  it("writes $label next to $list when a label is given", () => {
    expect(insertList('{\n  "SlaveConfigs": \n}', { row: 1, column: 18 }, ["SlaveA"], "Slave"))
      .toBe('{\n  "SlaveConfigs": { "$list": ["SlaveA"], "$label": "Slave" }\n}');
  });
  it("replaces the whole list when the cursor is on the $label value", () => {
    const text = '{\n  "s": { "$list": ["A"], "$label": "Slave" }\n}';
    expect(insertList(text, { row: 1, column: 36 }, ["B"])).toBe('{\n  "s": { "$list": ["B"] }\n}');
  });
});

describe("refMarkers", () => {
  it("marks $ref references and the $list key", () => {
    const text = '{ "a": { "$ref": "X" }, "b": { "$list": ["X", "Y"] } }';
    expect(refMarkers(text).map((m) => text.slice(m.startCol, m.endCol))).toEqual(['"$ref": "X"', '"$list"']);
  });
});

describe("insertPlaceholder", () => {
  it("writes into the string under the cursor, else as a string value", () => {
    expect(insertPlaceholder('{ "u": "opc.tcp://" }', { row: 0, column: 18 }, "endpoint.ip")).toBe('{ "u": "opc.tcp://${endpoint.ip}" }');
    expect(insertPlaceholder('{ "p": }', { row: 0, column: 7 }, "service.port")).toBe('{ "p": "${service.port}"}');
  });
});

describe("placeholderHelp", () => {
  it("explains the placeholder under the mouse and new variables", () => {
    const text = '{ "u": "${endpoint[plc].ip}:${service.port}", "x": "${typo}" }';
    expect(placeholderHelp(text, { row: 0, column: 12 }, [])).toContain('"Endpoint: plc" dropdown');
    expect(placeholderHelp(text, { row: 0, column: 34 }, [])).toContain("Port of the service");
    expect(placeholderHelp(text, { row: 0, column: 55 }, [])).toContain("added to Variables");
    expect(placeholderHelp(text, { row: 0, column: 3 }, [])).toBeNull();
  });
});

describe("syncVariables", () => {
  it("declares used names, drops unused ones and restores their settings when used again", () => {
    const stash = new Map();
    const speed = { name: "speed", type: "integer" as const, required: false, label: "Speed" };
    const after = syncVariables('{ "a": "${line}", "d": "${device.city}", "e": "${endpoint.ip}" }', [speed], stash);
    expect(after).toEqual([{ name: "line", type: "string", required: true }]);
    expect(syncVariables('{ "a": "${line}", "b": "${speed}" }', after, stash)).toEqual([after[0], speed]);
  });
});
