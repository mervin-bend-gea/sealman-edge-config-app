import { useEffect, useState } from "react";
import type { JsonEditorAnnotation, JsonEditorMarker } from "@/components/Input/JsonEditor";
import type { ExampleDevice, VariableDecl, VariableType } from "./api";

/**
 * Height of an editor the user works in: the viewport below the page header (never less than ~28 lines, never more
 * than ~60), so long configurations need little scrolling and everything else sits below it.
 */
export const EDITOR_HEIGHT = "h-[clamp(28rem,calc(100vh_-_14rem),64rem)]";

export const TEMPLATES_PATH = "/module-templates";

export const groupEditPath = (groupId: number) => `${TEMPLATES_PATH}/${groupId}/edit`;

export const templatePath = (groupId: number, templateId: number | "new") =>
  `${TEMPLATES_PATH}/${groupId}/templates/${templateId}`;

/** Same rule as the API: an exact module name, no wildcards. */
export const MODULE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export const VARIABLE_TYPES: VariableType[] = ["string", "text", "number", "integer", "boolean", "enum"];

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  string: "String", text: "Text", number: "Number", integer: "Integer", boolean: "Boolean", enum: "Enum",
};

export interface VariableProblem {
  index: number;
  field: "name" | "options";
  message: string;
}

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** What would make the API reject the declarations: the editor shows it per row and blocks saving. */
export function variableProblems(variables: VariableDecl[]): VariableProblem[] {
  const problems: VariableProblem[] = [];
  const seen = new Map<string, number>();
  variables.forEach((v, index) => {
    const name = v.name.trim();
    if (name === "") problems.push({ index, field: "name", message: "Give the variable a name" });
    else if (!VARIABLE_NAME.test(name)) problems.push({ index, field: "name", message: `'${name}' must start with a letter or _ and use only letters, digits and _` });
    else if (name === "device") problems.push({ index, field: "name", message: "'device' is reserved for device metadata" });
    else if (name.length > 64) problems.push({ index, field: "name", message: `'${name}' is longer than 64 characters` });
    else if (seen.has(name)) problems.push({ index, field: "name", message: `'${name}' is declared twice` });
    else seen.set(name, index);
    if (v.type === "enum" && !(v.options?.length)) problems.push({ index, field: "options", message: `Enum '${name || "?"}' needs options` });
  });
  return problems;
}

/** Debounces a JSON-serializable value; compares by content so fresh object literals do not retrigger. */
export function useDebounced<T>(value: T, delay = 400): T {
  const key = JSON.stringify(value);
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(JSON.parse(key) as T), delay);
    return () => clearTimeout(timer);
  }, [key, delay]);
  return debounced;
}

/** Drops empty optional properties so declarations round-trip cleanly through the API. */
export function cleanVariables(variables: VariableDecl[]): VariableDecl[] {
  return variables.map((v) => {
    const out: VariableDecl = { name: v.name.trim(), type: v.type, required: v.required !== false };
    if (v.type === "enum" && v.options?.length) out.options = v.options;
    if (v.label) out.label = v.label;
    if (v.description) out.description = v.description;
    return out;
  });
}

/** What identifies a device to people: its id and, if there is one, its description or city. */
export function deviceLabel(device: ExampleDevice) {
  const hint = device.device_data.description ?? device.device_data.city;
  return typeof hint === "string" && hint ? `${device.device_id} · ${hint}` : device.device_id;
}

/** The `${device.field}` fields a template body refers to. */
export function deviceReferences(body: unknown): string[] {
  const text = JSON.stringify(body ?? null);
  return [...new Set([...text.matchAll(/(?<!\$)\$\{device\.([A-Za-z0-9_.-]+)\}/g)].map((m) => m[1]))];
}

const ENDPOINT_REF_RE = /^endpoint(?:\[([A-Za-z_][A-Za-z0-9_]*)\])?\.([A-Za-z0-9_-]+)$/;

const SERVICE_REF_RE = /^service(?:\[([A-Za-z_][A-Za-z0-9_]*)\])?\.([A-Za-z0-9_-]+)$/;

/** The endpoint slots a template body uses, each with the endpoint fields it reads
 * (`${endpoint.x}` is the slot "endpoint") and the service fields (`${service[slot].x}`, `${service.x}` likewise). */
