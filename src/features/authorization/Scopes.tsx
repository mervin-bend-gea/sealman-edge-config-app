import { useMemo, useState } from "react";
import { edgeConfigApiHooks } from "@/api/edgeConfig/edgeConfigApiHooks";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage } from "@/lib/errors";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table, TBody, TD, TH, THead, TR } from "@/components/Table/TableComponents";
import type { components } from "@/generated/edge-administration/types";
import { ScopeDeleteDialog } from "./ScopeDeleteDialog";
import { ScopeEditDialog } from "./ScopeEditDialog";
import { usePermissions } from "./permissions/use-permissions";
import { PERMISSION_KEYS } from "./permissions/permission-keys";

type ScopeResponse = components["schemas"]["ScopeResponse"];

const columnHelper = createColumnHelper<ScopeResponse>();

function formatAttrValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null) {
          return "null";
        }

        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
          return String(item);
        }

        return JSON.stringify(item);
      })
      .join(", ");
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export default function Scopes() {
  const { data: scopes, isLoading, isError, error } = edgeConfigApiHooks.useGetScopes();
  const { hasPermission: canWrite } = usePermissions({ permissionKey: PERMISSION_KEYS.PLATFORM_AUTHORIZATION_WRITE });
  const [deleteScopeTarget, setDeleteScopeTarget] = useState<ScopeResponse | null>(null);
  const [editScopeTarget, setEditScopeTarget] = useState<ScopeResponse | null>(null);
  const [isCreateScopeDialogOpen, setIsCreateScopeDialogOpen] = useState(false);

  const handleEditScope = (scope: ScopeResponse) => {
    setEditScopeTarget(scope);
  };

  const handleDeleteScope = (scope: ScopeResponse) => {
    setDeleteScopeTarget(scope);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor("description", {
        header: "Description",
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue() || "-"}</span>
        ),
      }),
      columnHelper.accessor("attr", {
        id: "attr",
        header: "Attributes",
        cell: (info) => {
          const attr = info.getValue();

          if (Object.keys(attr).length === 0) {
            return <span className="text-muted-foreground">-</span>;
          }

          return (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(attr).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {key}: {formatAttrValue(value)}
                </span>
              ))}
            </div>
          );
        },
      }),
      columnHelper.accessor("access_rule", {
        header: "Access Rule",
      }),
      columnHelper.accessor("team_usage_count", {
        header: "Used by (teams)",
        meta: { align: "right" },
      }),
      ...(canWrite ? [columnHelper.display({
        id: "actions",
        header: "Actions",
        meta: { align: "center" },
        cell: (info) => {
          const scope = info.row.original;

          return (
            <div className="flex items-center justify-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="icon" onClick={() => handleEditScope(scope)} aria-label={`Edit scope ${scope.name}`}><PencilSquareIcon /></Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteScope(scope)} aria-label={`Delete scope ${scope.name}`}><TrashIcon /></Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      })] : []),
    ],
    [canWrite],
  );

  const table = useReactTable({
    data: scopes ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return <LoadingState label="Loading scopes..." />;
  }

  if (isError) {
    return <ErrorState title="Could not load scopes" message={getErrorMessage(error)} />;
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="bg-card border rounded-lg p-4 flex-1 min-h-0 flex flex-col gap-3">
        {canWrite && (
          <div className="flex justify-end">
            <Button type="button" onClick={() => setIsCreateScopeDialogOpen(true)}>
              New scope
            </Button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
          <Table className="w-full text-sm border-collapse">
            <THead className="bg-background sticky top-0 z-20 shadow-xs">
              {table.getHeaderGroups().map((headerGroup) => (
                <TR
                  key={headerGroup.id}
                  className="bg-linear-to-r from-slate-100 to-slate-50 border-b even:bg-transparent"
                >
                  {headerGroup.headers.map((header) => (
                    <TH
                      key={header.id}
                      className={`px-4 py-3 font-semibold text-muted-foreground tracking-wide ${
                        header.column.columnDef.meta?.align === "right"
                          ? "text-right"
                          : header.column.columnDef.meta?.align === "center"
                            ? "text-center"
                            : "text-left"
                      } ${header.column.columnDef.meta?.align === "center" ? "w-28" : ""}`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TH>
                  ))}
                </TR>
              ))}
            </THead>

            <TBody className="bg-background">
              {table.getRowModel().rows.length === 0 ? (
                <TR>
                  <TD
                    colSpan={columns.length}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    No scopes found
                  </TD>
                </TR>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TR key={row.id} className="border-b last:border-b-0 even:bg-transparent">
                    {row.getVisibleCells().map((cell) => (
                      <TD
                        key={cell.id}
                        className={`p-3 ${
                          cell.column.columnDef.meta?.align === "right"
                            ? "text-right"
                            : cell.column.columnDef.meta?.align === "center"
                              ? "text-center"
                              : ""
                        } ${cell.column.columnDef.meta?.align === "center" ? "px-3 py-2" : ""} ${
                          cell.column.id === "attr" ? "align-top" : ""
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TD>
                    ))}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </div>

      <ScopeDeleteDialog
        scopeId={deleteScopeTarget?.id ?? null}
        scopeName={deleteScopeTarget?.name ?? ""}
        teamUsageCount={deleteScopeTarget?.team_usage_count ?? 0}
        open={Boolean(deleteScopeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteScopeTarget(null);
          }
        }}
      />

      <ScopeEditDialog
        scope={editScopeTarget}
        open={Boolean(editScopeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setEditScopeTarget(null);
          }
        }}
      />

      <ScopeEditDialog
        scope={null}
        open={isCreateScopeDialogOpen}
        onOpenChange={setIsCreateScopeDialogOpen}
      />
    </div>
  );
}