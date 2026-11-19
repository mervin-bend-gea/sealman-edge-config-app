import { useMemo, useState } from "react";
import { edgeConfigApiHooks } from "@/api/edgeConfig/edgeConfigApiHooks";
import { PencilSquareIcon, TrashIcon, UsersIcon } from "@heroicons/react/24/outline";
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
import { TeamDeleteDialog } from "./TeamDeleteDialog";
import { TeamEditDialog } from "./TeamEditDialog";
import { TeamMembersDialog } from "./TeamMembersDialog";
import { usePermissions } from "./permissions/use-permissions";
import { PERMISSION_KEYS } from "./permissions/permission-keys";

type TeamListItemResponse = components["schemas"]["TeamListItemResponse"];

const columnHelper = createColumnHelper<TeamListItemResponse>();

export default function Teams() {
  const { data: teams, isLoading, isError, error } = edgeConfigApiHooks.useGetTeams();
  const { hasPermission: canWrite } = usePermissions({ permissionKey: PERMISSION_KEYS.PLATFORM_AUTHORIZATION_WRITE });
  const [deleteTeamTarget, setDeleteTeamTarget] = useState<TeamListItemResponse | null>(null);
  const [editTeamTarget, setEditTeamTarget] = useState<TeamListItemResponse | null>(null);
  const [membersTeamTarget, setMembersTeamTarget] = useState<TeamListItemResponse | null>(null);
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);

  const handleEditTeam = (team: TeamListItemResponse) => {
    setEditTeamTarget(team);
  };

  const handleDeleteTeam = (team: TeamListItemResponse) => {
    setDeleteTeamTarget(team);
  };

  const handleCreateTeam = () => {
    setIsCreateTeamDialogOpen(true);
  };

  const handleMembers = (team: TeamListItemResponse) => {
    setMembersTeamTarget(team);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor("roles", {
        header: "Roles",
        cell: (info) => {
          const roles = info.getValue();

          if (roles.length === 0) {
            return <span className="text-muted-foreground">-</span>;
          }

          return (
            <div className="flex flex-wrap gap-1.5">
              {roles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {role.name}
                </span>
              ))}
            </div>
          );
        },
      }),
      columnHelper.accessor("scope", {
        header: "Scope",
        cell: (info) => {
          const scope = info.getValue();
          if (!scope) {
            return (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                global
              </span>
            );
          }
          return <span className="text-muted-foreground">{scope.name}</span>;
        },
      }),
      columnHelper.accessor("user_count", {
        header: "Users",
        meta: { align: "right" },
      }),
      ...(canWrite ? [columnHelper.display({
        id: "actions",
        header: "",
        meta: { align: "center" },
        cell: (info) => {
          const team = info.row.original;

          return (
            <div className="flex items-center justify-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="icon" onClick={() => handleEditTeam(team)} aria-label={`Edit team ${team.name}`}><PencilSquareIcon /></Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="icon" onClick={() => handleMembers(team)} aria-label={`Manage members of ${team.name}`}><UsersIcon /></Button>
                  </TooltipTrigger>
                  <TooltipContent>Members</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteTeam(team)} aria-label={`Delete team ${team.name}`}><TrashIcon /></Button>
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
    data: teams ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return <LoadingState label="Loading teams..." />;
  }

  if (isError) {
    return <ErrorState title="Could not load teams" message={getErrorMessage(error)} />;
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="bg-card border rounded-lg p-4 flex-1 min-h-0 flex flex-col gap-3">
        {canWrite && (
          <div className="flex justify-end">
            <Button type="button" onClick={handleCreateTeam}>
              New team
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
                    No teams found
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

      <TeamDeleteDialog
        teamId={deleteTeamTarget?.id ?? null}
        teamName={deleteTeamTarget?.name ?? ""}
        userCount={deleteTeamTarget?.user_count ?? 0}
        open={Boolean(deleteTeamTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTeamTarget(null);
          }
        }}
      />

      <TeamEditDialog
        team={editTeamTarget}
        open={Boolean(editTeamTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setEditTeamTarget(null);
          }
        }}
      />

      <TeamEditDialog
        team={null}
        open={isCreateTeamDialogOpen}
        onOpenChange={setIsCreateTeamDialogOpen}
      />

      <TeamMembersDialog
        team={membersTeamTarget}
        open={Boolean(membersTeamTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setMembersTeamTarget(null);
          }
        }}
      />
    </div>
  );
}
