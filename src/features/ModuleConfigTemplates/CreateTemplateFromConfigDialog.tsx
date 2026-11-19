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
import { findingsOf, invalidateTemplates, moduleConfigApi, useTemplateGroups, type Finding } from "./api";
import { GroupBadges } from "./badges";
import { FindingsList } from "./components";
import { escapePlaceholders } from "./utils";

const NEW_GROUP = "__new__";

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
  const groups = useTemplateGroups(moduleName);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [choice, setChoice] = useState<string>();
  const [newGroup, setNewGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState<string>();

  const isObject = typeof config === "object" && config !== null && !Array.isArray(config);
  const options = groups.data ?? [];
  // without an explicit choice: the first template group that lists the module, else a new template group
  const effective = choice ?? (options[0] ? String(options[0].id) : NEW_GROUP);
  const chosen = options.find((n) => String(n.id) === effective);
  const ready = name.trim() !== "" && (effective !== NEW_GROUP || newGroup.trim() !== "") && !groups.isLoading;

  const close = (next: boolean) => {
    if (!next) {
      setName("");
      setDescription("");
      setChoice(undefined);
      setNewGroup("");
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
      let groupId = chosen?.id;
      if (groupId === undefined) {
        const group = await moduleConfigApi.createGroup({ name: newGroup.trim(), module_names: [moduleName], scope_ids: [] });
        groupId = group.id;
        setChoice(String(group.id));
      }
      const created = await moduleConfigApi.createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        group_id: groupId,
        body: escapePlaceholders(config),
        variables: [],
        comment: `Created from the configuration of ${moduleName}`,
      });
      await invalidateTemplates();
      toast.success(`Template ${created.name} created`);
      close(false);
      navigate(`/module-templates/${groupId}/templates/${created.id}`);
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
              <Label htmlFor="from-config-group">Template Group</Label>
              {groups.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading template groups...</p>
              ) : (
                <Select value={effective} onValueChange={setChoice}>
                  <SelectTrigger id="from-config-group"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>)}
                    <SelectItem value={NEW_GROUP}>New template group...</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {groups.isLoading ? null : chosen ? (
                <GroupBadges modules={chosen.module_names} scopes={chosen.scopes} className="pt-1" />
              ) : (
                <div className="space-y-1 pt-1">
                  <Input aria-label="New template group name" placeholder="e.g. Production line - OPC UA" value={newGroup}
                         onChange={(e) => setNewGroup(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Tied to {moduleName}, accessible for everyone. Add scopes later in the template group settings.</p>
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
