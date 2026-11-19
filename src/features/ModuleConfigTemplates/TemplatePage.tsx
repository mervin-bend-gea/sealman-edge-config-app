import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Archive, ArchiveRestore, ArrowLeft, Copy, FileJson, GitCompare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import JsonEditor from "@/components/Input/JsonEditor";
import { getErrorMessage, isForbidden } from "@/lib/errors";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import {
  findingsOf, invalidateTemplates, moduleConfigApi, useBlocks, useTemplateGroups, useTemplates, useTemplateVersion, useTemplateVersions,
  type ExampleDevice, type Finding, type InputEndpoint, type InputList, type InputVariable, type TemplateGroup, type Template, type TemplateKind,
  type TemplateVersionSummary, type VariableDecl, type LintResult,
} from "./api";
import { GroupBadges } from "./badges";
import InsertMenu from "./InsertMenu";
import TemplateHelp from "./TemplateHelp";
import Box from "./Box";
import { FindingsList, VariablesEditor } from "./components";
import DiffView from "./DiffView";
import ExampleDevicePicker from "./ExampleDevicePicker";
import { TemplateInputs, useTemplateInputs } from "@/features/Devices/ModuleConfig/TemplateInputs";
import SearchableSelect from "@/components/Input/SearchableSelect";
import {
  TEMPLATES_PATH, EDITOR_HEIGHT, canonical, cleanVariables, endpointReferences, formatDate, insertList, insertPlaceholder, insertRef,
  placeholderAnnotations, placeholderHelp, placeholderMarkers, refMarkers, syncVariables, templatePath, useDebounced, variableProblems,
} from "./utils";

const EXAMPLE_BODY = `{
  "interval": "\${interval}",
  "site": "\${device.city}"
}`;

const PREVIEW_COLLAPSED_KEY = "moduleTemplatePreviewCollapsed";

interface Draft {
  name: string;
  description: string;
  groupId: number | null;
  body: string;
  variables: VariableDecl[];
  comment: string;
}

const emptyDraft = (groupId: number | null): Draft => ({
  name: "", description: "", groupId, body: EXAMPLE_BODY, comment: "",
  variables: [{ name: "interval", type: "integer", required: true }],
});

