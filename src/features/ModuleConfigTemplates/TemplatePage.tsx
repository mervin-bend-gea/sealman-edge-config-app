import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Archive, ArchiveRestore, ArrowLeft, Copy, FileJson, GitCompare, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import JsonEditor from "@/components/Input/JsonEditor";
import { getErrorMessage, isForbidden } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import {
  findingsOf, invalidateTemplates, moduleConfigApi, useNamespaces, useTemplates, useTemplateVersion, useTemplateVersions,
  type ExampleDevice, type Finding, type Namespace, type Template, type TemplateVersionSummary, type VariableDecl, type Values,
} from "./api";
import { NamespaceBadges } from "./badges";
import Box from "./Box";
import { FindingsList, VariableForm, VariablesEditor } from "./components";
import DiffView from "./DiffView";
import ExampleDevicePicker from "./ExampleDevicePicker";
import SearchableSelect from "@/components/Input/SearchableSelect";
import {
  TEMPLATES_PATH, EDITOR_HEIGHT, VERSION_TAG_PATTERN, canonical, cleanVariables, deviceReferences, formatDate, placeholderAnnotations,
  placeholderMarkers, templatePath, useDebounced, variableProblems, versionLabel,
} from "./utils";

const EXAMPLE_BODY = `{
  "interval": "\${interval}",
  "site": "\${device.city}"
}`;

// the fields of the platform's default device type, for the preview of ${device.*}
const SAMPLE_DEVICE_METADATA = JSON.stringify(
  { city: "Aachen", countryCode: "DE", description: "Sample device", geoLocation: "50.775, 6.083" },
  null,
  2,
);

const PREVIEW_COLLAPSED_KEY = "moduleTemplatePreviewCollapsed";

interface Draft {
  name: string;
  description: string;
  namespaceId: number | null;
  body: string;
  variables: VariableDecl[];
  comment: string;
}

const emptyDraft = (namespaceId: number | null): Draft => ({
  name: "", description: "", namespaceId, body: EXAMPLE_BODY, comment: "",
  variables: [{ name: "interval", type: "integer", required: true }],
});

