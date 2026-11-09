import { Link, NavLink, Route, Routes, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage, isForbidden } from "@/lib/errors";
import { useAuth } from "@/auth";
import ExtensionOutlet from "@/features/Extensions/outlets/ExtensionOutlet";
import { useOutletUser } from "@/features/Extensions/outlets/useOutletUser";
import useGetDeviceMetadata from "@/generated/edge-administration/hooks/device_metadata/useGetDeviceMetadata";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import type { ModuleData } from "@/api/edgeConfig/edgeConfigApiHooks";
import ModuleConfig from "./ModuleConfig";
import DirectMethods from "./DirectMethods";
import ModuleLogs from "./ModuleLogs";
import {
  ConfigStatusBadge,
  ConfigSyncBadge,
  ConnectionBadge,
  ModuleStatusBadge,
  StackBadge,
  TypeBadge,
} from "./ModuleBadges";
import { modulePath, useModuleData } from "./useModuleData";

const TABS = [
  { label: "Module Configuration", to: "", end: true },
  { label: "Methods", to: "methods", end: false },
  { label: "Logs", to: "logs", end: false },
];

/** A module's own page: configuration (or the extension that replaces it), methods and logs. */
export default function ModulePage() {
  const { deviceId, moduleId } = useParams();
  const auth = useAuth();
  const identity = JSON.stringify([auth.user?.iss, auth.user?.sub]);
  if (!auth.isAuthenticated || !deviceId || !moduleId) return null;
  return <ModulePageContent key={`${identity}:${deviceId}:${moduleId}`} deviceId={deviceId} moduleId={moduleId} identity={identity} />;
}

function ModulePageContent({ deviceId, moduleId, identity }: { deviceId: string; moduleId: string; identity: string }) {
  const { modulesQuery, statusQuery, refresh } = useModuleData(deviceId, identity);
  const back = `/devices/${encodeURIComponent(deviceId)}/applications`;
  const base = modulePath(deviceId, moduleId);

  const backLink = (
    <Link to={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
      Applications
    </Link>
  );

  const loadError = modulesQuery.error ?? statusQuery.error;
  if (loadError) {
    return (
      <div className="space-y-3">
        {backLink}
        <ErrorState
          title={isForbidden(loadError) ? "Not permitted" : "Could not load the module"}
          message={getErrorMessage(loadError)}
          onRetry={() => { void modulesQuery.refetch(); void statusQuery.refetch(); }}
        />
      </div>
    );
  }
  const modules = statusQuery.data;
  if (!modules) return <LoadingState label="Loading module..." />;

  const module = modules.find((m) => m.moduleId === moduleId);
  if (!module) {
    return (
      <div className="space-y-3">
        {backLink}
        <ErrorState title="Module not found" message={`Device ${deviceId} has no module "${moduleId}".`} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {backLink}
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{module.moduleName}</h2>
        <ConnectionBadge module={module} />
        <ModuleStatusBadge module={module} />
        <ConfigSyncBadge module={module} />
        <ConfigStatusBadge module={module} />
        <StackBadge module={module} />
        <TypeBadge module={module} />
        <span className="text-sm text-muted-foreground">{module.version}</span>
      </header>

      <nav aria-label="Module navigation" className="grid max-w-xl grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-sm font-medium text-muted-foreground">
        {TABS.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to ? `${base}/${tab.to}` : base}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-center transition-colors focus:outline-hidden ${isActive ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route index element={<ConfigTab deviceId={deviceId} module={module} onDataChanged={refresh} />} />
        <Route path="methods" element={<DirectMethods moduleName={module.moduleId} />} />
        <Route path="logs" element={<ModuleLogs moduleName={module.moduleId} />} />
      </Routes>
    </div>
  );
}

function ConfigTab({ deviceId, module, onDataChanged }: { deviceId: string; module: ModuleData; onDataChanged: () => void }) {
  const user = useOutletUser();
  const metadata = useGetDeviceMetadata(deviceId);
  const deviceTypeId = metadata.data?.typeId ?? "";
  const { hasPermission: canEdit } = usePermissions({ deviceId, permissionKey: PERMISSION_KEYS.DEVICE_MODULE_TWIN_CONFIG_WRITE });

  // Panels must not see an empty deviceTypeId, so wait for the device metadata.
  if (metadata.isLoading) return <LoadingState label="Loading module configuration..." />;

  return (
    <ExtensionOutlet
      target="module"
      placement="replace:config"
      context={{ user, deviceId, deviceTypeId, moduleId: module.moduleId, moduleType: module.moduleType, moduleVersion: module.version, canEdit }}
      onDataChanged={onDataChanged}
      fallback={
        <div className="h-[65vh] min-h-[28rem]">
          <ModuleConfig moduleName={module.moduleId} appMessage={module.appMessage} moduleStatus={module.status} />
        </div>
      }
    />
  );
}
