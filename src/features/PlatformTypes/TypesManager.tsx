import { useState } from "react";
import { InlineAlert } from "@/components/ui/page-state";
import { toast } from "react-toastify";
import { PencilSquareIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import SimpleDialog from "@/components/Modal/SimpleDialog";
import { WaterLoader } from "@/components/ui/water-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/generated/edge-administration/api";
import TypeFormDialog, { BrowserKindOption, TypeFormResult, TypeRecord } from "./TypeFormDialog";
import { FieldDefinition } from "./FieldsEditor";
import type { RoleOption } from "./typeRoles";

export interface TypesManagerProps {
  title: string;
  singularLabel: string;
  description?: string;
  types: TypeRecord[];
  isLoading: boolean;
  canEdit?: boolean;
  /** When set, the form lets this type be assigned one of these built-in browsers. */
  browserKindOptions?: BrowserKindOption[];
  /** When set, a brand-new type starts pre-populated with these fields instead of a blank row -
   * used for Device Types (the default type's fields always apply anyway) and to pre-fill new
   * endpoint/service types with their role fields. */
  defaultFields?: Record<string, FieldDefinition>;
  /** Roles of the pre-filled `defaultFields` on a brand-new type ({field_key: role}). */
  defaultMapping?: Record<string, string>;
  /** When set, fields get a Role selector and create/update send `mapping`. */
  roleOptions?: RoleOption[];
  /** When set, each field row gets a "Show in list" toggle controlling whether its value appears
   * in the corresponding device or endpoint list. */
  supportsListVisibility?: boolean;
  /** Type ID that can't be deleted (its delete button is hidden entirely) - used for the
   * "default" device type, which the backend also rejects deleting. */
  protectedTypeId?: string;
  /**
   * When set, deleting a type is a cascading delete that also removes every instance of it
   * (e.g. every endpoint of an endpoint type) - `instancesLabel` is the singular noun for one
   * instance (e.g. "endpoint"), used in copy like "every {instancesLabel} of it". To guard
   * against a stray click nuking real data, the user must type "confirm" before the Delete
   * button is enabled - not the type's own ID, since that's now a server-generated UUID nobody
   * can reasonably type or remember. When unset, deletion is a plain, non-cascading, single-click
   * confirmation (e.g. for Device Types).
   */
  cascadeDelete?: { instancesLabel: string };
  onCreate: (body: {
    label: string;
    description: string | null;
    fields: Record<string, FieldDefinition>;
    browser_kind?: string | null;
    mapping?: Record<string, string>;
  }) => Promise<unknown>;
  onUpdate: (
    typeId: string,
    body: {
      label: string;
      description: string | null;
      fields: Record<string, FieldDefinition | null>;
      browser_kind?: string | null;
      mapping?: Record<string, string>;
    }
  ) => Promise<unknown>;
  onDelete: (typeId: string) => Promise<unknown>;
}

function nonNullFields(fields: Record<string, FieldDefinition | null>): Record<string, FieldDefinition> {
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, FieldDefinition] => entry[1] !== null)
  );
}

