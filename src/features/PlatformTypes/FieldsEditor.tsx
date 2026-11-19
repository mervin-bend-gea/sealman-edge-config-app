import { useState } from "react";
import { CheckCircleIcon, PlusIcon, TrashIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { components } from "@/generated/edge-administration/types";
import FieldValueInput, { compactInputClass, validateFieldValue } from "./FieldValueInput";
import Toggle from "./Toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { RoleOption } from "./typeRoles";
import FieldInfoTooltip from "./FieldInfoTooltip";

export type FieldDefinition = components["schemas"]["FieldDefinition"];
type FieldType = FieldDefinition["type"];
type FieldUi = NonNullable<FieldDefinition["ui"]>;
type FieldValidation = NonNullable<FieldDefinition["validation"]>;

export interface FieldRow {
  /** Stable id for React keys / row identity, independent of the (editable) field key. */
  id: string;
  /** The key this field was loaded under, or null if it's a new field. Used to detect renames/deletions on save. */
  originalKey: string | null;
  key: string;
  definition: FieldDefinition;
  /** Raw text for the options input, kept separate from definition.options so typing a trailing comma isn't eaten. */
  optionsText: string;
  /** The role this field carries on its type (e.g. "ip"), or null. */
  role: string | null;
}

const UI_OPTIONS_BY_TYPE: Record<FieldType, { value: FieldUi; label: string }[]> = {
  string: [
    { value: "input", label: "Text input" },
    { value: "textarea", label: "Textarea" },
    { value: "password", label: "Password" },
    { value: "select", label: "Select (dropdown)" },
    { value: "radio", label: "Radio buttons" },
  ],
  boolean: [
    { value: "toggle", label: "Toggle" },
    { value: "checkbox", label: "Checkbox" },
  ],
  integer: [
    { value: "number", label: "Number input" },
    { value: "slider", label: "Slider" },
  ],
  number: [
    { value: "number", label: "Number input" },
    { value: "slider", label: "Slider" },
  ],
};

export function emptyFieldRow(): FieldRow {
  return {
    id: crypto.randomUUID(),
    originalKey: null,
    key: "",
    definition: {
      type: "string",
      label: "",
      required: false,
      ui: "input",
      default: null,
      changeable: true,
      show_in_list: true,
    },
    optionsText: "",
    role: null,
  };
}

function parseOptions(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function rowsFromFields(
  fields: Record<string, FieldDefinition>,
  mapping: Record<string, string> = {}
): FieldRow[] {
  return Object.entries(fields).map(([key, definition]) => ({
    id: crypto.randomUUID(),
    originalKey: key,
    key,
    definition,
    optionsText: (definition.options ?? []).join(", "),
    role: mapping[key] ?? null,
  }));
}

export function findDuplicateKeys(rows: FieldRow[]): Set<string> {
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = row.key.trim().toLowerCase();
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

/**
 * Diffs the current rows against the field keys a type originally had and
 * produces a PATCH-ready fields payload: unchanged/renamed/new fields map to
 * their full definition, keys that disappeared (removed or renamed away
 * from) map to `null` so the backend deletes them.
 */
export function buildFieldsPayload(
  rows: FieldRow[],
  originalKeys: string[]
): Record<string, FieldDefinition | null> {
  const payload: Record<string, FieldDefinition | null> = {};

  const stillPresentOriginalKeys = new Set(
    rows.filter((r) => r.originalKey && r.originalKey === r.key.trim()).map((r) => r.originalKey as string)
  );

  for (const key of originalKeys) {
    if (!stillPresentOriginalKeys.has(key)) {
      payload[key] = null;
    }
  }

  for (const row of rows) {
    payload[row.key.trim()] = row.definition;
  }

  return payload;
}

/** The type's `mapping` ({field_key: role}) from the rows' current keys and roles. */
export function buildMappingPayload(rows: FieldRow[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key && row.role) mapping[key] = row.role;
  }
  return mapping;
}

export function Field({ label, children, info }: { label: string; children: React.ReactNode; info?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {info && <FieldInfoTooltip text={info} />}
      </div>
      {children}
    </div>
  );
}

/**
 * A live sandbox for a field's definition: type a value in the same widget an instance form
 * would use, and see immediately whether it satisfies the `required`/`validation` constraints
 * currently configured - without having to save the type and go create a real instance just to
 * find out. `key`-ed by type/ui at the call site so switching between them resets the test value
 * instead of carrying over a now-nonsensical one (e.g. a string left over after switching to
 * integer); constraint edits (pattern, bounds, etc.) intentionally do NOT reset it, so you can
 * keep one value in place and watch it flip valid/invalid as you tune the constraints.
 */
function FieldValueTester({ label, definition }: { label: string; definition: FieldDefinition }) {
  const [testValue, setTestValue] = useState<unknown>(definition.type === "boolean" ? false : null);
  const isEmpty = testValue === null || testValue === undefined || testValue === "";
  const effectiveLabel = label.trim() || "This field";
  const error = definition.required && isEmpty
    ? `"${effectiveLabel}" is required`
    : validateFieldValue(effectiveLabel, testValue, definition);

  return (
    <div className="border rounded-md p-3 bg-muted/20 space-y-2 max-w-xs">
      <div className="text-xs font-semibold text-muted-foreground">Test this field</div>
      <FieldValueInput
        definition={definition}
        value={testValue}
        onChange={setTestValue}
        placeholder="Try a value..."
      />
      {isEmpty && !definition.required ? (
        <p className="text-xs text-muted-foreground">Enter a value to test</p>
      ) : error ? (
        <p className="text-xs text-destructive flex items-start gap-1">
          <XCircleIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      ) : (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircleIcon className="w-3.5 h-3.5 shrink-0" /> Valid
        </p>
      )}
    </div>
  );
}

interface FieldsEditorProps {
  rows: FieldRow[];
  onChange: (rows: FieldRow[]) => void;
  duplicateKeys?: Set<string>;
  /** When set, shows a "Show in list" toggle per field, controlling whether its value appears in
   * the corresponding device or endpoint list. */
  showListVisibility?: boolean;
  /** When set, each field row gets a Role selector with these roles. A role another row already
   * has is disabled. */
  roleOptions?: RoleOption[];
}

/**
 * The single dynamic-UI component for a platform type's field definitions:
 * add/remove/edit rows, and for each row render exactly the controls that
 * make sense for its current type/ui (options, default value, etc).
 */
export default function FieldsEditor({ rows, onChange, duplicateKeys, showListVisibility, roleOptions }: FieldsEditorProps) {
  // Which rows currently show their validation-constraint inputs (Pattern/Min length/Minimum/
  // etc.) and the "Test this field" sandbox - hidden by default so the common case (no
  // constraints needed) stays uncluttered.
  const [expandedValidation, setExpandedValidation] = useState<Set<string>>(new Set());

  const toggleValidationVisibility = (id: string) => {
    setExpandedValidation((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateRow = (id: string, patch: Partial<FieldRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const updateDefinition = (id: string, patch: Partial<FieldDefinition>) => {
    onChange(
      rows.map((row) => (row.id === id ? { ...row, definition: { ...row.definition, ...patch } } : row))
    );
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((row) => row.id !== id));
  };

  const addRow = () => {
    onChange([...rows, emptyFieldRow()]);
  };

  const handleTypeChange = (row: FieldRow, type: FieldType) => {
    const ui = UI_OPTIONS_BY_TYPE[type][0].value;
    updateRow(row.id, {
      // validation is reset too - none of string's pattern/min_length/max_length or
      // integer/number's minimum/maximum/multiple_of carry over correctly across a type change,
      // and the backend forbids `validation` entirely for type=boolean.
      definition: { ...row.definition, type, ui, options: null, default: null, validation: null },
      optionsText: "",
      // a role needs a specific field type; drop it when the new type no longer fits
      role: roleOptions?.find((o) => o.value === row.role)?.fieldType === type ? row.role : null,
    });
  };

  const handleOptionsTextChange = (row: FieldRow, text: string) => {
    updateRow(row.id, { optionsText: text, definition: { ...row.definition, options: parseOptions(text) } });
  };

  // Merges a validation patch into the row's definition; drops the whole `validation` object
  // once every constraint is cleared back to its default, so an empty `{}` never gets persisted.
  const updateValidation = (id: string, patch: Partial<FieldValidation>) => {
    onChange(
      rows.map((row) => {
        if (row.id !== id) return row;
        const merged = { ...(row.definition.validation ?? {}), ...patch };
        const validation: FieldValidation = {
          ...merged,
          exclusive_minimum: merged.exclusive_minimum ?? false,
          exclusive_maximum: merged.exclusive_maximum ?? false,
        };
        const isEmpty =
          validation.pattern == null &&
          validation.min_length == null &&
          validation.max_length == null &&
          validation.minimum == null &&
          validation.maximum == null &&
          validation.multiple_of == null &&
          !validation.exclusive_minimum &&
          !validation.exclusive_maximum;
        return { ...row, definition: { ...row.definition, validation: isEmpty ? null : validation } };
      })
    );
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No fields defined yet.</p>
      )}

      {rows.map((row) => {
        const uiOptions = UI_OPTIONS_BY_TYPE[row.definition.type];
        const ui = row.definition.ui ?? uiOptions[0].value;
        const showOptions = ui === "select" || ui === "radio";
        const trimmedKey = row.key.trim();
        const isDuplicate = duplicateKeys?.has(trimmedKey.toLowerCase()) && trimmedKey !== "";
        const showValidation = expandedValidation.has(row.id);

        return (
          <div key={row.id} className="border rounded-md p-3 space-y-3 bg-background hover:bg-muted/20 transition-colors">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-3">
                <Field label="Key *" info="The stable identifier used by the API and stored metadata. Use a concise key without spaces, for example device_name. It must be unique within this type.">
                  <input
                    type="text"
                    placeholder="field_key"
                    value={row.key}
                    onChange={(e) => updateRow(row.id, { key: e.target.value })}
                    className={`${compactInputClass} font-mono ${isDuplicate ? "border-destructive focus:border-destructive" : ""}`}
                  />
                  {isDuplicate && <p className="text-xs text-destructive mt-1">Duplicate key</p>}
                </Field>
              </div>

              <div className="col-span-4">
                <Field label="Label *" info="The human-readable name shown to users in forms and device details. Enter a short descriptive label.">
                  <input
                    type="text"
                    placeholder="Human readable label"
                    value={row.definition.label}
                    onChange={(e) => updateDefinition(row.id, { label: e.target.value })}
                    className={compactInputClass}
                  />
                </Field>
              </div>

              <div className="col-span-2">
                <Field label="Type" info="The data type accepted for this field: text, true/false, whole number, or decimal number. Changing the type resets incompatible widget and validation settings.">
                  <Select value={row.definition.type} onValueChange={(v) => handleTypeChange(row, v as FieldType)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="integer">Integer</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="col-span-2">
                <Field label="Widget" info="Controls how users enter this value. Available widgets depend on the selected data type. Dropdown and radio widgets require options.">
                  <Select
                    value={ui}
                    onValueChange={(v) =>
                      updateDefinition(row.id, { ui: v as FieldUi, options: null, default: null })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {uiOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="col-span-1 flex justify-end">
                {/* Invisible label matches the height of the sibling Field labels, so the button
                    lines up with the inputs exactly instead of relying on flex/grid guesswork. */}
                <Field label=" ">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeRow(row.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    aria-label="Remove field"
                  >
                    <TrashIcon />
                  </Button>
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                <Toggle
                  checked={row.definition.required}
                  onChange={(val) => updateDefinition(row.id, { required: val })}
                />
                Required <FieldInfoTooltip text="When enabled, users must provide a value before the form can be saved. When disabled, the field may be left empty." />
              </label>

              <label
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground whitespace-nowrap"
                title="If off, an instance's value for this field can no longer be edited once it's been set"
              >
                <Toggle
                  checked={row.definition.changeable !== false}
                  onChange={(val) => updateDefinition(row.id, { changeable: val })}
                />
                Changeable <FieldInfoTooltip text="When disabled, an instance's value cannot be edited after it has been set. This controls editability of the value, not whether the field appears." />
              </label>

              {showListVisibility && (
                <label
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground whitespace-nowrap"
                  title="If on, this field's value appears in the corresponding list or table"
                >
                  <Toggle
                    checked={row.definition.show_in_list !== false}
                    onChange={(val) => updateDefinition(row.id, { show_in_list: val })}
                  />
                  Show in list <FieldInfoTooltip text="When enabled, this endpoint field is shown as extra information beside the endpoint IP in the endpoints list." />
                </label>
              )}

              {roleOptions && (
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Role <FieldInfoTooltip text="Maps this field to a built-in endpoint or service role. Only roles compatible with this field's data type can be selected." />
                  <select
                    aria-label={`Role of field ${trimmedKey}`}
                    value={row.role ?? ""}
                    disabled={trimmedKey === ""}
                    title={trimmedKey === "" ? "Enter a field key first" : undefined}
                    onChange={(e) => updateRow(row.id, { role: e.target.value || null })}
                    className="h-8 rounded-md border border-slate-200 bg-muted/30 px-2 text-xs"
                  >
                    <option value="">None</option>
                    {roleOptions.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        disabled={
                          opt.fieldType !== row.definition.type ||
                          rows.some((other) => other.id !== row.id && other.role === opt.value)
                        }
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-5">
                <Field label="Description" info="Optional help text shown with this field when users enter a value. Keep it concise and explain the expected content.">
                  <input
                    type="text"
                    placeholder="Optional help text"
                    value={row.definition.description ?? ""}
                    onChange={(e) => updateDefinition(row.id, { description: e.target.value || null })}
                    className={compactInputClass}
                  />
                </Field>
              </div>

              {showOptions && (
                <div className="col-span-4">
                  <Field label="Options (comma separated)" info="Choices offered by the Select or Radio widget. Enter one option per comma-separated value.">
                    <input
                      type="text"
                      placeholder="option1, option2, option3"
                      value={row.optionsText}
                      onChange={(e) => handleOptionsTextChange(row, e.target.value)}
                      className={compactInputClass}
                    />
                  </Field>
                </div>
              )}

              <div className={showOptions ? "col-span-3" : "col-span-7"}>
                <Field label="Default value" info="The initial value suggested for this field. It must match the selected data type and any configured validation rules.">
                  <FieldValueInput
                    definition={row.definition}
                    value={row.definition.default}
                    onChange={(value) => updateDefinition(row.id, { default: value })}
                  />
                </Field>
              </div>
            </div>

            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
              <Toggle checked={showValidation} onChange={() => toggleValidationVisibility(row.id)} />
              Validation options <FieldInfoTooltip text="Optional constraints checked when users enter a value. The available constraints depend on the field's data type." />
            </label>

            {showValidation && (
              <div className="pt-2 border-t space-y-3">
                {row.definition.type === "string" && (
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6">
                      <Field label="Pattern (regex, must fully match)" info="A regular expression the entire text value must match. Enter a valid JavaScript-compatible regular expression, for example ^[A-Z]{2}\d{4}$.">
                        <input
                          type="text"
                          placeholder="e.g. ^[A-Z]{2}\d{4}$"
                          value={row.definition.validation?.pattern ?? ""}
                          onChange={(e) => updateValidation(row.id, { pattern: e.target.value || null })}
                          className={`${compactInputClass} font-mono`}
                        />
                      </Field>
                    </div>
                    <div className="col-span-3">
                      <Field label="Min length" info="Minimum number of characters accepted for a text value. Enter a non-negative whole number.">
                        <input
                          type="number"
                          min={0}
                          value={row.definition.validation?.min_length ?? ""}
                          onChange={(e) =>
                            updateValidation(row.id, { min_length: e.target.value === "" ? null : Number(e.target.value) })
                          }
                          className={compactInputClass}
                        />
                      </Field>
                    </div>
                    <div className="col-span-3">
                      <Field label="Max length" info="Maximum number of characters accepted for a text value. Enter a non-negative whole number that is not below the minimum length.">
                        <input
                          type="number"
                          min={0}
                          value={row.definition.validation?.max_length ?? ""}
                          onChange={(e) =>
                            updateValidation(row.id, { max_length: e.target.value === "" ? null : Number(e.target.value) })
                          }
                          className={compactInputClass}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {(row.definition.type === "integer" || row.definition.type === "number") && (
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-2">
                      <Field label="Minimum" info="Lowest accepted numeric value. Enter a number; the exclusive option determines whether the boundary itself is allowed.">
                        <input
                          type="number"
                          value={row.definition.validation?.minimum ?? ""}
                          onChange={(e) =>
                            updateValidation(row.id, { minimum: e.target.value === "" ? null : Number(e.target.value) })
                          }
                          className={compactInputClass}
                        />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Maximum" info="Highest accepted numeric value. Enter a number; the exclusive option determines whether the boundary itself is allowed.">
                        <input
                          type="number"
                          value={row.definition.validation?.maximum ?? ""}
                          onChange={(e) =>
                            updateValidation(row.id, { maximum: e.target.value === "" ? null : Number(e.target.value) })
                          }
                          className={compactInputClass}
                        />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Multiple of" info="Requires numeric values to be divisible by this number. Enter a positive numeric increment.">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={row.definition.validation?.multiple_of ?? ""}
                          onChange={(e) =>
                            updateValidation(row.id, { multiple_of: e.target.value === "" ? null : Number(e.target.value) })
                          }
                          className={compactInputClass}
                        />
                      </Field>
                    </div>
                    <label className="col-span-3 flex items-center gap-2 text-xs font-medium text-muted-foreground whitespace-nowrap pb-1.5">
                      <Toggle
                        checked={row.definition.validation?.exclusive_minimum ?? false}
                        onChange={(val) => updateValidation(row.id, { exclusive_minimum: val })}
                      />
                      Exclusive min <FieldInfoTooltip text="When enabled, values must be greater than the configured minimum. When disabled, the minimum value itself is accepted." />
                    </label>
                    <label className="col-span-3 flex items-center gap-2 text-xs font-medium text-muted-foreground whitespace-nowrap pb-1.5">
                      <Toggle
                        checked={row.definition.validation?.exclusive_maximum ?? false}
                        onChange={(val) => updateValidation(row.id, { exclusive_maximum: val })}
                      />
                      Exclusive max <FieldInfoTooltip text="When enabled, values must be less than the configured maximum. When disabled, the maximum value itself is accepted." />
                    </label>
                  </div>
                )}

                <FieldValueTester
                  key={`${row.definition.type}-${ui}`}
                  label={row.definition.label || row.key}
                  definition={row.definition}
                />
              </div>
            )}
          </div>
        );
      })}

      <Button type="button" variant="outline" onClick={addRow}>
        <PlusIcon />
        Add field
      </Button>
    </div>
  );
}
