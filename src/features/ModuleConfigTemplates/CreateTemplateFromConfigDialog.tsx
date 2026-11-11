import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineAlert } from "@/components/ui/page-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/errors";
import { findingsOf, invalidateTemplates, moduleConfigApi, useNamespaces, type Finding } from "./api";
import { NamespaceBadges } from "./badges";
import { FindingsList } from "./components";
import { escapePlaceholders } from "./utils";

const NEW_NAMESPACE = "__new__";

/** Asks for a name and saves a module's configuration as a new template (version 1, no variables yet). */
export default function CreateTemplateFromConfigDialog({
  open,
  onOpenChange,
  moduleName,
  config,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleName: string;
  config: unknown;
}) {
  const navigate = useNavigate();
  const namespaces = useNamespaces(moduleName);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [choice, setChoice] = useState<string>();
  const [newNamespace, setNewNamespace] = useState("");
  const [busy, setBusy] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState<string>();

  const isObject = typeof config === "object" && config !== null && !Array.isArray(config);
  const options = namespaces.data ?? [];
  // without an explicit choice: the first namespace that lists the module, else a new namespace
  const effective = choice ?? (options[0] ? String(options[0].id) : NEW_NAMESPACE);
  const chosen = options.find((n) => String(n.id) === effective);
  const ready = name.trim() !== "" && (effective !== NEW_NAMESPACE || newNamespace.trim() !== "") && !namespaces.isLoading;

  const close = (next: boolean) => {
    if (!next) {
      setName("");
      setDescription("");
      setChoice(undefined);
      setNewNamespace("");
      setFindings([]);
      setError(undefined);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    setBusy(true);
    setFindings([]);
    setError(undefined);
    try {
      let namespaceId = chosen?.id;
      if (namespaceId === undefined) {
        const namespace = await moduleConfigApi.createNamespace({ name: newNamespace.trim(), module_names: [moduleName], scope_ids: [] });
        namespaceId = namespace.id;
        setChoice(String(namespace.id));
      }
      const created = await moduleConfigApi.createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        namespace_id: namespaceId,
        body: escapePlaceholders(config),
        variables: [],
        comment: `Created from the configuration of ${moduleName}`,
      });
      await invalidateTemplates();
      toast.success(`Template ${created.name} created`);
      close(false);
      navigate(`/module-templates/${namespaceId}/templates/${created.id}`);
    } catch (err) {
      setFindings(findingsOf(err) ?? []);
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create template from this configuration</DialogTitle>
          <DialogDescription>
            Saves the editor content as version 1 of a new template for <code>{moduleName}</code>. Turn values into
            variables afterwards in the template editor.
          </DialogDescription>
        </DialogHeader>
        {!isObject ? (
          <InlineAlert>The configuration must be a JSON object.</InlineAlert>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) void submit();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="from-config-name">Name</Label>
              <Input id="from-config-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="from-config-description">Description</Label>
              <Input id="from-config-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="from-config-namespace">Namespace</Label>
              {namespaces.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading namespaces...</p>
              ) : (
                <Select value={effective} onValueChange={setChoice}>
                  <SelectTrigger id="from-config-namespace"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>)}
                    <SelectItem value={NEW_NAMESPACE}>New namespace...</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {namespaces.isLoading ? null : chosen ? (
                <NamespaceBadges modules={chosen.module_names} scopes={chosen.scopes} className="pt-1" />
              ) : (
                <div className="space-y-1 pt-1">
                  <Input aria-label="New namespace name" placeholder="e.g. Production line - OPC UA" value={newNamespace}
                         onChange={(e) => setNewNamespace(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Tied to {moduleName}, accessible for everyone. Add scopes later in the namespace settings.</p>
                </div>
              )}
            </div>
            {error && <InlineAlert>{error}</InlineAlert>}
            <FindingsList findings={findings} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !ready}>Create template</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