export function endpointReferences(body: unknown): { slot: string; fields: string[]; service_fields: string[] }[] {
  const text = JSON.stringify(body ?? null);
  const slots = new Map<string, { fields: Set<string>; service: Set<string> }>();
  const entry = (slot: string) => {
    const e = slots.get(slot) ?? { fields: new Set<string>(), service: new Set<string>() };
    slots.set(slot, e);
    return e;
  };
  for (const m of text.matchAll(/(?<!\$)\$\{([^{}]*)\}/g)) {
    const ref = ENDPOINT_REF_RE.exec(m[1]);
    if (ref) entry(ref[1] ?? "endpoint").fields.add(ref[2]);
    const svc = SERVICE_REF_RE.exec(m[1]);
    if (svc) entry(svc[1] ?? "endpoint").service.add(svc[2]);
  }
  return [...slots].sort(([a], [b]) => a.localeCompare(b))
    .map(([slot, e]) => ({ slot, fields: [...e.fields].sort(), service_fields: [...e.service].sort() }));
}

/** JSON with sorted keys, to compare values regardless of key order. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v);
}

const SOURCE_LABEL: Record<string, string> = {
  template: "template",
  raw: "raw edit",
  "legacy-api": "legacy API",
  external: "external",
  reapply: "re-applied",
};

/** What wrote a revision, for people. */
export const sourceLabel = (source: string) => SOURCE_LABEL[source] ?? source.replace(/^extension:/, "extension ");

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

/** Escapes `${` in all strings so a plain configuration renders back to itself as a template. */
export function escapePlaceholders(value: unknown): unknown {
  if (typeof value === "string") return value.replaceAll("${", () => "$${");
  if (Array.isArray(value)) return value.map(escapePlaceholders);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, escapePlaceholders(v)]));
  }
  return value;
}

const PLACEHOLDER_RE = /\$\$\{|\$\{([^{}]*)\}/g;
const VARIABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEVICE_PATH_RE = /^device(\.[A-Za-z0-9_-]+)+$/;

/**
 * Editor markers for the placeholders of a template body: declared variables, device metadata and
 * escapes are highlighted, anything else (undeclared, malformed) is flagged. Mirrors the backend's
 * recognition of placeholders.
 */
export function placeholderMarkers(text: string, declared: Iterable<string>): JsonEditorMarker[] {
  const names = new Set(declared);
  const markers: JsonEditorMarker[] = [];
  text.split("\n").forEach((line, row) => {
    for (const match of line.matchAll(PLACEHOLDER_RE)) {
      const reference = match[1];
      let className = "tpl-ph-escape";
      if (reference !== undefined) {
        if (DEVICE_PATH_RE.test(reference)) className = "tpl-ph-device";
        else if (ENDPOINT_REF_RE.test(reference) || SERVICE_REF_RE.test(reference)) className = "tpl-ph-endpoint";
        else if (VARIABLE_NAME_RE.test(reference) && names.has(reference)) className = "tpl-ph-variable";
        else className = "tpl-ph-invalid";
      }
      const startCol = match.index ?? 0;
      markers.push({ startRow: row, startCol, endRow: row, endCol: startCol + match[0].length, className, type: "text" });
    }
  });
  return markers;
}

/** Gutter warnings for the placeholders `placeholderMarkers` flags as undeclared or malformed. */
export function placeholderAnnotations(markers: JsonEditorMarker[]): JsonEditorAnnotation[] {
  return markers
    .filter((m) => m.className === "tpl-ph-invalid")
    .map((m) => ({
      row: m.startRow, column: m.startCol, type: "warning",
      text: "Placeholder is not a declared variable, a device field, an endpoint or service field or a valid escape",
    }));
}

const REF_TEXT_RE = /"\$ref"\s*:\s*"(?:[^"\\]|\\.)*"|"\$list"(?=\s*:)/g;

/** Editor markers for block references (`"$ref": "<block name>"`) and lists (`"$list": [...]`). */
export function refMarkers(text: string): JsonEditorMarker[] {
  const markers: JsonEditorMarker[] = [];
  text.split("\n").forEach((line, row) => {
    for (const match of line.matchAll(REF_TEXT_RE)) {
      const startCol = match.index ?? 0;
      markers.push({ startRow: row, startCol, endRow: row, endCol: startCol + match[0].length, className: "tpl-ref", type: "text" });
    }
  });
  return markers;
}

/** A value in JSON text: its JSON pointer and where it sits (`end` exclusive). */
interface JsonNode {
  path: string;
  start: number;
  end: number;
  type: "object" | "array" | "scalar";
  /** number of members or elements of a container */
  size: number;
}

const pointerSegment = (key: string | number) => String(key).replaceAll("~", "~0").replaceAll("/", "~1");

