import { useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineAlert } from "@/components/ui/page-state";
import { getErrorMessage } from "@/lib/errors";
import { edgeConfigApiHooks } from "@/api/edgeConfig/edgeConfigApiHooks";
import { invalidateTemplates, moduleConfigApi, type Namespace } from "./api";
import BadgeMultiSelect from "./BadgeMultiSelect";
import { ScopeBadge } from "./badges";
import ModuleNameInput from "./ModuleNameInput";

interface Props {
  /** The namespace to show and edit; none to create one. */
  namespace?: Namespace;
  canWrite: boolean;
  onSaved: (namespace: Namespace) => void;
  onDeleted?: () => void;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Details box of a namespace: name, description, the modules and the scopes its templates are tied to. */
export default function NamespaceDetails({ namespace, canWrite, onSaved, onDeleted }: Props) {
  const scopes = edgeConfigApiHooks.useGetScopes();
  const [name, setName] = useState(namespace?.name ?? "");
  const [description, setDescription] = useState(namespace?.description ?? "");
  const [modules, setModules] = useState<string[]>(namespace?.module_names ?? []);
  const [scopeIds, setScopeIds] = useState<string[]>(namespace?.scopes.map((s) => s.id) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const scopeOptions = (scopes.data ?? []).map((s) => ({ value: String(s.id), label: s.name }));
  // scopes that were selected earlier stay visible (by name) even if the scope list cannot be read
  for (const s of namespace?.scopes ?? []) {
    if (!scopeOptions.some((o) => o.value === s.id)) scopeOptions.push({ value: s.id, label: s.name });
  }

  const dirty = !namespace
    || name.trim() !== namespace.name
    || description.trim() !== (namespace.description ?? "")
    || !sameSet(modules, namespace.module_names)
    || !sameSet(scopeIds, namespace.scopes.map((s) => s.id));
  const valid = name.trim() !== "" && modules.length > 0;

  const save = async () => {
    setBusy(true);
    setError(undefined);
    const payload = { name: name.trim(), description: description.trim(), module_names: modules, scope_ids: scopeIds };
    try {
      const saved = namespace
        ? await moduleConfigApi.updateNamespace(namespace.id, payload)
        : await moduleConfigApi.createNamespace({ ...payload, description: payload.description || undefined });
      await invalidateTemplates();
      toast.success(`Namespace ${saved.name} ${namespace ? "saved" : "created"}`);
      onSaved(saved);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!namespace) return;
    setBusy(true);
    setError(undefined);
    try {
      await moduleConfigApi.deleteNamespace(namespace.id);
      await invalidateTemplates();
      toast.success(`Namespace ${namespace.name} deleted`);
      onDeleted?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Namespace details" className="w-full space-y-5 rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">{namespace ? "Edit namespace" : "New namespace"}</h2>
        <p className="text-sm text-muted-foreground">
          Templates of this namespace can only be applied to the modules listed here and, if scopes are set, only to
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
            Devices matching one of these scopes may use the namespace's templates.
            {scopes.isError && canWrite && " The scope list could not be loaded (it needs permission to read the authorization data)."}
          </p>
        </div>

        {error && <InlineAlert>{error}</InlineAlert>}

        {canWrite && (
          <div className="flex items-center justify-between gap-3">
            {namespace && namespace.template_count === 0 ? (
              <Button type="button" variant="outline" className="text-red-700" disabled={busy} onClick={() => void remove()}>
                Delete namespace
              </Button>
            ) : <span />}
            <Button type="submit" disabled={busy || !valid || !dirty}>
              {namespace ? "Save namespace" : "Create namespace"}
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}
