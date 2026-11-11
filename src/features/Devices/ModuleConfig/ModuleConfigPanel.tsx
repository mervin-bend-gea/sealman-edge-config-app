import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage, isForbidden } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { withPermissionRequiredTooltip } from "@/features/authorization/permissions/withPermissionRequiredTooltip";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import {
  findingsOf, moduleConfigApi, useApplyTemplate, useModuleTemplates, useTemplateVersion, useTemplateVersions, type Template, type Values,
} from "@/features/ModuleConfigTemplates/api";
import { NamespaceBadges } from "@/features/ModuleConfigTemplates/badges";
import { FindingsList, VariableForm } from "@/features/ModuleConfigTemplates/components";
import { useDebounced, versionLabel } from "@/features/ModuleConfigTemplates/utils";
import ModuleConfig from "./ModuleConfig";
import ModuleConfigHistory from "./ModuleConfigHistory";

const GuardedButton = withPermissionRequiredTooltip(Button);

type View = "template" | "raw" | "history";

interface Props {
  deviceId: string;
  moduleName: string;
  appMessage?: string;
  moduleStatus: string;
}

/** Module configuration: apply a template, edit the raw JSON, or browse and re-apply the revision history. */
export default function ModuleConfigPanel({ deviceId, moduleName, appMessage, moduleStatus }: Props) {
  const templates = useModuleTemplates(deviceId, moduleName);
  const hasTemplates = (templates.data?.length ?? 0) > 0;
  const [view, setView] = useState<View | null>(null);
  const [prefill, setPrefill] = useState<{ templateId: number; version: number; values: Values } | null>(null);
  // Default to the template view when templates exist for this module, otherwise the raw editor (legacy behaviour).
  const active: View = view ?? (hasTemplates ? "template" : "raw");
  const blocked = moduleStatus === "delete_scheduled" || moduleStatus === "deploy_scheduled";

  const views: { id: View; label: string }[] = [
    { id: "template", label: "Template" },
    { id: "raw", label: "Raw JSON" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="flex h-full flex-col gap-3">
      <div role="tablist" aria-label="Configuration view" className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm">
        {views.map((v) => (
          <button
            key={v.id}
            role="tab"
            type="button"
            aria-selected={active === v.id}
            onClick={() => setView(v.id)}
            className={cn("rounded-md px-3 py-1", active === v.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {active === "template" && (
          <TemplateView deviceId={deviceId} moduleName={moduleName} blocked={blocked} templatesQuery={templates}
                        prefill={prefill} onApplied={() => setView("history")} />
        )}
        {active === "raw" && <ModuleConfig moduleName={moduleName} appMessage={appMessage} moduleStatus={moduleStatus} />}
        {active === "history" && (
          <ModuleConfigHistory deviceId={deviceId} moduleName={moduleName} blocked={blocked}
                       onUseValues={(r) => {
                         setPrefill({ templateId: r.template_id!, version: r.template_version!, values: r.values ?? {} });
                         setView("template");
                       }} />
        )}
      </div>
    </div>
  );
}

function TemplateView({ deviceId, moduleName, blocked, templatesQuery, prefill, onApplied }: {
  deviceId: string;
  moduleName: string;
  blocked: boolean;
  templatesQuery: ReturnType<typeof useModuleTemplates>;
  prefill: { templateId: number; version: number; values: Values } | null;
  onApplied: () => void;
}) {
  const [chosenTemplateId, setTemplateId] = useState<number | undefined>(prefill?.templateId);
  // A single applicable template is preselected.
  const only = templatesQuery.data?.length === 1 ? templatesQuery.data[0].id : undefined;
  const templateId = chosenTemplateId ?? only;
  const [version, setVersion] = useState<number | "latest">(prefill?.version ?? "latest");
  const [values, setValues] = useState<Values>(prefill?.values ?? {});
  const [comment, setComment] = useState("");
  const versions = useTemplateVersions(templateId);
  const loaded = useTemplateVersion(templateId, version);
  const apply = useApplyTemplate(deviceId, moduleName);
  const [applyFindings, setApplyFindings] = useState(apply.data?.findings ?? []);

  const request = useDebounced({ templateId, version: loaded.data?.version, values });
  const render = useQuery({
    queryKey: ["moduleConfigRender", deviceId, moduleName, request],
    queryFn: () => moduleConfigApi.render(deviceId, moduleName, { template_id: request.templateId!, version: request.version, values: request.values }),
    enabled: request.templateId !== undefined && request.version !== undefined,
    placeholderData: (previous) => previous,
  });

  if (templatesQuery.isLoading) return <LoadingState label="Loading templates..." />;
  if (templatesQuery.isError) {
    return (
      <InlineAlert>
        {isForbidden(templatesQuery.error) ? "You may not browse module templates." : getErrorMessage(templatesQuery.error)}
      </InlineAlert>
    );
  }
  if (!templatesQuery.data?.length) {
    return (
      <InlineAlert variant="info">
        No template is available for <code>{moduleName}</code> on this device: none lists the module, or their scopes do not
        include this device. Create one under Module Templates, or use the raw JSON editor.
      </InlineAlert>
    );
  }

  const template = templatesQuery.data.find((t) => t.id === templateId);
  const findings = render.data?.findings ?? [];

  const onApply = () => {
    if (!templateId || !loaded.data) return;
    apply.mutate(
      { template_id: templateId, version: loaded.data.version, values, comment: comment || undefined },
      {
        onSuccess: (result) => {
          toast.success(`Applied ${template?.name} ${versionLabel(loaded.data?.tag, loaded.data?.version)} to ${moduleName}`);
          setApplyFindings(result.findings);
          setComment("");
          onApplied();
        },
        onError: (err) => {
          setApplyFindings(findingsOf(err) ?? []);
          toast.error(`Could not apply: ${getErrorMessage(err)}`);
        },
      },
    );
  };

  return (
    <div className="grid h-full gap-4 overflow-auto lg:grid-cols-2">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="cfg-template">Template</Label>
            <Select value={templateId ? String(templateId) : undefined}
                    onValueChange={(v) => { setTemplateId(Number(v)); setVersion("latest"); setValues({}); }}>
              <SelectTrigger id="cfg-template"><SelectValue placeholder="Select a template" /></SelectTrigger>
              <SelectContent>
                {groupByNamespace(templatesQuery.data).map(([namespace, items]) => (
                  <SelectGroup key={namespace}>
                    <SelectLabel>{namespace}</SelectLabel>
                    {items.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cfg-version">Version</Label>
            <Select disabled={!template} value={String(version)} onValueChange={(v) => setVersion(v === "latest" ? "latest" : Number(v))}>
              <SelectTrigger id="cfg-version"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest{template ? ` (${versionLabel(template.latest_tag, template.latest_version)})` : ""}</SelectItem>
                {versions.data?.map((v) => (
                  <SelectItem key={v.version} value={String(v.version)}>{v.tag}{v.comment ? ` · ${v.comment}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {template && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Namespace <span className="font-medium text-foreground">{template.namespace_name}</span></p>
            <NamespaceBadges modules={template.module_names} scopes={template.scopes} />
          </div>
        )}
        {template?.description && <p className="text-sm text-muted-foreground">{template.description}</p>}

        {loaded.isLoading && <LoadingState label="Loading template..." />}
        {loaded.data && (
          <>
            <VariableForm variables={loaded.data.variables} values={values} onChange={setValues} findings={findings} disabled={blocked} />
            {loaded.data.references.device.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Uses device metadata: {loaded.data.references.device.map((d) => <code key={d} className="mr-1">{d}</code>)}
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="cfg-comment">Comment</Label>
              <Textarea id="cfg-comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
                        placeholder="Why is this change applied? (stored in the history)" disabled={blocked} />
            </div>
            {blocked ? (
              <InlineAlert variant="warning">Cannot change the configuration in the current module state</InlineAlert>
            ) : (
              <GuardedButton
                deviceId={deviceId}
                permissionKey={PERMISSION_KEYS.DEVICE_MODULE_CONFIG_APPLY}
                disabled={apply.isPending || !render.data?.ok}
                onClick={onApply}
              >
                Apply {versionLabel(loaded.data.tag, loaded.data.version)} to {moduleName}
              </GuardedButton>
            )}
            <FindingsList findings={applyFindings} />
          </>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Resulting configuration</h4>
          {render.data && <Badge variant={render.data.ok ? "secondary" : "destructive"}>{render.data.ok ? "valid" : "has errors"}</Badge>}
        </div>
        {render.isError && <InlineAlert>{getErrorMessage(render.error)}</InlineAlert>}
        <FindingsList findings={findings.filter((f) => !f.path.startsWith("/values/"))} />
        {render.data?.config && (
          <pre className="max-h-[50vh] overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(render.data.config, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

function groupByNamespace(templates: Template[]): [string, Template[]][] {
  const groups = new Map<string, Template[]>();
  for (const t of templates) groups.set(t.namespace_name, [...(groups.get(t.namespace_name) ?? []), t]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