function parseBody(text: string): { body?: unknown; error?: string } {
  try {
    return { body: JSON.parse(text) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

/** The first "v<n>" nobody uses yet. */
function suggestTag(taken: string[], latestVersion?: number | null) {
  let n = (latestVersion ?? 0) + 1;
  while (taken.includes(`v${n}`)) n++;
  return `v${n}`;
}


/** Subpage of a namespace: one template (or a new one) with its versions, preview and duplicate. */
export default function TemplatePage() {
  const { namespaceId, templateId } = useParams();
  const navigate = useNavigate();
  const namespaces = useNamespaces();
  const templates = useTemplates(undefined, true);
  const { hasPermission: canWrite } = usePermissions({ permissionKey: PERMISSION_KEYS.MODULE_CONFIG_TEMPLATE_WRITE });

  const template = templateId === undefined ? undefined : templates.data?.find((t) => t.id === Number(templateId));
  const home = namespaces.data?.find((n) => n.id === (template?.namespace_id ?? Number(namespaceId)));
  const error = namespaces.error ?? templates.error;
  const loading = namespaces.isLoading || templates.isLoading;

  return (
    <>
      <Link
        to={home ? `${TEMPLATES_PATH}/${home.id}` : TEMPLATES_PATH}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {home ? `Back to ${home.name}` : "All namespaces"}
      </Link>
      {loading && <LoadingState label="Loading template..." />}
      {error && <InlineAlert>{isForbidden(error) ? "You may not browse module templates." : getErrorMessage(error)}</InlineAlert>}
      {!loading && !error && !home && <InlineAlert variant="info">This namespace does not exist (any more).</InlineAlert>}
      {!loading && !error && home && templateId !== undefined && !template && (
        <InlineAlert variant="info">This template does not exist (any more).</InlineAlert>
      )}
      {home && namespaces.data && (templateId === undefined || template) && (
        <TemplateForm
          key={template?.id ?? "new"}
          template={template}
          namespaces={namespaces.data}
          initialNamespaceId={home.id}
          canWrite={canWrite}
          onOpen={(t) => navigate(templatePath(t.namespace_id, t.id), { replace: true })}
        />
      )}
    </>
  );
}

function TemplateForm({ template, namespaces, initialNamespaceId, canWrite, onOpen }: {
  template?: Template;
  namespaces: Namespace[];
  initialNamespaceId: number;
  canWrite: boolean;
  onOpen: (t: Template) => void;
}) {
  const [version, setVersion] = useState<number | "latest">("latest");
  const versions = useTemplateVersions(template?.id);
  const loaded = useTemplateVersion(template?.id, version);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(initialNamespaceId));
  const [tagInput, setTagInput] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverFindings, setServerFindings] = useState<Finding[]>([]);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const readOnly = !canWrite || !!template?.archived;

  useEffect(() => {
    if (!template || !loaded.data) return;
    setDraft({
      name: template.name,
      description: template.description ?? "",
      namespaceId: template.namespace_id,
      body: JSON.stringify(loaded.data.body, null, 2),
      variables: loaded.data.variables,
      comment: "",
    });
    setServerFindings([]);
  }, [template, loaded.data]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const parsed = useMemo(() => parseBody(draft.body), [draft.body]);
  const viewed = loaded.data;
  const namespace = namespaces.find((n) => n.id === draft.namespaceId);
  const markers = useMemo(
    () => placeholderMarkers(draft.body, draft.variables.map((v) => v.name.trim()).filter(Boolean)),
    [draft.body, draft.variables],
  );
  const annotations = useMemo(() => placeholderAnnotations(markers), [markers]);

  const takenTags = useMemo(() => (versions.data ?? []).map((v) => v.tag), [versions.data]);
  const tag = (tagInput ?? (template ? suggestTag(takenTags, template.latest_version) : "v1")).trim();
  const variableIssues = useMemo(() => variableProblems(draft.variables), [draft.variables]);

  const contentChanged = !template || !viewed
    || viewed.version !== template.latest_version
    || (!parsed.error && canonical(parsed.body) !== canonical(viewed.body))
    || canonical(cleanVariables(draft.variables)) !== canonical(cleanVariables(viewed.variables));
  const metaChanged = !!template && (
    draft.name.trim() !== template.name
    || draft.description !== (template.description ?? "")
    || draft.namespaceId !== template.namespace_id
  );

  const blocker = (() => {
    if (parsed.error) return "The JSON has a syntax error.";
    if (!draft.name.trim()) return "The template needs a name.";
    if (draft.namespaceId == null) return "Select a namespace.";
    if (variableIssues.length) return "Fix the variable declarations.";
    if (template && !contentChanged && !metaChanged) return "No changes to save.";
    if (contentChanged) {
      if (!tag) return "Give this version a tag.";
      if (!VERSION_TAG_PATTERN.test(tag)) return "The tag may use letters, digits, space and . _ + - (max. 64, starting with a letter or digit).";
      if (takenTags.includes(tag)) return `A version tagged '${tag}' already exists.`;
    }
    return undefined;
  })();
  const saveLabel = !template ? "Create template" : contentChanged ? "Save new version" : "Save details";

  const save = async () => {
    if (blocker) return;
    setSaving(true);
    setServerFindings([]);
    const content = {
      body: parsed.body, variables: cleanVariables(draft.variables), comment: draft.comment.trim() || undefined, tag,
    };
    try {
      if (!template) {
        const created = await moduleConfigApi.createTemplate({
          ...content, name: draft.name.trim(), description: draft.description || undefined, namespace_id: draft.namespaceId!,
        });
        toast.success(`Template ${created.name} created`);
        await invalidateTemplates();
        onOpen(created);
        return;
      }
      const meta = { name: draft.name.trim(), description: draft.description, namespace_id: draft.namespaceId ?? template.namespace_id };
      if (metaChanged) await moduleConfigApi.updateTemplate(template.id, meta);
      if (contentChanged) {
        const saved = await moduleConfigApi.addVersion(template.id, content);
        toast.success(`Saved ${meta.name} as ${saved.tag}`);
        setVersion("latest");
        setTagInput(null);
        set({ comment: "" });
      } else {
        toast.success(`Saved the details of ${meta.name}`);
      }
      await invalidateTemplates();
    } catch (err) {
      const findings = findingsOf(err);
      if (findings) setServerFindings(findings);
      toast.error(`Could not save the template: ${getErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const setArchived = async (archived: boolean) => {
    if (!template) return;
    try {
      await moduleConfigApi.updateTemplate(template.id, { archived });
      toast.success(archived ? `${template.name} archived` : `${template.name} restored`);
      await invalidateTemplates();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (template && loaded.isLoading) return <LoadingState label="Loading template..." />;
  if (template && loaded.isError) return <InlineAlert>{getErrorMessage(loaded.error)}</InlineAlert>;

  const detailActions = template && (
    <>
      <Select value={String(version)} onValueChange={(v) => setVersion(v === "latest" ? "latest" : Number(v))}>
        <SelectTrigger className="w-72" aria-label="Version"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="latest">Latest ({versionLabel(template.latest_tag, template.latest_version)})</SelectItem>
          {versions.data?.map((v) => (
            <SelectItem key={v.version} value={String(v.version)}>
              {v.tag} · {formatDate(v.created_at)}{v.comment ? ` · ${v.comment}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" disabled={(versions.data?.length ?? 0) < 2} onClick={() => setCompareOpen(true)}>
        <GitCompare className="mr-1 h-4 w-4" /> Compare versions
      </Button>
      <Button variant="outline" size="sm" disabled={!canWrite} onClick={() => setDuplicateOpen(true)}>
        <Copy className="mr-1 h-4 w-4" /> Duplicate
      </Button>
      {template.archived ? (
        <Button variant="outline" size="sm" disabled={!canWrite} onClick={() => void setArchived(false)}>
          <ArchiveRestore className="mr-1 h-4 w-4" /> Restore
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={!canWrite} onClick={() => void setArchived(true)}>
          <Archive className="mr-1 h-4 w-4" /> Archive
        </Button>
      )}
    </>
  );

  return (
    <>
      <Box label="Template details" title={template ? template.name : "New template"} actions={detailActions}>
        {template?.derived_from_template_id && (
          <p className="text-xs text-muted-foreground">
            Duplicated from template #{template.derived_from_template_id} (version {template.derived_from_version})
          </p>
        )}
        {template?.archived && <InlineAlert variant="info">Archived: restore the template to edit or apply it.</InlineAlert>}
        {template && viewed && viewed.version !== template.latest_version && !readOnly && (
          <InlineAlert variant="info">
            Viewing {viewed.tag}, not the latest version. Saving creates a new version with this content.
          </InlineAlert>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="tpl-name">Name</Label>
            <Input id="tpl-name" disabled={readOnly} placeholder="e.g. Anonymous client, packaging line"
                   value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-description">Description</Label>
            <Input id="tpl-description" disabled={readOnly} placeholder="What this template configures and when to use it"
                   value={draft.description} onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-namespace">Namespace</Label>
            <SearchableSelect id="tpl-namespace" disabled={readOnly} value={draft.namespaceId == null ? null : String(draft.namespaceId)}
                              options={namespaces.map((n) => ({ value: String(n.id), label: n.name, hint: n.module_names.join(", ") }))}
                              placeholder="Select a namespace" searchPlaceholder="Search namespaces" emptyText="No namespace found."
                              onChange={(namespaceId) => set({ namespaceId: Number(namespaceId) })} />
          </div>
          <div className="space-y-1" aria-label="Namespace modules and scopes">
            <Label>Applies to</Label>
            <div className="flex min-h-10 items-center">
              {namespace
                ? <NamespaceBadges modules={namespace.module_names} scopes={namespace.scopes} />
                : <span className="text-sm text-muted-foreground">Select a namespace</span>}
            </div>
          </div>
        </div>
      </Box>

      <Box
        label="Configuration template"
        title="Configuration template"
        description="The JSON that is written to the module. Placeholders in values are filled in when the template is applied."
        actions={(
          <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span><code className="rounded bg-green-100 px-1 text-green-900">{"${variable}"}</code> declared variable</span>
            <span><code className="rounded bg-blue-100 px-1 text-blue-900">{"${device.field}"}</code> device metadata</span>
            <span><code className="rounded bg-red-100 px-1 text-red-900">{"${unknown}"}</code> not declared / invalid</span>
            <span title="Write $${ where the configuration itself needs the text ${">
              <code className="rounded bg-slate-200 px-1">{"$${"}</code> escape: written as the literal <code>{"${"}</code>
            </span>
          </p>
        )}
      >
        <JsonEditor label="Configuration template" value={draft.body} readOnly={readOnly} onChange={(body) => set({ body })}
                    markers={markers} annotations={annotations} className={EDITOR_HEIGHT} />
      </Box>

      <Box label="Template variables" title="Variables"
           description="The values asked for when the template is applied. Reference them in the template as ${name}.">
        <VariablesEditor variables={draft.variables} disabled={readOnly} onChange={(variables) => set({ variables })} />
      </Box>

      <Preview body={parsed.body} bodyError={parsed.error} variables={draft.variables} namespaceId={draft.namespaceId} />

      {serverFindings.length > 0 && (
        <Box label="Template findings" title="Findings"><FindingsList findings={serverFindings} /></Box>
      )}

      {!readOnly && (
        <Box label="Save template">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1 space-y-1">
              <Label htmlFor="tpl-comment">Change comment</Label>
              <Input id="tpl-comment" value={draft.comment} onChange={(e) => set({ comment: e.target.value })}
                     placeholder="What changed and why" disabled={!!template && !contentChanged} />
            </div>
            <div className="w-56 space-y-1">
              <Label htmlFor="tpl-tag">Version tag</Label>
              <Input id="tpl-tag" value={tagInput ?? tag} onChange={(e) => setTagInput(e.target.value)}
                     disabled={!!template && !contentChanged} aria-invalid={(!!blocker && /tag/i.test(blocker)) || undefined} />
            </div>
            <Button disabled={saving || !!blocker} onClick={() => void save()}>{saveLabel}</Button>
          </div>
          {blocker && <p className="text-xs text-muted-foreground">{blocker}</p>}
        </Box>
      )}

      {template && (
        <>
          <DuplicateDialog open={duplicateOpen} onOpenChange={setDuplicateOpen} template={template} namespaces={namespaces}
                           version={viewed?.version} versionTag={viewed?.tag} onDuplicated={onOpen} />
          {versions.data && (
            <CompareDialog open={compareOpen} onOpenChange={setCompareOpen} templateId={template.id} versions={versions.data} />
          )}
        </>
      )}
    </>
  );
}

function VersionMeta({ label, version }: { label: string; version?: TemplateVersionSummary }) {
  if (!version) return null;
  return (
    <p className="text-xs">
      <span className="font-medium">{label} {version.tag}</span>
      <span className="text-muted-foreground">
        {" "}by {version.created_by ?? "unknown"} on {formatDate(version.created_at)}{version.comment ? `: ${version.comment}` : ""}
      </span>
    </p>
  );
}

/** Compares two saved versions of a template (body and variables); defaults to the latest against its predecessor. */
function CompareDialog({ open, onOpenChange, templateId, versions }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: number;
  versions: TemplateVersionSummary[];
}) {
  const latest = versions[0]?.version;
  const [toChoice, setTo] = useState<number>();
  const [fromChoice, setFrom] = useState<number>();
  const to = toChoice ?? latest;
  const from = fromChoice ?? versions.find((v) => v.version < (to ?? 0))?.version ?? to;
  const before = useTemplateVersion(open ? templateId : undefined, from ?? "latest");
  const after = useTemplateVersion(open ? templateId : undefined, to ?? "latest");
  const pick = (label: string, value: number | undefined, onChange: (v: number) => void) => (
    <Select value={value === undefined ? undefined : String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-44" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        {versions.map((v) => <SelectItem key={v.version} value={String(v.version)}>{v.tag}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const byNumber = (n?: number) => versions.find((v) => v.version === n);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Compare versions</DialogTitle>
          <DialogDescription>Differences in the configuration template and the variables.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            From {pick("Compare from version", from, setFrom)} to {pick("Compare to version", to, setTo)}
          </div>
          <VersionMeta label="From" version={byNumber(from)} />
          <VersionMeta label="To" version={byNumber(to)} />
          {from === to ? (
            <p className="text-sm text-muted-foreground">Select two different versions.</p>
          ) : before.isLoading || after.isLoading ? (
            <LoadingState label="Loading versions..." className="p-2" />
          ) : before.data && after.data ? (
            <DiffView
              before={{ body: before.data.body, variables: before.data.variables }}
              after={{ body: after.data.body, variables: after.data.variables }}
              beforeLabel={before.data.tag}
              afterLabel={after.data.tag}
            />
          ) : (
            <InlineAlert>{getErrorMessage(before.error ?? after.error)}</InlineAlert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Live render of the edited template with sample values and sample device metadata. */
function Preview({ body, bodyError, variables, namespaceId }: {
  body: unknown;
  bodyError?: string;
  variables: VariableDecl[];
  namespaceId: number | null;
}) {
  const [values, setValues] = useState<Values>({});
  const [source, setSource] = useState<"sample" | "device">("sample");
  const [deviceText, setDeviceText] = useState(SAMPLE_DEVICE_METADATA);
  const [chosen, setChosen] = useState<{ device: ExampleDevice; namespaceId: number | null } | null>(null);
  // the device must be in the namespace's scopes, so a device chosen for another namespace no longer counts
  const exampleDevice = chosen && chosen.namespaceId === namespaceId ? chosen.device : null;
  const [showConfig, setShowConfig] = useState(false);
  const sample = useMemo(() => parseBody(deviceText), [deviceText]);
  const usingDevice = source === "device";
  const request = useDebounced({
    body, variables: cleanVariables(variables), values,
    ...(usingDevice
      ? (exampleDevice && namespaceId !== null ? { device_id: exampleDevice.device_id, namespace_id: namespaceId } : {})
      : { device: sample.body as Values | undefined }),
  });
  const preview = useQuery({
    queryKey: ["moduleConfigTemplatePreview", request],
    queryFn: () => moduleConfigApi.preview(request),
    enabled: !bodyError && (usingDevice ? !!exampleDevice && namespaceId !== null : !sample.error),
    placeholderData: (previous) => previous,
  });
  const config = preview.data?.config;
  const deviceFields = useMemo(() => deviceReferences(body), [body]);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(PREVIEW_COLLAPSED_KEY) !== "0");
  const toggle = () => setCollapsed((c) => {
    localStorage.setItem(PREVIEW_COLLAPSED_KEY, c ? "0" : "1");
    return !c;
  });

  return (
    <>
      <Box label="Preview" title="Preview"
           description="Try the template with sample values. The inputs are the ones asked for when it is applied."
           collapse={{ collapsed, onToggle: toggle }}
           actions={(
             <>
               {preview.data && (
                 <Badge variant={preview.data.ok ? "secondary" : "destructive"}>{preview.data.ok ? "valid" : "has errors"}</Badge>
               )}
               <Button variant="outline" size="sm" disabled={!config || !!bodyError} onClick={() => setShowConfig(true)}>
                 <FileJson className="mr-1 h-4 w-4" /> Show rendered configuration
               </Button>
             </>
           )}>
        <VariableForm variables={cleanVariables(variables).filter((v) => v.name)} values={values} onChange={setValues}
                      findings={preview.data?.findings} />
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium leading-none">Device metadata</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="About the device metadata" className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    When the template is applied, {"${device.field}"} placeholders are filled from the metadata of the device
                    it is applied to (city, country, description, ...). The preview needs some: either sample data you
                    can change freely, or the metadata of a real device. Neither is saved.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div role="radiogroup" aria-label="Device metadata source" className="inline-flex rounded-lg bg-muted p-1 text-sm">
              {([["sample", "Sample metadata"], ["device", "Example device"]] as const).map(([value, text]) => (
                <button key={value} type="button" role="radio" aria-checked={source === value} onClick={() => setSource(value)}
                        className={cn("rounded-md px-3 py-1", source === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {text}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {usingDevice
              ? "The real metadata of a device that is in your scopes and in this namespace's scopes. Only read, the device is not changed."
              : "Example data standing in for a device. Change it freely, for example add the fields your template uses; it is only used for this preview."}{" "}
            {deviceFields.length > 0
              ? <>This template uses: {deviceFields.map((f) => <code key={f} className="mr-1 rounded bg-muted px-1">{f}</code>)}</>
              : <>This template uses no {"${device.*}"} placeholder, so this has no effect on the preview.</>}
          </p>
          {usingDevice ? (
            <>
              <ExampleDevicePicker id="tpl-example-device" namespaceId={namespaceId} selected={exampleDevice} onSelect={(device) => setChosen({ device, namespaceId })} />
              {exampleDevice && (
                <pre aria-label="Metadata of the example device" className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(exampleDevice.device_data, null, 2)}
                </pre>
              )}
            </>
          ) : (
            <>
              <Textarea aria-label="Sample device metadata" rows={5} className="font-mono text-xs" value={deviceText}
                        onChange={(e) => setDeviceText(e.target.value)} />
              {sample.error && <p className="text-xs text-red-700">Invalid JSON: {sample.error}</p>}
            </>
          )}
        </div>
        <div className="space-y-2">
          {preview.isError && <InlineAlert>{getErrorMessage(preview.error)}</InlineAlert>}
          {bodyError && <InlineAlert variant="warning">The template has a syntax error, so it cannot be rendered.</InlineAlert>}
          {preview.data && (
            <FindingsList findings={preview.data.findings.filter((f) => !f.path.startsWith("/values/") || f.level !== "error")} />
          )}
        </div>
      </Box>
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Rendered configuration</DialogTitle>
            <DialogDescription>What would be written to the module with the sample values and device metadata.</DialogDescription>
          </DialogHeader>
          <JsonEditor label="Rendered configuration" value={JSON.stringify(config ?? {}, null, 2)} readOnly allowFullscreen={false}
                      className="h-[60vh]" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function DuplicateDialog({ open, onOpenChange, template, namespaces, version, versionTag, onDuplicated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template;
  namespaces: Namespace[];
  version?: number;
  versionTag?: string;
  onDuplicated: (t: Template) => void;
}) {
  const [name, setName] = useState("");
  const [namespaceId, setNamespaceId] = useState(template.namespace_id);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName(`${template.name} copy`);
      setNamespaceId(template.namespace_id);
    }
  }, [open, template.name, template.namespace_id]);

  const submit = async () => {
    setBusy(true);
    try {
      const created = await moduleConfigApi.duplicate(template.id, { name: name.trim(), version, namespace_id: namespaceId });
      toast.success(`Created ${created.name} from ${template.name} ${versionTag ?? ""}`.trim());
      await invalidateTemplates();
      onOpenChange(false);
      onDuplicated(created);
    } catch (err) {
      toast.error(`Could not duplicate: ${getErrorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate {template.name} {versionTag}</DialogTitle>
          <DialogDescription>Creates a new template (with this version as its first) that records where it came from.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="dup-name">New name</Label>
          <Input id="dup-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dup-namespace">Namespace</Label>
          <Select value={String(namespaceId)} onValueChange={(v) => setNamespaceId(Number(v))}>
            <SelectTrigger id="dup-namespace"><SelectValue /></SelectTrigger>
            <SelectContent>
              {namespaces.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || !name.trim()} onClick={() => void submit()}>Duplicate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
