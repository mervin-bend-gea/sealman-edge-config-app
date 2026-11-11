import { useParams, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage, isForbidden } from "@/lib/errors";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import { useNamespaces, useTemplates, type Namespace } from "./api";
import { NamespaceBadges } from "./badges";
import NamespaceDetails from "./NamespaceDetails";
import { TEMPLATES_PATH, formatDate, namespaceEditPath, templatePath, versionLabel } from "./utils";

function BackLink({ to = TEMPLATES_PATH, label = "All namespaces" }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {label}
    </Link>
  );
}

/** Compact summary of a namespace, with the way to its edit page. */
function NamespaceSummary({ namespace, canWrite }: { namespace: Namespace; canWrite: boolean }) {
  const navigate = useNavigate();
  return (
    <section aria-label="Namespace details" className="w-full space-y-3 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-auto min-w-0 space-y-1">
          <h1 className="text-xl font-semibold">{namespace.name}</h1>
          {namespace.description && <p className="text-sm text-muted-foreground">{namespace.description}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(namespaceEditPath(namespace.id))}>
          <Pencil className="mr-1 h-4 w-4" /> {canWrite ? "Edit namespace" : "Show details"}
        </Button>
      </div>
      <NamespaceBadges modules={namespace.module_names} scopes={namespace.scopes} />
    </section>
  );
}

/**
 * A namespace. `view` (default) is the compact working view: a summary and the templates it holds. `edit` is the
 * roomy form for name, description, modules and scopes, without the templates. Without an id it creates a namespace.
 */
export default function NamespacePage({ mode = "view" }: { mode?: "view" | "edit" }) {
  const { namespaceId } = useParams();
  const navigate = useNavigate();
  const namespaces = useNamespaces();
  const { hasPermission: canWrite } = usePermissions({ permissionKey: PERMISSION_KEYS.MODULE_CONFIG_TEMPLATE_WRITE });

  if (namespaceId === undefined) {
    return (
      <>
        <BackLink />
        <NamespaceDetails canWrite={canWrite} onSaved={(saved) => navigate(`${TEMPLATES_PATH}/${saved.id}`, { replace: true })} />
      </>
    );
  }

  const namespace = namespaces.data?.find((n) => n.id === Number(namespaceId));
  const editing = mode === "edit";
  return (
    <>
      {editing && namespace
        ? <BackLink to={`${TEMPLATES_PATH}/${namespace.id}`} label={`Back to ${namespace.name}`} />
        : <BackLink />}
      {namespaces.isLoading && <LoadingState label="Loading namespace..." />}
      {namespaces.isError && (
        <InlineAlert>{isForbidden(namespaces.error) ? "You may not browse module templates." : getErrorMessage(namespaces.error)}</InlineAlert>
      )}
      {namespaces.data && !namespace && <InlineAlert variant="info">This namespace does not exist (any more).</InlineAlert>}
      {namespace && editing && (
        <NamespaceDetails
          key={`${namespace.id}-${namespace.updated_at}`}
          namespace={namespace}
          canWrite={canWrite}
          onSaved={(saved) => navigate(`${TEMPLATES_PATH}/${saved.id}`)}
          onDeleted={() => navigate(TEMPLATES_PATH, { replace: true })}
        />
      )}
      {namespace && !editing && (
        <>
          <NamespaceSummary namespace={namespace} canWrite={canWrite} />
          <NamespaceTemplates namespace={namespace} canWrite={canWrite} />
        </>
      )}
    </>
  );
}

function NamespaceTemplates({ namespace, canWrite }: { namespace: Namespace; canWrite: boolean }) {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const templates = useTemplates(undefined, showArchived);
  const items = templates.data?.filter((t) => t.namespace_id === namespace.id) ?? [];

  return (
    <section aria-label="Templates" className="w-full space-y-4 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-semibold">Templates</h2>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
        <Button disabled={!canWrite} onClick={() => navigate(templatePath(namespace.id, "new"))}>
          <Plus className="mr-1 h-4 w-4" /> New template
        </Button>
      </div>
      {templates.isLoading && <LoadingState label="Loading templates..." />}
      {templates.isError && (
        <InlineAlert action={<Button size="sm" variant="outline" onClick={() => void templates.refetch()}>Retry</Button>}>
          {isForbidden(templates.error) ? "Not permitted to browse templates" : getErrorMessage(templates.error)}
        </InlineAlert>
      )}
      {templates.data && items.length === 0 && <p className="text-sm italic text-muted-foreground">No templates</p>}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                to={templatePath(namespace.id, t.id)}
                className="flex w-full items-center gap-3 rounded-md border px-4 py-3 text-sm transition-colors hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  {t.description && <span className="block truncate text-xs text-muted-foreground">{t.description}</span>}
                </span>
                {t.archived && <Badge variant="secondary">archived</Badge>}
                <span className="text-xs text-muted-foreground">updated {formatDate(t.updated_at)}</span>
                <span className="text-xs text-muted-foreground">{versionLabel(t.latest_tag, t.latest_version)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
