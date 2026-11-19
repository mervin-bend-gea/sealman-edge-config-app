import { useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineAlert } from "@/components/ui/page-state";
import { getErrorMessage } from "@/lib/errors";
import { edgeConfigApiHooks } from "@/api/edgeConfig/edgeConfigApiHooks";
import { invalidateTemplates, moduleConfigApi, type TemplateGroup } from "./api";
import BadgeMultiSelect from "./BadgeMultiSelect";
import { ScopeBadge } from "./badges";
import ModuleNameInput from "./ModuleNameInput";

interface Props {
  /** The template group to show and edit; none to create one. */
  group?: TemplateGroup;
  canWrite: boolean;
  onSaved: (group: TemplateGroup) => void;
  onDeleted?: () => void;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Details box of a template group: name, description, the modules and the scopes its templates are tied to. */
export default function TemplateGroupDetails({ group, canWrite, onSaved, onDeleted }: Props) {
  const scopes = edgeConfigApiHooks.useGetScopes();
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [modules, setModules] = useState<string[]>(group?.module_names ?? []);
  const [scopeIds, setScopeIds] = useState<string[]>(group?.scopes.map((s) => s.id) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const scopeOptions = (scopes.data ?? []).map((s) => ({ value: String(s.id), label: s.name }));
  // scopes that were selected earlier stay visible (by name) even if the scope list cannot be read
  for (const s of group?.scopes ?? []) {
    if (!scopeOptions.some((o) => o.value === s.id)) scopeOptions.push({ value: s.id, label: s.name });
  }

  const dirty = !group
    || name.trim() !== group.name
    || description.trim() !== (group.description ?? "")
    || !sameSet(modules, group.module_names)
    || !sameSet(scopeIds, group.scopes.map((s) => s.id));
  const valid = name.trim() !== "" && modules.length > 0;

  const save = async () => {
    setBusy(true);
    setError(undefined);
    const payload = { name: name.trim(), description: description.trim(), module_names: modules, scope_ids: scopeIds };
    try {
      const saved = group
        ? await moduleConfigApi.updateGroup(group.id, payload)
        : await moduleConfigApi.createGroup({ ...payload, description: payload.description || undefined });
      await invalidateTemplates();
      toast.success(`Template Group ${saved.name} ${group ? "saved" : "created"}`);
      onSaved(saved);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!group) return;
    setBusy(true);
    setError(undefined);
    try {
      await moduleConfigApi.deleteGroup(group.id);
      await invalidateTemplates();
      toast.success(`Template Group ${group.name} deleted`);
      onDeleted?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Template Group details" className="w-full space-y-5 rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">{group ? "Edit template group" : "New template group"}</h2>
        <p className="text-sm text-muted-foreground">
          Templates of this template group can only be applied to the modules listed here and, if scopes are set, only to
          devices within one of those scopes.
        </p>
      </div>

      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (valid && dirty && canWrite) void save(); }}>
        <div className="space-y-1">
          <Label htmlFor="ns-name">Name</Label>
          <Input id="ns-name" disabled={!canWrite} placeholder="e.g. Production line - OPC UA" value={name}
                 onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ns-description">Description</Label>
          <Input id="ns-description" disabled={!canWrite} placeholder="What these templates are for"
                 value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ns-modules">Modules</Label>
          <ModuleNameInput id="ns-modules" modules={modules} onChange={setModules} disabled={!canWrite} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ns-scopes">Scopes</Label>
          <BadgeMultiSelect
            id="ns-scopes"
            selected={scopeIds}
            onChange={setScopeIds}
            options={scopeOptions}
            disabled={!canWrite}
            emptyText="No scope: accessible for everyone"
            addLabel="Add scope"
            searchPlaceholder="Search scopes"
            renderBadge={(value, label, onRemove) => <ScopeBadge key={value} name={label} onRemove={onRemove} />}
          />
          <p className="text-xs text-muted-foreground">
            Devices matching one of these scopes may use the template group's templates.
            {scopes.isError && canWrite && " The scope list could not be loaded (it needs permission to read the authorization data)."}
          </p>
        </div>

        {error && <InlineAlert>{error}</InlineAlert>}

        {canWrite && (
          <div className="flex items-center justify-between gap-3">
            {group && group.template_count === 0 ? (
              <Button type="button" variant="outline" className="text-red-700" disabled={busy} onClick={() => void remove()}>
                Delete template group
              </Button>
            ) : <span />}
            <Button type="submit" disabled={busy || !valid || !dirty}>
              {group ? "Save template group" : "Create template group"}
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}
