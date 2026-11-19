import { useNavigate, useParams } from "react-router-dom";
import { CubeIcon } from "@heroicons/react/24/outline";
import { Heading } from "@/components/Typography/Heading";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage, isForbidden } from "@/lib/errors";
import { useAuth } from "@/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ConfigStatusBadge,
  ConfigSyncBadge,
  ConnectionBadge,
  ModuleStatusBadge,
  StackBadge,
  TypeBadge,
} from "./ModuleBadges";
import { modulePath, useModuleData } from "./useModuleData";

const HEAD_CLASS = "h-10 text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export default function ModuleList() {
  const { deviceId } = useParams();
  const auth = useAuth();
  const identity = JSON.stringify([auth.user?.iss, auth.user?.sub]);
  if (!auth.isAuthenticated) return null;
  return <ModuleListContent key={`${identity}:${deviceId}`} deviceId={deviceId} identity={identity} />;
}

function ModuleListContent({ deviceId, identity }: { deviceId?: string; identity: string }) {
  const navigate = useNavigate();
  const { modulesQuery, statusQuery } = useModuleData(deviceId, identity);
  const { error: modulesError, refetch: refetchModules } = modulesQuery;
  const { isPending, isError, data: moduleData, error: statusError, refetch } = statusQuery;

  if (modulesError) return <ErrorState title={isForbidden(modulesError) ? "Not permitted" : "Could not load the modules"} message={getErrorMessage(modulesError)} onRetry={() => { void refetchModules(); }} />;
  if (isPending) return <LoadingState label="Loading modules..." />
  if (isError) return <ErrorState title={isForbidden(statusError) ? "Not permitted" : "Could not load the modules"} message={getErrorMessage(statusError)} onRetry={() => { void refetch(); }} />

  const open = (moduleId: string) => navigate(modulePath(deviceId ?? "", moduleId));

  const moduleRows = moduleData.map((module) => (
    <TableRow
      className="cursor-pointer"
      key={module.moduleId}
      tabIndex={0}
      onClick={() => open(module.moduleId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(module.moduleId);
        }
      }}
    >
      <TableCell><ConnectionBadge module={module} /></TableCell>
      <TableCell><ModuleStatusBadge module={module} /></TableCell>
      <TableCell><ConfigSyncBadge module={module} /></TableCell>
      <TableCell><ConfigStatusBadge module={module} /></TableCell>
      <TableCell className="font-medium">{module.moduleName}</TableCell>
      <TableCell><StackBadge module={module} /></TableCell>
      <TableCell><TypeBadge module={module} /></TableCell>
      <TableCell>{module.version}</TableCell>
    </TableRow>
  ));

  return (
    <div className="space-y-2">
      <Heading>
        <CubeIcon />
        Modules
      </Heading>
      <div className="overflow-hidden rounded-lg border bg-background">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD_CLASS}>API</TableHead>
              <TableHead className={HEAD_CLASS}>Module Status</TableHead>
              <TableHead className={HEAD_CLASS}>Config Sync</TableHead>
              <TableHead className={HEAD_CLASS}>Config Status</TableHead>
              <TableHead className={HEAD_CLASS}>Module Name</TableHead>
              <TableHead className={HEAD_CLASS}>Stack</TableHead>
              <TableHead className={HEAD_CLASS}>Type</TableHead>
              <TableHead className={HEAD_CLASS}>Version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{moduleRows}</TableBody>
        </Table>
      </div>
    </div>
  );
}
