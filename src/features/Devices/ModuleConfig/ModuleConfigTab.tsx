import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { FileJson, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import JsonEditor from "@/components/Input/JsonEditor";
import SearchableSelect from "@/components/Input/SearchableSelect";
import { getErrorMessage, isForbidden } from "@/lib/errors";
import { withPermissionRequiredTooltip } from "@/features/authorization/permissions/withPermissionRequiredTooltip";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import {
  findingsOf, moduleConfigApi, useApplyTemplate, useModuleTemplates, useRevisions, useTemplateVersion, type Template, type Values,
} from "@/features/ModuleConfigTemplates/api";
import { GroupBadges } from "@/features/ModuleConfigTemplates/badges";
import Box from "@/features/ModuleConfigTemplates/Box";
import { FindingsList } from "@/features/ModuleConfigTemplates/components";
import { TEMPLATES_PATH, formatDate, sourceLabel, useDebounced } from "@/features/ModuleConfigTemplates/utils";
import { TemplateInputs, useTemplateInputs } from "./TemplateInputs";

const GuardedButton = withPermissionRequiredTooltip(Button);

/** Values a revision was applied with, to start the apply form from (set by the history's "Edit values"). */
export interface ConfigPrefill {
  templateId: number;
  values: Values;
}

interface Props {
  deviceId: string;
  moduleName: string;
  moduleStatus: string;
  onOpenHistory: () => void;
}

/** The Configuration tab: what is applied now, and the form to apply a template of one of the available template groups. */
export default function ModuleConfigTab({ deviceId, moduleName, moduleStatus, onOpenHistory }: Props) {
  const prefill = (useLocation().state as { prefill?: ConfigPrefill } | null)?.prefill ?? null;
  const templates = useModuleTemplates(deviceId, moduleName);
  const blocked = moduleStatus === "delete_scheduled" || moduleStatus === "deploy_scheduled";

  return (
    <>
      <CurrentConfiguration deviceId={deviceId} moduleName={moduleName} onOpenHistory={onOpenHistory} />
      {templates.isLoading && <LoadingState label="Loading templates..." />}
      {templates.isError && (
        <InlineAlert>
          {isForbidden(templates.error) ? "You may not browse module templates." : getErrorMessage(templates.error)}
        </InlineAlert>
      )}
      {templates.data && templates.data.length === 0 && (
        <Box label="Apply a template" title="Apply a template">
          <InlineAlert variant="info">
            No template is available for <code>{moduleName}</code> on this device: none lists the module, or their scopes do not
            include this device. Create one under <Link className="underline" to={TEMPLATES_PATH}>Module Templates</Link>, or use the Raw JSON tab.
          </InlineAlert>
        </Box>
      )}
      {templates.data && templates.data.length > 0 && (
        <ApplyTemplate key={prefill?.templateId ?? "none"} deviceId={deviceId} moduleName={moduleName} blocked={blocked}
                       templates={templates.data} prefill={prefill} />
      )}
    </>
  );
}

function CurrentConfiguration({ deviceId, moduleName, onOpenHistory }: { deviceId: string; moduleName: string; onOpenHistory: () => void }) {
  const revisions = useRevisions(deviceId, moduleName);
  const current = revisions.data?.revisions.find((r) => r.current);
  return (
    <Box
      label="Current configuration"
      title="Current configuration"
      actions={(
        <Button variant="outline" size="sm" onClick={onOpenHistory}>
          <History className="mr-1 h-4 w-4" /> History
        </Button>
      )}
    >
      {revisions.isLoading && <LoadingState label="Loading..." className="p-2" />}
      {revisions.isError && <InlineAlert variant="warning">Could not load the current configuration: {getErrorMessage(revisions.error)}</InlineAlert>}
      {revisions.data && !current && (
        <p className="text-sm text-muted-foreground">No configuration has been written to this module yet.</p>
      )}
      {current && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Badge variant="outline">{sourceLabel(current.source)}</Badge>
          {current.template_name && <span className="font-medium">{current.template_name}</span>}
          <span>by {current.actor ?? "unknown user"}</span>
          <span className="text-muted-foreground">{formatDate(current.created_at)}</span>
          {current.comment && <span className="text-muted-foreground">· {current.comment}</span>}
        </div>
      )}
    </Box>
  );
}

