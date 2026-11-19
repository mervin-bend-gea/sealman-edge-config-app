import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateFieldValue } from "./FieldValueInput";
import FieldsEditor, {
  Field,
  FieldDefinition,
  FieldRow,
  buildFieldsPayload,
  buildMappingPayload,
  findDuplicateKeys,
  rowsFromFields,
} from "./FieldsEditor";
import type { RoleOption } from "./typeRoles";

// Radix Select can't hold an empty-string item, so "no browse action" is represented by this sentinel.
const NO_BROWSER_KIND = "__none__";

export interface BrowserKindOption {
  value: string;
  label: string;
}

export interface TypeRecord {
  type_id: string;
  label: string;
  description: string | null;
  fields: Record<string, FieldDefinition>;
  mapping?: Record<string, string>;
  browser_kind?: string | null;
}

export interface TypeFormResult {
  label: string;
  description: string | null;
  fields: Record<string, FieldDefinition | null>;
  browser_kind: string | null;
  /** The type's {field_key: role} mapping, or null for types without roles (device types). */
  mapping: Record<string, string> | null;
}

interface TypeFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (result: TypeFormResult) => Promise<void>;
  initial?: TypeRecord | null;
  singularLabel: string;
  isPending?: boolean;
  canSave?: boolean;
  /** When set, shows a "Browse Action" dropdown letting this type be assigned one of these
   * built-in browsers (e.g. VNC, OPC-UA, plain HTTP) for its "Browse" button on the Overview page. */
  browserKindOptions?: BrowserKindOption[];
  /** When set, a brand-new type (not editing an existing one) starts with these fields
   * pre-populated instead of a single blank row - used so creating a device type shows the
   * default type's fields right away, since they'll apply to it regardless (see
   * db/sqlalchemy/device_type.py:_serialize_with_mirroring), and to pre-fill a new endpoint or
   * service type with its role fields. Ignored while editing an existing
   * type, since `initial.fields` already reflects the current mirrored view in that case. */
  defaultFields?: Record<string, FieldDefinition>;
  /** Roles of the pre-filled `defaultFields` on a brand-new type ({field_key: role}). */
  defaultMapping?: Record<string, string>;
  /** When set, each field row gets a Role selector and the result carries `mapping`. */
  roleOptions?: RoleOption[];
  /** When set, each field row gets a "Show in list" toggle controlling whether its value appears
   * in the corresponding device or endpoint list. */
  supportsListVisibility?: boolean;
}

export default function TypeFormDialog({
  isOpen,
  onClose,
  onSubmit,
  initial,
  singularLabel,
  isPending,
  canSave = true,
  browserKindOptions,
  defaultFields,
  defaultMapping,
  roleOptions,
  supportsListVisibility,
}: TypeFormDialogProps) {
  const isEdit = Boolean(initial);

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [browserKind, setBrowserKind] = useState("");
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLabel(initial?.label ?? "");
    setDescription(initial?.description ?? "");
    setBrowserKind(initial?.browser_kind ?? "");
    if (initial) {
      setRows(rowsFromFields(initial.fields, initial.mapping ?? {}));
    } else if (defaultFields && Object.keys(defaultFields).length > 0) {
      setRows(rowsFromFields(defaultFields, defaultMapping ?? {}));
    } else {
      // No pre-filled blank row - the user presses "Add field" to start defining one.
      setRows([]);
    }
    setError(null);
  }, [isOpen, initial, defaultFields, defaultMapping]);

  if (!isOpen) return null;

  const duplicateKeys = findDuplicateKeys(rows);

  const handleSave = async () => {
    const trimmedLabel = label.trim();

    if (!trimmedLabel) {
      setError("Label is required");
      return;
    }

    if (duplicateKeys.size > 0) {
      setError(`Duplicate field key${duplicateKeys.size > 1 ? "s" : ""}: ${[...duplicateKeys].join(", ")}`);
      return;
    }

    for (const row of rows) {
      if (!row.key.trim()) {
        setError("Every field needs a key");
        return;
      }
      if (!row.definition.label.trim()) {
        setError(`Field "${row.key.trim()}" needs a label`);
        return;
      }
      const ui = row.definition.ui;
      if ((ui === "select" || ui === "radio") && (row.definition.options ?? []).length === 0) {
        setError(`Field "${row.key.trim()}" needs at least one option`);
        return;
      }

      const validation = row.definition.validation;
      if (validation?.pattern) {
        try {
          new RegExp(validation.pattern);
        } catch {
          setError(`Field "${row.key.trim()}" has an invalid regex pattern`);
          return;
        }
      }
      if (
        validation?.min_length != null &&
        validation?.max_length != null &&
        validation.min_length > validation.max_length
      ) {
        setError(`Field "${row.key.trim()}": min length cannot be greater than max length`);
        return;
      }
      if (validation?.minimum != null && validation?.maximum != null && validation.minimum > validation.maximum) {
        setError(`Field "${row.key.trim()}": minimum cannot be greater than maximum`);
        return;
      }
      if (ui === "slider" && (validation?.minimum == null || validation?.maximum == null)) {
        setError(`Field "${row.key.trim()}": a slider needs both a minimum and a maximum`);
        return;
      }
      if (row.definition.default != null) {
        const defaultError = validateFieldValue(row.definition.label || row.key.trim(), row.definition.default, row.definition);
        if (defaultError) {
          setError(`Field "${row.key.trim()}" default value: ${defaultError}`);
          return;
        }
      }
    }

    const originalKeys = Object.keys(initial?.fields ?? {});
    const fields = buildFieldsPayload(rows, originalKeys);

    try {
      await onSubmit({
        label: trimmedLabel,
        description: description.trim() || null,
        fields,
        browser_kind: browserKind || null,
        mapping: roleOptions ? buildMappingPayload(rows) : null,
      });
      setError(null);
    } catch {
      setError(`Failed to save ${singularLabel.toLowerCase()}`);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
        <div className="px-6 py-4 border-b shrink-0">
          <DialogTitle>
            {isEdit ? `Edit ${singularLabel}` : `Add ${singularLabel}`}
          </DialogTitle>
          <DialogDescription className="sr-only">Define the type and its fields</DialogDescription>
        </div>

        <div className="px-6 py-4 space-y-5 overflow-y-auto">
          {isEdit && (
            <Field label="Type ID" info="The system-generated identifier for this type. It is read-only and is used internally to reference the type.">
              <Input
                type="text"
                value={(initial as TypeRecord).type_id}
                disabled
                className="font-mono"
              />
            </Field>
          )}

          <Field label="Label *" info="The human-readable name displayed when users select or view this type. Enter a concise name.">
            <Input
              type="text"
              placeholder="Human readable name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>

          <Field label="Description" info="Optional summary explaining what this type represents. It is displayed as supporting information in the type list.">
            <Input
              type="text"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          {browserKindOptions && (
            <Field label="Browse Action" info="Select the registered browser action used to open or inspect instances of this type. Choose None when no browse action applies.">
              <Select
                value={browserKind || NO_BROWSER_KIND}
                onValueChange={(v) => setBrowserKind(v === NO_BROWSER_KIND ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BROWSER_KIND}>None</SelectItem>
                  {browserKindOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2">Fields</h3>
            <FieldsEditor
              rows={rows}
              onChange={setRows}
              duplicateKeys={duplicateKeys}
              showListVisibility={supportsListVisibility}
              roleOptions={roleOptions}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2 shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isPending || duplicateKeys.size > 0}
          >
            {isPending ? "Saving..." : isEdit ? "Save changes" : `Add ${singularLabel.toLowerCase()}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