/** Every value of a JSON text with its position, outermost first; undefined if the text is not valid JSON. */
function scanJson(text: string): JsonNode[] | undefined {
  try {
    JSON.parse(text);
  } catch {
    return undefined;
  }
  const nodes: JsonNode[] = [];
  let i = 0;
  const ws = () => { while (/\s/.test(text[i] ?? "")) i++; };
  const string = () => {
    const start = i++;
    while (text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    i++;
    return JSON.parse(text.slice(start, i)) as string;
  };
  const value = (path: string) => {
    ws();
    const node: JsonNode = { path, start: i, end: i, type: "scalar", size: 0 };
    nodes.push(node);
    const open = text[i];
    if (open === "{" || open === "[") {
      node.type = open === "{" ? "object" : "array";
      i++;
      ws();
      const close = open === "{" ? "}" : "]";
      while (text[i] !== close) {
        let key: string | number = node.size;
        if (open === "{") {
          key = string();
          ws();
          i++; // ':'
        }
        value(`${path}/${pointerSegment(key)}`);
        node.size++;
        ws();
        if (text[i] === ",") { i++; ws(); }
      }
      i++;
    } else if (open === '"') {
      string();
    } else {
      while (i < text.length && !/[\s,\]}]/.test(text[i])) i++;
    }
    node.end = i;
  };
  value("");
  return nodes;
}

const refText = (name: string) => JSON.stringify(name);

function offsetOf(text: string, cursor: { row: number; column: number }) {
  const lines = text.split("\n");
  let offset = 0;
  for (let r = 0; r < Math.min(cursor.row, lines.length - 1); r++) offset += lines[r].length + 1;
  return offset + Math.min(cursor.column, lines[Math.min(cursor.row, lines.length - 1)].length);
}

/**
 * Writes a reference to a block (`<block name>`) into JSON text. With the cursor on a value (a scalar, an empty object or
 * array, or another reference) the reference replaces that value; otherwise it is added to the root under a new key
 * `block<N>` (appended, if the root is an array). An empty text becomes an object holding the reference; in JSON
 * that is still being typed the reference is written at the cursor.
 */
export function insertRef(text: string, cursor: { row: number; column: number }, name: string): string {
  return insertValue(text, cursor, `{ "$ref": ${refText(name)} }`, "block");
}

/** Like `insertRef` for a list of blocks (`{ "$list": ["<block name>", …], "$label": "<item label>" }`, label optional), under a new root key `list<N>`. */
export function insertList(text: string, cursor: { row: number; column: number }, names: string[], label?: string): string {
  const labelText = label ? `, "$label": ${refText(label)}` : "";
  return insertValue(text, cursor, `{ "$list": [${names.map(refText).join(", ")}]${labelText} }`, "list");
}

function insertValue(text: string, cursor: { row: number; column: number }, ref: string, keyPrefix: string): string {
  if (!text.trim()) return `{\n  "${keyPrefix}1": ${ref}\n}`;
  const offset = offsetOf(text, cursor);
  const nodes = scanJson(text);
  if (!nodes) {
    // being typed (e.g. `"Operations": |`): write the reference where the cursor is, with a comma if a member follows
    const comma = /^\s*"/.test(text.slice(offset)) ? "," : "";
    return text.slice(0, offset) + ref + comma + text.slice(offset);
  }
  const byPath = new Map(nodes.map((n) => [n.path, n]));
  const inside = nodes.filter((n) => n.path !== "" && n.start <= offset && offset <= n.end);
  let target: JsonNode | undefined = inside[inside.length - 1];
  if (target?.path.endsWith("/$ref")) target = byPath.get(target.path.slice(0, -"/$ref".length));
  else if (target?.path.endsWith("/$label")) target = byPath.get(target.path.slice(0, -"/$label".length));
  else if (target?.path.endsWith("/$list")) target = byPath.get(target.path.slice(0, -"/$list".length));
  else if (target?.path.includes("/$list/")) {
    // on a name inside a list: the whole list is replaced
    target = byPath.get(target.path.slice(0, target.path.indexOf("/$list/")));
  }
  const isRef = (n: JsonNode) => n.type === "object" && n.size === (byPath.has(`${n.path}/$label`) ? 2 : 1) && (byPath.has(`${n.path}/$ref`) || byPath.has(`${n.path}/$list`));
  if (target && (target.type === "scalar" || target.size === 0 || isRef(target))) {
    return text.slice(0, target.start) + ref + text.slice(target.end);
  }

  const root = nodes[0];
  if (root.type === "scalar") return text;
  const close = root.end - 1;
  let last = close - 1;
  while (last > root.start && /\s/.test(text[last])) last--;
  let entry = ref;
  if (root.type === "object") {
    let n = 1;
    while (byPath.has(`/${keyPrefix}${n}`)) n++;
    entry = `"${keyPrefix}${n}": ${ref}`;
  }
  return root.size > 0
    ? `${text.slice(0, last + 1)},\n  ${entry}${text.slice(last + 1)}`
    : `${text.slice(0, root.start + 1)}\n  ${entry}\n${text.slice(close)}`;
}

