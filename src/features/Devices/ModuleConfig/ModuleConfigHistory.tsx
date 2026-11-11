import { useState } from "react";
import { toast } from "react-toastify";
import { History, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { withPermissionRequiredTooltip } from "@/features/authorization/permissions/withPermissionRequiredTooltip";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import { useReapplyRevision, useRevision, useRevisions, type Revision } from "@/features/ModuleConfigTemplates/api";
import { formatDate, versionLabel } from "@/features/ModuleConfigTemplates/utils";
import RevisionChange from "./RevisionChange";

const GuardedButton = withPermissionRequiredTooltip(Button);

const SOURCE_LABEL: Record<string, string> = {
  template: "template",
  raw: "raw edit",
  "legacy-api": "legacy API",
  external: "external",
  reapply: "re-applied",
};

function sourceLabel(source: string) {
  return SOURCE_LABEL[source] ?? source.replace(/^extension:/, "extension ");
}

export default function ModuleConfigHistory({ deviceId, moduleName, blocked, onUseValues }: {
  deviceId: string;
  moduleName: string;
  blocked: boolean;
  onUseValues: (revision: Revision) => void;
}) {
  const revisions = useRevisions(deviceId, moduleName);
  const [selected, setSelected] = useState<number | undefined>();
  const [mode, setMode] = useState<"revisions" | "changelog">("revisions");
  const list = revisions.data?.revisions ?? [];
  const current = list.find((r) => r.current);
  const selectedId = selected ?? current?.id ?? list[0]?.id;

  if (revisions.isLoading) return <LoadingState label="Loading history..." />;
  if (revisions.isError) {
    return (
      <InlineAlert action={<Button size="sm" variant="outline" onClick={() => void revisions.refetch()}>Retry</Button>}>
        Could not load the history: {getErrorMessage(revisions.error)}
      </InlineAlert>
    );
  }
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border bg-card py-10 text-sm text-muted-foreground">
        <History className="h-8 w-8 opacity-30" /> No configuration has been written to this module yet.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <Segmented
        label="History view"
        value={mode}
        onChange={setMode}
        options={[{ id: "revisions", label: "Revisions" }, { id: "changelog", label: "Changelog" }]}
      />
      {mode === "changelog" ? (
        <Changelog deviceId={deviceId} moduleName={moduleName} revisions={list} />
      ) : (
    <div className="grid min-h-0 flex-1 content-start gap-4 overflow-auto xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="max-h-[60vh] min-h-48 overflow-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Comment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id} className={cn("cursor-pointer", r.id === selectedId && "bg-muted")} onClick={() => setSelected(r.id)}>
                <TableCell className="font-mono text-xs">
                  {r.id} {r.current && <Badge className="ml-1">current</Badge>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">{formatDate(r.created_at)}</TableCell>
                <TableCell><Badge variant="outline">{sourceLabel(r.source)}</Badge></TableCell>
                <TableCell className="text-xs">{r.template_name ? `${r.template_name} ${versionLabel(r.template_version_tag, r.template_version)}` : "-"}</TableCell>
                <TableCell className="text-xs">{r.actor ?? "-"}</TableCell>
                <TableCell className="max-w-48 truncate text-xs text-muted-foreground">{r.comment ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {selectedId !== undefined && (
        <RevisionDetailView key={selectedId} deviceId={deviceId} moduleName={moduleName} id={selectedId} blocked={blocked}
                            onUseValues={onUseValues} />
      )}
    </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div role="tablist" aria-label={label} className="flex w-fit gap-1 rounded-md bg-muted p-0.5 text-xs">
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
                className={cn("rounded px-2.5 py-1", value === o.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Who changed what and when, step by step: every revision as a diff against the one before it. */
function Changelog({ deviceId, moduleName, revisions }: { deviceId: string; moduleName: string; revisions: Revision[] }) {
  const [shown, setShown] = useState(10);
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto">
      {revisions.slice(0, shown).map((r) => (
        <article key={r.id} className="space-y-2 rounded-lg border bg-card p-3" aria-label={`Revision ${r.id}`}>
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">Revision {r.id}</span>
            {r.current && <Badge>current</Badge>}
            <Badge variant="outline">{sourceLabel(r.source)}</Badge>
            <span>{r.actor ?? "unknown user"}</span>
            <span className="text-muted-foreground">{formatDate(r.created_at)}</span>
            {r.template_name && <span className="text-xs text-muted-foreground">{r.template_name} {versionLabel(r.template_version_tag, r.template_version)}</span>}
          </header>
          {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
          <RevisionChange deviceId={deviceId} moduleName={moduleName} revisionId={r.id} parentId={r.parent_revision_id} />
        </article>
      ))}
      {shown < revisions.length && (
        <Button variant="outline" size="sm" onClick={() => setShown(shown + 10)}>
          Show older ({revisions.length - shown} more)
        </Button>
      )}
    </div>
  );
}

function RevisionDetailView({ deviceId, moduleName, id, blocked, onUseValues }: {
  deviceId: string;
  moduleName: string;
  id: number;
  blocked: boolean;
  onUseValues: (revision: Revision) => void;
}) {
  const detail = useRevision(deviceId, moduleName, id);
  const [view, setView] = useState<"content" | "changes">("content");
  const reapply = useReapplyRevision(deviceId, moduleName);
  const revision = detail.data;

  if (detail.isLoading) return <LoadingState label="Loading revision..." />;
  if (detail.isError || !revision) return <InlineAlert>{getErrorMessage(detail.error)}</InlineAlert>;

  const fromTemplate = revision.template_id != null;
  const onReapply = () =>
    reapply.mutate({ id }, {
      onSuccess: () => toast.success(`Re-applied revision ${id}`),
      onError: (err) => toast.error(`Could not re-apply: ${getErrorMessage(err)}`),
    });

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="mr-auto font-medium">Revision {revision.id}</h4>
        {fromTemplate && revision.template_version != null && (
          <Button variant="outline" size="sm" onClick={() => onUseValues(revision)}>Edit values</Button>
        )}
        {!blocked && (
          <GuardedButton
            size="sm"
            deviceId={deviceId}
            permissionKey={fromTemplate ? PERMISSION_KEYS.DEVICE_MODULE_CONFIG_APPLY : PERMISSION_KEYS.DEVICE_MODULE_TWIN_CONFIG_WRITE}
            disabled={reapply.isPending || !revision.content_available || !!revision.current}
            onClick={onReapply}
          >
            <RotateCcw className="mr-1 h-4 w-4" /> Re-apply
          </GuardedButton>
        )}
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Config ID</dt><dd className="font-mono">{revision.config_id}</dd>
        {revision.parent_revision_id && (<><dt className="text-muted-foreground">Previous</dt><dd>#{revision.parent_revision_id}</dd></>)}
        {revision.reapplied_from_id && (<><dt className="text-muted-foreground">Re-applied from</dt><dd>#{revision.reapplied_from_id}</dd></>)}
        {revision.content_hash && (<><dt className="text-muted-foreground">Hash</dt><dd className="truncate font-mono">{revision.content_hash}</dd></>)}
        {revision.values && Object.keys(revision.values).length > 0 && (
          <><dt className="text-muted-foreground">Values</dt><dd className="font-mono">{JSON.stringify(revision.values)}</dd></>
        )}
      </dl>
      <Segmented
        label="Revision view"
        value={view}
        onChange={setView}
        options={[{ id: "content", label: "Configuration" }, { id: "changes", label: "Changes to previous" }]}
      />
      {view === "changes" ? (
        <RevisionChange deviceId={deviceId} moduleName={moduleName} revisionId={id} parentId={revision.parent_revision_id} />
      ) : (
        <>
      {revision.blob_name === "current" && (
        <InlineAlert variant="warning">
          Written by an older client into the shared legacy blob: the content shown is the latest one stored there and cannot be re-applied.
        </InlineAlert>
      )}
      {revision.content === undefined || revision.content === null ? (
        <InlineAlert variant="warning">The content of this revision is no longer available.</InlineAlert>
      ) : (
        <pre className="max-h-[45vh] overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(revision.content, null, 2)}</pre>
      )}
        </>
      )}
    </div>
  );
}
