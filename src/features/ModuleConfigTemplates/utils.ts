import { useEffect, useState } from "react";
import type { JsonEditorAnnotation, JsonEditorMarker } from "@/components/Input/JsonEditor";
import type { ExampleDevice, VariableDecl, VariableType } from "./api";

export const TEMPLATES_PATH = "/module-templates";

export const namespaceEditPath = (namespaceId: number) => `${TEMPLATES_PATH}/${namespaceId}/edit`;

export const templatePath = (namespaceId: number, templateId: number | "new") =>
  `${TEMPLATES_PATH}/${namespaceId}/templates/${templateId}`;

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
    if (v.default != null) out.default = v.default;
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

/** JSON with sorted keys, to compare values regardless of key order. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v);
}

/** How people see a version: its tag (or "v<number>" where only the number is known). */
export const versionLabel = (tag?: string | null, version?: number | null) =>
  tag ?? (version != null ? `v${version}` : "");

/** Same rule as the API for version tags. */
export const VERSION_TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._+-]{0,63}$/;

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
      text: "Placeholder is not a declared variable, a device field or a valid escape",
    }));
}
