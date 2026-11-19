import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, FileCode2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage, isForbidden } from "@/lib/errors";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import { useTemplateGroups, type TemplateGroup } from "./api";
import { GroupBadges } from "./badges";
import { TEMPLATES_PATH } from "./utils";

function matches(group: TemplateGroup, query: string) {
  const haystack = [
    group.name, group.description ?? "", ...group.module_names, ...group.scopes.map((s) => s.name),
  ].join("\n").toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

/** First page of the module templates: find, select or create a template group. */
export default function TemplateGroupList() {
  const navigate = useNavigate();
  const groups = useTemplateGroups();
  const [query, setQuery] = useState("");
  const { hasPermission: canWrite } = usePermissions({ permissionKey: PERMISSION_KEYS.MODULE_CONFIG_TEMPLATE_WRITE });
  const all = groups.data ?? [];
  const shown = all.filter((n) => matches(n, query));

  return (
    <>
      <section className="flex w-full items-start justify-between gap-4 rounded-lg border bg-card p-5">
        <div>
          <h1 className="text-xl font-semibold">Module Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a template group to configure edge modules from its templates. A template group ties its templates to modules
            and, optionally, to scopes.
          </p>
        </div>
        <Button className="shrink-0" disabled={!canWrite} onClick={() => navigate(`${TEMPLATES_PATH}/new`)}>
          <Plus className="mr-1 h-4 w-4" /> New template group
        </Button>
      </section>

      <section aria-label="Search template groups" className="w-full rounded-lg border bg-card p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search template groups"
            placeholder="Search by name, description, module or scope"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </section>

      {groups.isLoading && <LoadingState label="Loading template groups..." />}
      {groups.isError && (
        <InlineAlert action={<Button size="sm" variant="outline" onClick={() => void groups.refetch()}>Retry</Button>}>
          {isForbidden(groups.error) ? "You may not browse module templates." : getErrorMessage(groups.error)}
        </InlineAlert>
      )}
      {groups.data && shown.length === 0 && (
        <section className="flex w-full flex-col items-center gap-2 rounded-lg border bg-card py-12 text-sm text-muted-foreground">
          <FileCode2 className="h-8 w-8 opacity-30" aria-hidden="true" />
          {all.length === 0 ? "No template groups yet: create one to add templates." : `No template group matches "${query}".`}
        </section>
      )}
      {shown.map((group) => (
        <Link
          key={group.id}
          to={`${TEMPLATES_PATH}/${group.id}`}
          aria-label={`Template Group ${group.name}`}
          className="group flex w-full items-center gap-4 rounded-lg border bg-card p-5 transition-colors hover:border-primary hover:bg-muted/40"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-base font-semibold">{group.name}</h2>
              <span className="text-xs text-muted-foreground">
                {group.template_count} {group.template_count === 1 ? "template" : "templates"}
              </span>
            </div>
            {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
            <GroupBadges modules={group.module_names} scopes={group.scopes} />
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
        </Link>
      ))}
    </>
  );
}