export default function TypesManager({
  title,
  singularLabel,
  description,
  types,
  isLoading,
  canEdit = true,
  browserKindOptions,
  defaultFields,
  defaultMapping,
  roleOptions,
  supportsListVisibility,
  protectedTypeId,
  cascadeDelete,
  onCreate,
  onUpdate,
  onDelete,
}: TypesManagerProps) {
  const [dialogState, setDialogState] = useState<{ open: boolean; editing: TypeRecord | null }>({
    open: false,
    editing: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TypeRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const sortedTypes = [...types].sort((a, b) => a.label.localeCompare(b.label));

  const openAdd = () => setDialogState({ open: true, editing: null });
  const openEdit = (type: TypeRecord) => setDialogState({ open: true, editing: type });
  const closeDialog = () => setDialogState({ open: false, editing: null });
  const closeDeleteDialog = () => {
    setPendingDelete(null);
    setDeleteConfirmationText("");
  };

  const handleSubmit = async (result: TypeFormResult) => {
    if (!canEdit) return;
    setIsSubmitting(true);
    try {
      if (dialogState.editing) {
        await onUpdate(dialogState.editing.type_id, {
          label: result.label,
          description: result.description,
          fields: result.fields,
          ...(browserKindOptions ? { browser_kind: result.browser_kind } : {}),
          ...(roleOptions ? { mapping: result.mapping ?? {} } : {}),
        });
        toast.success(`${singularLabel} "${result.label}" updated`);
      } else {
        await onCreate({
          label: result.label,
          description: result.description,
          fields: nonNullFields(result.fields),
          ...(browserKindOptions ? { browser_kind: result.browser_kind } : {}),
          ...(roleOptions ? { mapping: result.mapping ?? {} } : {}),
        });
        toast.success(`${singularLabel} "${result.label}" created`);
      }
      closeDialog();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDeleteConfirmationValid = deleteConfirmationText.trim().toLowerCase() === "confirm";

  const handleDelete = async () => {
    if (!canEdit || !pendingDelete) return;
    if (cascadeDelete && !isDeleteConfirmationValid) return;
    setIsDeleting(true);
    try {
      await onDelete(pendingDelete.type_id);
      toast.success(`${singularLabel} "${pendingDelete.label}" deleted`);
      closeDeleteDialog();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : null;
      toast.error(
        message ?? `Failed to delete ${singularLabel.toLowerCase()} "${pendingDelete.label}"`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        <Button type="button" variant="outline" onClick={openAdd} disabled={!canEdit} className="shrink-0">
          <PlusIcon />
          Add {singularLabel.toLowerCase()}
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="bg-gradient-to-r from-slate-100 to-slate-50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground border-b">Type ID</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground border-b">Label</th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground border-b">Description</th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground border-b w-24">Fields</th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground border-b w-28">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Loading {title.toLowerCase()}...
                </td>
              </tr>
            ) : sortedTypes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No {title.toLowerCase()} defined
                </td>
              </tr>
            ) : (
              sortedTypes.map((type) => (
                <tr
                  key={type.type_id}
                  className="bg-background hover:bg-muted/40 transition-colors border-b last:border-b-0"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{type.type_id}</td>
                  <td className="px-4 py-3 font-medium">{type.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{type.description || "-"}</td>
                  <td className="px-4 py-3 text-center">{Object.keys(type.fields).length}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(type)}
                        disabled={!canEdit}
                        aria-label={`Edit ${type.label}`}
                      >
                        <PencilSquareIcon />
                      </Button>
                      {type.type_id !== protectedTypeId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(type)}
                          disabled={!canEdit}
                          aria-label={`Delete ${type.label}`}
                        >
                          <TrashIcon />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TypeFormDialog
        isOpen={dialogState.open}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        initial={dialogState.editing}
        singularLabel={singularLabel}
        isPending={isSubmitting}
        canSave={canEdit}
        browserKindOptions={browserKindOptions}
        defaultFields={defaultFields}
        defaultMapping={defaultMapping}
        roleOptions={roleOptions}
        supportsListVisibility={supportsListVisibility}
      />

      <SimpleDialog
        isOpen={pendingDelete !== null}
        title={pendingDelete ? `Delete ${singularLabel.toLowerCase()} "${pendingDelete.label}"` : ""}
      >
        <div className="space-y-4">
          {cascadeDelete ? (
            <>
              <InlineAlert>
                This permanently deletes this {singularLabel.toLowerCase()} <strong>and every {cascadeDelete.instancesLabel} of it</strong>. This cannot be undone.
              </InlineAlert>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Type <span className="font-mono">confirm</span> to confirm
                </label>
                <Input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="confirm"
                  autoFocus
                  className="font-mono"
                />
              </div>
            </>
          ) : (
            <p className="text-sm">
              This will permanently remove this {singularLabel.toLowerCase()}. This cannot be undone.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={!canEdit || isDeleting || (cascadeDelete ? !isDeleteConfirmationValid : false)}
            >
              {isDeleting && <WaterLoader />}
              Delete
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={isDeleting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </SimpleDialog>
    </div>
  );
}
