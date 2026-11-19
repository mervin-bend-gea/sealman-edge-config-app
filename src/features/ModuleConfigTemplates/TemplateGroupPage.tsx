import { useParams, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage, isForbidden } from "@/lib/errors";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import { useTemplateGroups, useTemplates, type TemplateGroup, type TemplateKind } from "./api";
import { GroupBadges } from "./badges";
import TemplateGroupDetails from "./TemplateGroupDetails";
import { TEMPLATES_PATH, formatDate, groupEditPath, templatePath } from "./utils";

function BackLink({ to = TEMPLATES_PATH, label = "All template groups" }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {label}
    </Link>
  );
}

/** Compact summary of a template group, with the way to its edit page. */
function TemplateGroupSummary({ group, canWrite }: { group: TemplateGroup; canWrite: boolean }) {
  const navigate = useNavigate();
  return (
    <section aria-label="Template Group details" className="w-full space-y-3 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-auto min-w-0 space-y-1">
          <h1 className="text-xl font-semibold">{group.name}</h1>
          {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(groupEditPath(group.id))}>
          <Pencil className="mr-1 h-4 w-4" /> {canWrite ? "Edit template group" : "Show details"}
        </Button>
      </div>
      <GroupBadges modules={group.module_names} scopes={group.scopes} />
    </section>
  );
}

/**
 * A template group. `view` (default) is the compact working view: a summary and the templates it holds. `edit` is the
 * roomy form for name, description, modules and scopes, without the templates. Without an id it creates a template group.
 */
export default function TemplateGroupPage({ mode = "view" }: { mode?: "view" | "edit" }) {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const groups = useTemplateGroups();
  const { hasPermission: canWrite } = usePermissions({ permissionKey: PERMISSION_KEYS.MODULE_CONFIG_TEMPLATE_WRITE });

  if (groupId === undefined) {
    return (
      <>
        <BackLink />
        <TemplateGroupDetails canWrite={canWrite} onSaved={(saved) => navigate(`${TEMPLATES_PATH}/${saved.id}`, { replace: true })} />
      </>
    );
  }

  const group = groups.data?.find((n) => n.id === Number(groupId));
  const editing = mode === "edit";
  return (
    <>
      {editing && group
        ? <BackLink to={`${TEMPLATES_PATH}/${group.id}`} label={`Back to ${group.name}`} />
        : <BackLink />}
      {groups.isLoading && <LoadingState label="Loading template group..." />}
      {groups.isError && (
        <InlineAlert>{isForbidden(groups.error) ? "You may not browse module templates." : getErrorMessage(groups.error)}</InlineAlert>
      )}
      {groups.data && !group && <InlineAlert variant="info">This template group does not exist (any more).</InlineAlert>}
      {group && editing && (
        <TemplateGroupDetails
          key={`${group.id}-${group.updated_at}`}
          group={group}
          canWrite={canWrite}
          onSaved={(saved) => navigate(`${TEMPLATES_PATH}/${saved.id}`)}
          onDeleted={() => navigate(TEMPLATES_PATH, { replace: true })}
        />
      )}
      {group && !editing && (
        <>
          <TemplateGroupSummary group={group} canWrite={canWrite} />
          <TemplateGroupTemplates group={group} canWrite={canWrite} kind="template" />
          <TemplateGroupTemplates group={group} canWrite={canWrite} kind="block" />
        </>
      )}
    </>
  );
}

const SECTION = {
  template: { title: "Templates", noun: "template", hint: undefined },
  block: { title: "Blocks", noun: "block", hint: "Reusable parts that templates and blocks of this template group reference as { \"$ref\": \"<block name>\" }." },
} as const;

/** The templates or the blocks of a template group. */
function TemplateGroupTemplates({ group, canWrite, kind }: { group: TemplateGroup; canWrite: boolean; kind: TemplateKind }) {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const templates = useTemplates(undefined, showArchived);
  const items = templates.data?.filter((t) => t.group_id === group.id && (t.kind ?? "template") === kind) ?? [];
  const { title, noun, hint } = SECTION[kind];

  return (
    <section aria-label={title} className="w-full space-y-4 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-lg font-semibold">{title}</h2>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
        <Button disabled={!canWrite}
                onClick={() => navigate(`${templatePath(group.id, "new")}${kind === "block" ? "?kind=block" : ""}`)}>
          <Plus className="mr-1 h-4 w-4" /> New {noun}
        </Button>
      </div>
      {templates.isLoading && <LoadingState label={`Loading ${title.toLowerCase()}...`} />}
      {templates.isError && (
        <InlineAlert action={<Button size="sm" variant="outline" onClick={() => void templates.refetch()}>Retry</Button>}>
          {isForbidden(templates.error) ? `Not permitted to browse ${title.toLowerCase()}` : getErrorMessage(templates.error)}
        </InlineAlert>
      )}
      {templates.data && items.length === 0 && <p className="text-sm italic text-muted-foreground">No {title.toLowerCase()}</p>}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                to={templatePath(group.id, t.id)}
                className="flex w-full items-center gap-3 rounded-md border px-4 py-3 text-sm transition-colors hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  {t.description && <span className="block truncate text-xs text-muted-foreground">{t.description}</span>}
                </span>
                {t.archived && <Badge variant="secondary">archived</Badge>}
                <span className="text-xs text-muted-foreground">updated {formatDate(t.updated_at)}</span>
                <span className="text-xs text-muted-foreground">{t.latest_version != null ? `#${t.latest_version}` : ""}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
