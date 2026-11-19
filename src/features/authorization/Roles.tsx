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
import { RoleDeleteDialog } from "./RoleDeleteDialog";
import { RoleEditDialog } from "./RoleEditDialog";
import { usePermissions } from "./permissions/use-permissions";
import { PERMISSION_KEYS } from "./permissions/permission-keys";

type RoleResponse = components["schemas"]["RoleResponse"];

const columnHelper = createColumnHelper<RoleResponse>();

export default function Roles() {
  const { data: roles, isLoading, isError, error } = edgeConfigApiHooks.useGetRoles();
  const { hasPermission: canWrite } = usePermissions({ permissionKey: PERMISSION_KEYS.PLATFORM_AUTHORIZATION_WRITE });
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleResponse | null>(null);
  const [editRoleTarget, setEditRoleTarget] = useState<RoleResponse | null>(null);
  const [isCreateRoleDialogOpen, setIsCreateRoleDialogOpen] = useState(false);

  const handleEditRole = (role: RoleResponse) => {
    setEditRoleTarget(role);
  };

  const handleDeleteRole = (role: RoleResponse) => {
    setDeleteRoleTarget(role);
  };

  const handleCreateRole = () => {
    setIsCreateRoleDialogOpen(true);
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
      columnHelper.accessor("actions", {
        header: "Actions",
        cell: (info) => {
          const actions = info.getValue();

          if (actions.length === 0) {
            return <span className="text-muted-foreground">-</span>;
          }

          return (
            <div className="flex flex-wrap gap-1.5">
              {actions.map((action) => (
                <span
                  key={action}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {action}
                </span>
              ))}
            </div>
          );
        },
      }),
      ...(canWrite ? [columnHelper.display({
        id: "row-actions",
        header: "",
        meta: { align: "center" },
        cell: (info) => {
          const role = info.row.original;

          return (
            <div className="flex items-center justify-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="icon" onClick={() => handleEditRole(role)} aria-label={`Edit role ${role.name}`}><PencilSquareIcon /></Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteRole(role)} aria-label={`Delete role ${role.name}`}><TrashIcon /></Button>
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
    data: roles ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return <LoadingState label="Loading roles..." />;
  }

  if (isError) {
    return <ErrorState title="Could not load roles" message={getErrorMessage(error)} />;
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="bg-card border rounded-lg p-4 flex-1 min-h-0 flex flex-col gap-3">
        {canWrite && (
          <div className="flex justify-end">
            <Button type="button" onClick={handleCreateRole}>
              New role
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
                    No roles found
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
                        } ${cell.column.columnDef.meta?.align === "center" ? "px-3 py-2" : ""}`}
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

      <RoleDeleteDialog
        roleId={deleteRoleTarget?.id ?? null}
        roleName={deleteRoleTarget?.name ?? ""}
        open={Boolean(deleteRoleTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteRoleTarget(null);
          }
        }}
      />

      <RoleEditDialog
        role={editRoleTarget}
        open={Boolean(editRoleTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setEditRoleTarget(null);
          }
        }}
      />

      <RoleEditDialog
        role={null}
        open={isCreateRoleDialogOpen}
        onOpenChange={setIsCreateRoleDialogOpen}
      />
    </div>
  );
}