function ApplyTemplate({ deviceId, moduleName, blocked, templates, prefill }: {
  deviceId: string;
  moduleName: string;
  blocked: boolean;
  templates: Template[];
  prefill: ConfigPrefill | null;
}) {
  const groups = [...new Map(templates.map((t) => [t.group_id, t])).values()]
    .sort((a, b) => a.group_name.localeCompare(b.group_name));
  const [groupChoice, setGroupChoice] = useState<number>();
  const [templateChoice, setTemplateChoice] = useState<number | undefined>(prefill?.templateId);
  const prefilled = templates.find((t) => t.id === prefill?.templateId);
  // A single template group, and a single template within it, are preselected.
  const groupId = groupChoice ?? prefilled?.group_id ?? (groups.length === 1 ? groups[0].group_id : undefined);
  const inGroup = templates.filter((t) => t.group_id === groupId);
  const templateId = templateChoice !== undefined && inGroup.some((t) => t.id === templateChoice)
    ? templateChoice
    : inGroup.length === 1 ? inGroup[0].id : undefined;
  const template = templates.find((t) => t.id === templateId);

  // A revision stores its endpoint and service choices and list entries with the values, under "$endpoints", "$services" and "$lists".
  const loaded = useTemplateVersion(templateId, "latest");
  const form = useTemplateInputs(deviceId, loaded.data, template?.group_id, prefill?.values);
  const { sent, listsValid, servicesChosen } = form;
  const [comment, setComment] = useState("");
  const [showResult, setShowResult] = useState(false);
  const apply = useApplyTemplate(deviceId, moduleName);
  const [applyFindings, setApplyFindings] = useState(apply.data?.findings ?? []);

  const request = useDebounced({ templateId, version: loaded.data?.version, sent });
  const render = useQuery({
    queryKey: ["moduleConfigRender", deviceId, moduleName, request],
    queryFn: () => moduleConfigApi.render(deviceId, moduleName, { template_id: request.templateId!, ...request.sent }),
    enabled: request.templateId !== undefined && request.version !== undefined,
    placeholderData: (previous) => previous,
  });
  const findings = render.data?.findings ?? [];

  const onApply = () => {
    if (!templateId || !loaded.data) return;
    apply.mutate(
      {
        template_id: templateId, ...sent,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          toast.success(`Applied ${template?.name} to ${moduleName}`);
          setApplyFindings(result.findings);
          setComment("");
        },
        onError: (err) => {
          setApplyFindings(findingsOf(err) ?? []);
          toast.error(`Could not apply: ${getErrorMessage(err)}`);
        },
      },
    );
  };

  return (
    <>
      <Box
        label="Apply a template"
        title="Apply a template"
        description="Pick a template group and one of its templates, fill in the inputs and apply it to this module."
        actions={(
          <>
            {render.data && <Badge variant={render.data.ok ? "secondary" : "destructive"}>{render.data.ok ? "valid" : "has errors"}</Badge>}
            <Button variant="outline" size="sm" disabled={!render.data?.config} onClick={() => setShowResult(true)}>
              <FileJson className="mr-1 h-4 w-4" /> Show resulting configuration
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_16rem]">
          <div className="space-y-1">
            <Label htmlFor="cfg-group">Template Group</Label>
            <SearchableSelect
              id="cfg-group"
              value={groupId === undefined ? null : String(groupId)}
              options={groups.map((t) => {
                const count = templates.filter((x) => x.group_id === t.group_id).length;
                return { value: String(t.group_id), label: t.group_name, hint: `${count} ${count === 1 ? "template" : "templates"}` };
              })}
              placeholder="Select a template group"
              searchPlaceholder="Search template groups"
              emptyText="No template group found."
              onChange={(v) => { setGroupChoice(Number(v)); setTemplateChoice(undefined); form.reset(); }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cfg-template">Template</Label>
            <SearchableSelect
              id="cfg-template"
              disabled={groupId === undefined}
              value={templateId === undefined ? null : String(templateId)}
              options={inGroup.map((t) => ({ value: String(t.id), label: t.name, hint: t.description ?? undefined }))}
              placeholder={groupId === undefined ? "Select a template group first" : "Select a template"}
              searchPlaceholder="Search templates"
              emptyText="No template found."
              onChange={(v) => { setTemplateChoice(Number(v)); form.reset(); }}
            />
          </div>
        </div>

        {template && (
          <div className="space-y-1">
            {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
            <GroupBadges modules={template.module_names} scopes={template.scopes} />
          </div>
        )}

        {loaded.isLoading && <LoadingState label="Loading template..." />}
        {loaded.data && (
          <>
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Inputs</h3>
              <TemplateInputs form={form} findings={findings} blocked={blocked} />
              {render.isError && <InlineAlert>{getErrorMessage(render.error)}</InlineAlert>}
              <FindingsList findings={findings.filter((f) => !f.path.startsWith("/values/"))} />
            </div>

            <div className="space-y-2 border-t pt-4">
              {blocked ? (
                <InlineAlert variant="warning">Cannot change the configuration in the current module state</InlineAlert>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-64 flex-1 space-y-1">
                    <Label htmlFor="cfg-comment">Comment</Label>
                    <Input id="cfg-comment" value={comment} onChange={(e) => setComment(e.target.value)}
                           placeholder="Why is this change applied? (stored in the history)" />
                  </div>
                  <GuardedButton
                    deviceId={deviceId}
                    permissionKey={PERMISSION_KEYS.DEVICE_MODULE_CONFIG_APPLY}
                    disabled={apply.isPending || !render.data?.ok || !listsValid || !servicesChosen}
                    onClick={onApply}
                  >
                    Apply to {moduleName}
                  </GuardedButton>
                </div>
              )}
              {render.data && !render.data.ok && !blocked && (
                <p className="text-xs text-muted-foreground">The configuration has errors: fix the inputs above to apply it.</p>
              )}
              <FindingsList findings={applyFindings} />
            </div>
          </>
        )}
      </Box>

      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Resulting configuration</DialogTitle>
            <DialogDescription>What would be written to {moduleName} with the current inputs and this device's metadata.</DialogDescription>
          </DialogHeader>
          <JsonEditor label="Resulting configuration" value={JSON.stringify(render.data?.config ?? {}, null, 2)} readOnly
                      allowFullscreen={false} className="h-[60vh]" />
        </DialogContent>
      </Dialog>
    </>
  );
}