/** Whether `offset` sits inside a JSON string literal of `text` (between its quotes). */
function inString(text: string, offset: number) {
  let inside = false;
  for (let i = 0; i < offset; i++) {
    if (text[i] === "\\" && inside) i++;
    else if (text[i] === '"') inside = !inside;
  }
  return inside;
}

/**
 * Writes the placeholder `${<reference>}` at the cursor: as is inside a string (e.g. `"opc.tcp://|"`), else as a
 * string value of its own.
 */
export function insertPlaceholder(text: string, cursor: { row: number; column: number }, reference: string): string {
  const offset = offsetOf(text, cursor);
  const placeholder = `\${${reference}}`;
  return text.slice(0, offset) + (inString(text, offset) ? placeholder : JSON.stringify(placeholder)) + text.slice(offset);
}

const KEY_HELP: Record<string, string> = {
  "$ref": "Block reference: replaced by the block's current content. The block's own inputs are asked when the template is applied.",
  "$list": "List: when applying, the user adds any number of entries, each one of the blocks listed here, and names each entry.",
  "$label": "What one entry of this list is called on the device, e.g. \"Slave\" shows \"Slaves\" and \"+ Add slave\".",
};

/** Plain-words explanation of the placeholder or `$ref`/`$list`/`$label` key under (row, column), for a hover tooltip. */
export function placeholderHelp(text: string, at: { row: number; column: number }, variables: VariableDecl[]): string | null {
  const line = text.split("\n")[at.row] ?? "";
  for (const match of line.matchAll(PLACEHOLDER_RE)) {
    const start = match.index ?? 0;
    if (at.column < start || at.column > start + match[0].length) continue;
    const reference = match[1];
    if (reference === undefined) return "Escape: written as the literal text ${ (nothing is filled in).";
    if (DEVICE_PATH_RE.test(reference)) {
      return `Device field "${reference.slice("device.".length)}": taken from the device's metadata. Nothing is asked when applying.`;
    }
    const endpoint = ENDPOINT_REF_RE.exec(reference);
    if (endpoint) {
      const dropdown = endpoint[1] ? `"Endpoint: ${endpoint[1]}"` : `"Endpoint"`;
      return `${endpoint[2] === "ip" ? "IP" : `Field "${endpoint[2]}"`} of the endpoint the user picks in the ${dropdown} dropdown when applying.`;
    }
    const service = SERVICE_REF_RE.exec(reference);
    if (service) {
      const dropdown = service[1] ? `"Endpoint: ${service[1]}"` : `"Endpoint"`;
      return `${service[2] === "port" ? "Port" : `Field "${service[2]}"`} of the service the user picks under the ${dropdown} dropdown when applying (only that endpoint's services are listed).`;
    }
    const variable = variables.find((v) => v.name.trim() === reference);
    if (variable) {
      const label = variable.label ? ` "${variable.label}"` : "";
      return `Variable "${reference}" (${variable.type}): the user fills in${label} when applying.${variable.description ? ` ${variable.description}` : ""}`;
    }
    return VARIABLE_NAME_RE.test(reference)
      ? `Variable "${reference}": added to Variables in a moment.`
      : `Not a valid placeholder. See "What can I write?" above the editor.`;
  }
  for (const match of line.matchAll(/"(\$ref|\$list|\$label)"(?=\s*:)/g)) {
    const start = match.index ?? 0;
    if (at.column >= start && at.column <= start + match[0].length) return KEY_HELP[match[1]];
  }
  return null;
}

/** The variable names a body's placeholders refer to (`${name}`, not device, endpoint or service fields), in order of first use. */
export function referencedVariables(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    const reference = match[1];
    if (reference !== undefined && VARIABLE_NAME_RE.test(reference) && reference !== "device" && reference.length <= 64) names.add(reference);
  }
  return [...names];
}

/**
 * The declarations that match the body: a variable is declared as soon as the body uses `${name}` and dropped when it
 * no longer does. Dropped declarations wait in `stash` (by name), so their settings come back if the name is used
 * again (e.g. after cut and paste). Returns `variables` itself when nothing changes.
 */
export function syncVariables(text: string, variables: VariableDecl[], stash: Map<string, VariableDecl>): VariableDecl[] {
  const used = referencedVariables(text);
  const kept = variables.filter((v) => {
    if (used.includes(v.name.trim())) return true;
    if (v.name.trim()) stash.set(v.name.trim(), v);
    return false;
  });
  const declared = new Set(kept.map((v) => v.name.trim()));
  const added = used.filter((n) => !declared.has(n)).map((n) => stash.get(n) ?? { name: n, type: "string" as const, required: true });
  return added.length === 0 && kept.length === variables.length ? variables : [...kept, ...added];
}