function parseBody(text: string): { body?: unknown; error?: string } {
  try {
    return { body: JSON.parse(text) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}


/** How people see a copy key (`separatorA/items` -> `separatorA · items`). */
const copyLabel = (key: string) => key.replaceAll("/", " · ");

/** Subpage of a template group: one template or block (or a new one, `?kind=block` for a block) with its versions,
 * preview and duplicate. */
export default function TemplatePage() {
  const { groupId, templateId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const groups = useTemplateGroups();
  const templates = useTemplates(undefined, true);
  const { hasPermission: canWrite } = usePermissions({ permissionKey: PERMISSION_KEYS.MODULE_CONFIG_TEMPLATE_WRITE });

  const template = templateId === undefined ? undefined : templates.data?.find((t) => t.id === Number(templateId));
  const home = groups.data?.find((n) => n.id === (template?.group_id ?? Number(groupId)));
  const error = groups.error ?? templates.error;
  const loading = groups.isLoading || templates.isLoading;
  const kind: TemplateKind = template?.kind ?? (search.get("kind") === "block" ? "block" : "template");

  return (
    <>
      <Link
        to={home ? `${TEMPLATES_PATH}/${home.id}` : TEMPLATES_PATH}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {home ? `Back to ${home.name}` : "All template groups"}
      </Link>
      {loading && <LoadingState label="Loading template..." />}
      {error && <InlineAlert>{isForbidden(error) ? "You may not browse module templates." : getErrorMessage(error)}</InlineAlert>}
      {!loading && !error && !home && <InlineAlert variant="info">This template group does not exist (any more).</InlineAlert>}
      {!loading && !error && home && templateId !== undefined && !template && (
        <InlineAlert variant="info">This template does not exist (any more).</InlineAlert>
      )}
      {home && groups.data && (templateId === undefined || template) && (
        <TemplateForm
          key={template?.id ?? "new"}
          template={template}
          kind={kind}
          groups={groups.data}
          initialGroupId={home.id}
          canWrite={canWrite}
          onOpen={(t) => navigate(templatePath(t.group_id, t.id), { replace: true })}
        />
      )}
    </>
  );
}

function TemplateForm({ template, kind, groups, initialGroupId, canWrite, onOpen }: {
  template?: Template;
  kind: TemplateKind;
  groups: TemplateGroup[];
  initialGroupId: number;
  canWrite: boolean;
  onOpen: (t: Template) => void;
}) {
  const [version, setVersion] = useState<number | "latest">("latest");
  const versions = useTemplateVersions(template?.id);
  const loaded = useTemplateVersion(template?.id, version);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(initialGroupId));
  const [saving, setSaving] = useState(false);
  const [serverFindings, setServerFindings] = useState<Finding[]>([]);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [cursor, setCursor] = useState({ row: 0, column: 0 });
  const readOnly = !canWrite || !!template?.archived;
  const noun = kind === "block" ? "block" : "template";
  const Noun = kind === "block" ? "Block" : "Template";

  // the declarations follow the body: `${name}` declares a variable, removing its last use drops it (see syncVariables);
  // only edits count, so opening a template or a history entry changes nothing
  const syncedBody = useRef<string | null>(null);
  const stash = useRef(new Map<string, VariableDecl>());
  const typedBody = useDebounced(draft.body, 600);
  useEffect(() => {
    if (readOnly || syncedBody.current === null || typedBody === syncedBody.current) {
      syncedBody.current = typedBody;
      return;
    }
    syncedBody.current = typedBody;
    setDraft((d) => {
      const variables = syncVariables(typedBody, d.variables, stash.current);
      return variables === d.variables ? d : { ...d, variables };
    });
  }, [typedBody, readOnly]);

  useEffect(() => {
    if (!template || !loaded.data) return;
    syncedBody.current = JSON.stringify(loaded.data.body, null, 2);
    setDraft({
      name: template.name,
      description: template.description ?? "",
      groupId: template.group_id,
      body: JSON.stringify(loaded.data.body, null, 2),
      variables: loaded.data.variables,
      comment: "",
    });
    setServerFindings([]);
  }, [template, loaded.data]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const parsed = useMemo(() => parseBody(draft.body), [draft.body]);
  const viewed = loaded.data;
  const group = groups.find((n) => n.id === draft.groupId);
  const placeholders = useMemo(
    () => placeholderMarkers(draft.body, draft.variables.map((v) => v.name.trim()).filter(Boolean)),
    [draft.body, draft.variables],
  );
  const markers = useMemo(() => [...placeholders, ...refMarkers(draft.body)], [placeholders, draft.body]);
  const annotations = useMemo(() => placeholderAnnotations(placeholders), [placeholders]);
  const blocks = useBlocks(draft.groupId);
  // a block cannot reference itself
  const insertable = useMemo(() => (blocks.data ?? []).filter((b) => b.id !== template?.id), [blocks.data, template?.id]);

  // the server's view of the body: its block copies and the inputs of every copy
  const lintRequest = useDebounced({
    body: parsed.body, variables: cleanVariables(draft.variables), kind, group_id: draft.groupId ?? undefined,
  });
  const lint = useQuery({
    queryKey: ["moduleConfigTemplateLint", lintRequest],
    queryFn: () => moduleConfigApi.lint(lintRequest),
    enabled: !parsed.error && lintRequest.body !== undefined,
    placeholderData: (previous) => previous,
  });
  const inputs = lint.data?.inputs;
  // without the server (yet), the slots of the body itself
  const endpointSlots = useMemo<InputEndpoint[]>(
    () => inputs?.endpoints ?? endpointReferences(parsed.body).map((e) => ({ ...e, key: e.slot, copy: null })),
    [inputs, parsed.body],
  );
  const lists = inputs?.lists ?? [];
  const blockVariables = useMemo(() => (inputs?.variables ?? []).filter((v) => v.copy), [inputs]);

  const variableIssues = useMemo(() => variableProblems(draft.variables), [draft.variables]);

  const contentChanged = !template || !viewed
    || viewed.version !== template.latest_version
    || (!parsed.error && canonical(parsed.body) !== canonical(viewed.body))
    || canonical(cleanVariables(draft.variables)) !== canonical(cleanVariables(viewed.variables));
  const metaChanged = !!template && (
    draft.name.trim() !== template.name
    || draft.description !== (template.description ?? "")
    || draft.groupId !== template.group_id
  );

  const blocker = (() => {
    if (parsed.error) return "The JSON has a syntax error.";
    if (!draft.name.trim()) return `The ${noun} needs a name.`;
    if (draft.groupId == null) return "Select a template group.";
    if (variableIssues.length) return "Fix the variable declarations.";
    if (template && !contentChanged && !metaChanged) return "No changes to save.";
    return undefined;
  })();
  const saveLabel = !template ? `Create ${noun}` : contentChanged ? "Save new version" : "Save details";

  const save = async () => {
    if (blocker) return;
    setSaving(true);
    setServerFindings([]);
    const content = {
      body: parsed.body, variables: cleanVariables(draft.variables), comment: draft.comment.trim() || undefined,
    };
    try {
      if (!template) {
        const created = await moduleConfigApi.createTemplate({
          ...content, name: draft.name.trim(), description: draft.description || undefined, group_id: draft.groupId!, kind,
        });
        toast.success(`${Noun} ${created.name} created`);
        await invalidateTemplates();
        onOpen(created);
        return;
      }
      const meta = { name: draft.name.trim(), description: draft.description, group_id: draft.groupId ?? template.group_id };
      if (metaChanged) await moduleConfigApi.updateTemplate(template.id, meta);
      if (contentChanged) {
        const saved = await moduleConfigApi.addVersion(template.id, content);
        toast.success(`Saved ${meta.name} as #${saved.version}`);
        setVersion("latest");
        set({ comment: "" });
      } else {
        toast.success(`Saved the details of ${meta.name}`);
      }
      await invalidateTemplates();
    } catch (err) {
      const findings = findingsOf(err);
      if (findings) setServerFindings(findings);
      toast.error(`Could not save the ${noun}: ${getErrorMessage(err)}`);
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

  if (template && loaded.isLoading) return <LoadingState label={`Loading ${noun}...`} />;
  if (template && loaded.isError) return <InlineAlert>{getErrorMessage(loaded.error)}</InlineAlert>;

  const detailActions = template && (
    <>
      <Select value={String(version)} onValueChange={(v) => setVersion(v === "latest" ? "latest" : Number(v))}>
        <SelectTrigger className="w-72" aria-label="Version"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="latest">Latest (#{template.latest_version})</SelectItem>
          {versions.data?.map((v) => (
            <SelectItem key={v.version} value={String(v.version)}>
              #{v.version} · {formatDate(v.created_at)}{v.comment ? ` · ${v.comment}` : ""}
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
      <Box label={`${Noun} details`} title={template ? template.name : `New ${noun}`} actions={detailActions}>
        {template?.derived_from_template_id && (
          <p className="text-xs text-muted-foreground">
            Duplicated from template #{template.derived_from_template_id} (version {template.derived_from_version})
          </p>
        )}
        {template?.archived && (
          <InlineAlert variant="info">Archived: restore the {noun} to {kind === "block" ? "edit or insert" : "edit or apply"} it.</InlineAlert>
        )}
        {template && viewed && viewed.version !== template.latest_version && !readOnly && (
          <InlineAlert variant="info">
            Viewing #{viewed.version}, not the latest version. Saving creates a new version with this content.
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
            <Input id="tpl-description" disabled={readOnly} placeholder={`What this ${noun} configures and when to use it`}
                   value={draft.description} onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-group">Template Group</Label>
            <SearchableSelect id="tpl-group" disabled={readOnly} value={draft.groupId == null ? null : String(draft.groupId)}
                              options={groups.map((n) => ({ value: String(n.id), label: n.name, hint: n.module_names.join(", ") }))}
                              placeholder="Select a template group" searchPlaceholder="Search template groups" emptyText="No template group found."
                              onChange={(groupId) => set({ groupId: Number(groupId) })} />
          </div>
          <div className="space-y-1" aria-label="Template Group modules and scopes">
            <Label>Applies to</Label>
            <div className="flex min-h-10 items-center">
              {group
                ? <GroupBadges modules={group.module_names} scopes={group.scopes} />
                : <span className="text-sm text-muted-foreground">Select a template group</span>}
            </div>
          </div>
        </div>
      </Box>

      <Box
        label={kind === "block" ? "Configuration block" : "Configuration template"}
        title={kind === "block" ? "Configuration block" : "Configuration template"}
        description={kind === "block"
          ? "A reusable part of a configuration (an object or an array) that templates of this group insert."
          : "The JSON written to the module. Anything in ${…} is filled in when the template is applied."}
      >
        <TemplateHelp kind={kind} />
        <JsonEditor label="Configuration template" value={draft.body} readOnly={readOnly} onChange={(body) => set({ body })}
                    markers={markers} annotations={annotations} className={EDITOR_HEIGHT} onCursorChange={setCursor}
                    hoverHelp={(at) => placeholderHelp(draft.body, at, draft.variables)}
                    toolbar={!readOnly && (
                      <InsertMenu variables={draft.variables} blocks={insertable} allowLists={kind === "template"}
                                  onPlaceholder={(reference) => set({ body: insertPlaceholder(draft.body, cursor, reference) })}
                                  onBlock={(name) => set({ body: insertRef(draft.body, cursor, name) })}
                                  onList={(names, label) => set({ body: insertList(draft.body, cursor, names, label) })} />
                    )} />
      </Box>

      <Box label="Template variables" title="Variables"
           description={`The values asked for when the ${kind === "block" ? "template using this block" : "template"} is applied. Writing \${name} in the ${noun} adds a variable here, removing its last use removes it; set its type and label below.`}>
        <VariablesEditor variables={draft.variables} disabled={readOnly} onChange={(variables) => set({ variables })} />
        {blockVariables.length > 0 && <BlockVariables variables={blockVariables} />}
        {lists.length > 0 && <ListInputs lists={lists} what="variables" />}
      </Box>

      <Box label="Template endpoint slots" title="Endpoint slots"
           description="The endpoint (and service) dropdowns shown when applying, one per endpoint name used in the template. Nothing to declare: write ${endpoint.ip} or ${service.port}.">
        {endpointSlots.length === 0 && !lists.some((l) => l.blocks.some((b) => b.inputs.endpoints.length > 0)) ? (
          <p className="text-sm text-muted-foreground">This {noun} uses no endpoint fields.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground"><th className="py-1 pr-4 font-medium">Slot</th><th className="py-1 font-medium">Fields read from the chosen endpoint</th></tr>
            </thead>
            <tbody>
              {endpointSlots.map(({ key, fields, service_fields = [] }) => (
                <tr key={key} className="border-t">
                  <td className="py-1.5 pr-4 font-medium">{copyLabel(key)}</td>
                  <td className="py-1.5">{fields.map((f) => <code key={f} className="mr-1 rounded bg-purple-100 px-1 text-purple-900">{f}</code>)}
                    {service_fields.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        service: {service_fields.map((f) => <code key={f} className="mr-1 rounded bg-purple-100 px-1 text-purple-900">{f}</code>)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {lists.length > 0 && <ListInputs lists={lists} what="endpoints" />}
      </Box>

      <Preview body={parsed.body} bodyError={parsed.error} variables={draft.variables} groupId={draft.groupId} kind={kind}
               lint={lint.data} />

      {serverFindings.length > 0 && (
        <Box label={`${Noun} findings`} title="Findings"><FindingsList findings={serverFindings} /></Box>
      )}

      {!readOnly && (
        <Box label={`Save ${noun}`}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1 space-y-1">
              <Label htmlFor="tpl-comment">Change comment</Label>
              <Input id="tpl-comment" value={draft.comment} onChange={(e) => set({ comment: e.target.value })}
                     placeholder="What changed and why" disabled={!!template && !contentChanged} />
            </div>
            <Button disabled={saving || !!blocker} onClick={() => void save()}>{saveLabel}</Button>
          </div>
          {blocker && <p className="text-xs text-muted-foreground">{blocker}</p>}
        </Box>
      )}

      {template && (
        <>
          <DuplicateDialog open={duplicateOpen} onOpenChange={setDuplicateOpen} template={template} groups={groups} noun={noun}
                           version={viewed?.version} onDuplicated={onOpen} />
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
      <span className="font-medium">{label} #{version.version}</span>
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
        {versions.map((v) => <SelectItem key={v.version} value={String(v.version)}>#{v.version}</SelectItem>)}
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
              beforeLabel={`#${before.data.version}`}
              afterLabel={`#${after.data.version}`}
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
function Preview({ body, bodyError, variables, groupId, kind, lint }: {
  body: unknown;
  bodyError?: string;
  variables: VariableDecl[];
  groupId: number | null;
  kind: TemplateKind;
  /** the server's view of the body (its inputs), once known */
  lint?: LintResult;
}) {
  const [chosen, setChosen] = useState<{ device: ExampleDevice; groupId: number | null } | null>(null);
  // the device must be in the template group's scopes, so a device chosen for another template group no longer counts
  const device = chosen && chosen.groupId === groupId ? chosen.device : null;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(PREVIEW_COLLAPSED_KEY) !== "0");
  const toggle = () => setCollapsed((c) => {
    localStorage.setItem(PREVIEW_COLLAPSED_KEY, c ? "0" : "1");
    return !c;
  });
  // choices belong to one device: a new device starts an empty form
  return (
    <PreviewBox key={device?.device_id ?? "none"} body={body} bodyError={bodyError} variables={variables} groupId={groupId} kind={kind}
                lint={lint} device={device} onDevice={(d) => setChosen({ device: d, groupId })} collapsed={collapsed} onToggle={toggle} />
  );
}

function PreviewBox({ body, bodyError, variables, groupId, kind, lint, device, onDevice, collapsed, onToggle }: {
  body: unknown;
  bodyError?: string;
  variables: VariableDecl[];
  groupId: number | null;
  kind: TemplateKind;
  lint?: LintResult;
  device: ExampleDevice | null;
  onDevice: (device: ExampleDevice) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [showConfig, setShowConfig] = useState(false);
  const declared = useMemo(() => cleanVariables(variables), [variables]);
  const source = lint?.references && { variables: declared, references: lint.references, inputs: lint.inputs };
  const form = useTemplateInputs(device?.device_id, source, groupId);
  const request = useDebounced({
    body, variables: declared, kind, ...form.sent, endpoints: form.sent.endpoints ?? {},
    ...(groupId !== null ? { group_id: groupId } : {}),
    ...(device ? { device_id: device.device_id } : {}),
  });
  const preview = useQuery({
    queryKey: ["moduleConfigTemplatePreview", request],
    queryFn: () => moduleConfigApi.preview(request),
    enabled: !bodyError && !!device && groupId !== null,
    placeholderData: (previous) => previous,
  });
  const config = preview.data?.config;
  const findings = preview.data?.findings ?? [];

  return (
    <>
      <Box label="Preview" title="Preview"
           description={`What applying this ${kind === "block" ? "block" : "template"} to a device would write, with your unsaved changes. Nothing is applied or saved.`}
           collapse={{ collapsed, onToggle }}
           actions={(
             <>
               {preview.data && device && (
                 <Badge variant={preview.data.ok ? "secondary" : "destructive"}>{preview.data.ok ? "valid" : "has errors"}</Badge>
               )}
               <Button variant="outline" size="sm" disabled={!config || !!bodyError || !device} onClick={() => setShowConfig(true)}>
                 <FileJson className="mr-1 h-4 w-4" /> Show rendered configuration
               </Button>
             </>
           )}>
        <div className="max-w-xl space-y-1">
          <Label htmlFor="tpl-example-device">Example device</Label>
          <ExampleDevicePicker id="tpl-example-device" groupId={groupId} selected={device} onSelect={onDevice} />
          <p className="text-xs text-muted-foreground">
            {groupId === null
              ? "Choose a template group first: the device must be in its scopes."
              : "A device in your scopes and the template group's. Its metadata, endpoints and services are used; the device is not changed."}
          </p>
        </div>
        {device && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">Inputs</h3>
            {source ? <TemplateInputs form={form} findings={findings} blocked={false} /> : <LoadingState label="Reading the template..." />}
          </div>
        )}
        <div className="space-y-2">
          {preview.isError && <InlineAlert>{getErrorMessage(preview.error)}</InlineAlert>}
          {bodyError && <InlineAlert variant="warning">The {kind === "block" ? "block" : "template"} has a syntax error, so it cannot be rendered.</InlineAlert>}
          {preview.data && device && <FindingsList findings={findings.filter((f) => !f.path.startsWith("/values/"))} />}
        </div>
      </Box>
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Rendered configuration</DialogTitle>
            <DialogDescription>What would be written to the module on {device?.device_id} with these inputs.</DialogDescription>
          </DialogHeader>
          <JsonEditor label="Rendered configuration" value={JSON.stringify(config ?? {}, null, 2)} readOnly allowFullscreen={false}
                      className="h-[60vh]" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function DuplicateDialog({ open, onOpenChange, template, groups, noun, version, onDuplicated }: {
  open: boolean;
  noun: string;
  onOpenChange: (open: boolean) => void;
  template: Template;
  groups: TemplateGroup[];
  version?: number;
  onDuplicated: (t: Template) => void;
}) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(template.group_id);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName(`${template.name} copy`);
      setGroupId(template.group_id);
    }
  }, [open, template.name, template.group_id]);

  const submit = async () => {
    setBusy(true);
    try {
      const created = await moduleConfigApi.duplicate(template.id, { name: name.trim(), version, group_id: groupId });
      toast.success(`Created ${created.name} from ${template.name}`);
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
          <DialogTitle>Duplicate {template.name}</DialogTitle>
          <DialogDescription>Creates a new {noun} (with this version as its first) that records where it came from.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="dup-name">New name</Label>
          <Input id="dup-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dup-group">Template Group</Label>
          <Select value={String(groupId)} onValueChange={(v) => setGroupId(Number(v))}>
            <SelectTrigger id="dup-group"><SelectValue /></SelectTrigger>
            <SelectContent>
              {groups.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>)}
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

/** The lists of blocks the body offers: each once, with the inputs of every block allowed in it. */
function ListInputs({ lists, what }: { lists: InputList[]; what: "variables" | "endpoints" }) {
  const rows = lists.map((l) => ({
    list: l,
    blocks: l.blocks
      .map((b) => ({ b, items: what === "variables"
        ? b.inputs.variables.map((v) => `${copyLabel(v.key)} (${v.type}${v.required === false ? "" : ", required"})`)
        : b.inputs.endpoints.map((e) => `${copyLabel(e.key)}: ${e.fields.join(", ")}${e.service_fields?.length ? `; service: ${e.service_fields.join(", ")}` : ""}`) }))
      .filter(({ items }) => items.length > 0),
  }));
  return (
    <div className="space-y-2">
      {rows.map(({ list, blocks }) => (
        <div key={list.key} className="text-sm">
          <p className="font-medium">
            {list.label}{list.item_label ? ` (${list.item_label})` : ""}: <span className="font-normal">entries, each one of {list.blocks.map((b) => b.name ?? `#${b.block_id}`).join(", ")}</span>
          </p>
          {blocks.length > 0 && (
            <ul className="ml-4 list-disc text-xs text-muted-foreground">
              {blocks.map(({ b, items }) => (
                <li key={b.block_id}>{b.name ?? `#${b.block_id}`}: {items.join("; ")}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/** The inputs the block copies add, asked for per copy when the template is applied. */
function BlockVariables({ variables }: { variables: InputVariable[] }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">From blocks</p>
      <p className="text-xs text-muted-foreground">Declared in the blocks used here; asked for once per copy. Change them in the block.</p>
      <table aria-label="Variables from blocks" className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-4 font-medium">Input</th><th className="py-1 pr-4 font-medium">Type</th><th className="py-1 font-medium">Required</th>
          </tr>
        </thead>
        <tbody>
          {variables.map((v) => (
            <tr key={v.key} className="border-t">
              <td className="py-1.5 pr-4 font-medium">{copyLabel(v.key)}</td>
              <td className="py-1.5 pr-4">{v.type}</td>
              <td className="py-1.5">{v.required === false ? "no" : "yes"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
