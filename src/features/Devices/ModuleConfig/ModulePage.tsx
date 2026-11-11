import type { ReactNode } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { ErrorState, InlineAlert, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage, isForbidden } from "@/lib/errors";
import { useAuth } from "@/auth";
import ExtensionOutlet from "@/features/Extensions/outlets/ExtensionOutlet";
import RoutedExtensionPanel from "@/features/Extensions/outlets/RoutedExtensionPanel";
import { useNavContributions } from "@/features/Extensions/outlets/useNavContributions";
import { useOutletUser } from "@/features/Extensions/outlets/useOutletUser";
import useGetDeviceMetadata from "@/generated/edge-administration/hooks/device_metadata/useGetDeviceMetadata";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import type { ModuleData } from "@/api/edgeConfig/edgeConfigApiHooks";
import Box from "@/features/ModuleConfigTemplates/Box";
import ModuleConfig from "./ModuleConfig";
import ModuleConfigHistory from "./ModuleConfigHistory";
import ModuleConfigTab from "./ModuleConfigTab";
import DirectMethods from "./DirectMethods";
import ModuleLogs from "./ModuleLogs";
import ModuleReported from "./ModuleReported";
import {
  ConfigStatusBadge,
  ConfigSyncBadge,
  ConnectionBadge,
  ModuleStatusBadge,
  StackBadge,
  TypeBadge,
} from "./ModuleBadges";
import { modulePath, useModuleData } from "./useModuleData";

/** The built-in tabs. Extensions can append tabs after them (`module`/`tab`) or replace the first one or the whole page. */
const TABS = [
  { label: "Configuration", to: "", end: true },
  { label: "Raw JSON", to: "raw", end: false },
  { label: "History", to: "history", end: false },
  { label: "Methods", to: "methods", end: false },
  { label: "Reported", to: "reported", end: false },
  { label: "Logs", to: "logs", end: false },
];

/** A module's own page: summary, then the configuration, history, methods, reported properties and logs. */
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

  const backLink = (
    <Link to={back} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
      Applications
    </Link>
  );

  const loadError = modulesQuery.error ?? statusQuery.error;
  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
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
      <div className="flex flex-col gap-4">
        {backLink}
        <ErrorState title="Module not found" message={`Device ${deviceId} has no module "${moduleId}".`} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {backLink}
      <ModuleSummary module={module} />
      <ModuleBody deviceId={deviceId} module={module} onDataChanged={refresh} />
    </div>
  );
}

const WITHOUT_ERROR_NOTE = new Set(["configuration successfull", "configuration successful"]);

/** How the application's own message is shown: by what it reports about the configuration, not as a warning by default. */
const NOTE_VARIANT: Record<string, "error" | "success"> = { ERROR: "error", OK: "success" };

function Fact({ help, children }: { help: string; children: ReactNode }) {
  return <span title={help}>{children}</span>;
}

/** Who and in which state: name, version, the status badges and what the application says about its configuration. */
function ModuleSummary({ module }: { module: ModuleData }) {
  const note = module.appMessage && !WITHOUT_ERROR_NOTE.has(module.appMessage) ? module.appMessage : undefined;
  return (
    <section aria-label="Module summary" className="w-full space-y-3 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold">{module.moduleName}</h2>
        <span className="text-sm text-muted-foreground">{module.version}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Fact help="Connection of the module to the IoT Hub"><ConnectionBadge module={module} /></Fact>
        <Fact help="Runtime state of the module"><ModuleStatusBadge module={module} /></Fact>
        <Fact help="Config sync: whether the module reported the configuration that is desired"><ConfigSyncBadge module={module} /></Fact>
        <Fact help="What the application reports about the configuration it received"><ConfigStatusBadge module={module} /></Fact>
        <Fact help="Deployment stack"><StackBadge module={module} /></Fact>
        <Fact help="Module type"><TypeBadge module={module} /></Fact>
        {module.desiredConfId && (
          <span className="ml-2 text-xs text-muted-foreground" title="Identifier of the desired and of the reported configuration">
            desired <code>{module.desiredConfId.slice(0, 8)}</code>
            {module.reportedConfId && <> · reported <code>{module.reportedConfId.slice(0, 8)}</code></>}
          </span>
        )}
      </div>
      {note && (
        <InlineAlert variant={NOTE_VARIANT[module.appStatus ?? ""] ?? "info"} className="max-h-36 overflow-y-auto">
          {note}
        </InlineAlert>
      )}
    </section>
  );
}

/** Everything below the summary: an extension may replace all of it, otherwise the tabs. */
function ModuleBody({ deviceId, module, onDataChanged }: { deviceId: string; module: ModuleData; onDataChanged: () => void }) {
  const user = useOutletUser();
  const metadata = useGetDeviceMetadata(deviceId);
  const { hasPermission: canEdit } = usePermissions({ deviceId, permissionKey: PERMISSION_KEYS.DEVICE_MODULE_TWIN_CONFIG_WRITE });
  const context = {
    user, deviceId, deviceTypeId: metadata.data?.typeId ?? "", moduleId: module.moduleId, moduleType: module.moduleType,
    moduleVersion: module.version, canEdit,
  };

  // Panels must not see an empty deviceTypeId, so wait for the device metadata.
  if (metadata.isLoading) return <LoadingState label="Loading module..." />;

  return (
    <ExtensionOutlet
      target="module"
      placement="replace:page"
      context={context}
      onDataChanged={onDataChanged}
      fallback={<ModuleTabs deviceId={deviceId} module={module} context={context} onDataChanged={onDataChanged} />}
    />
  );
}

function ModuleTabs({ deviceId, module, context, onDataChanged }: {
  deviceId: string;
  module: ModuleData;
  context: object;
  onDataChanged: () => void;
}) {
  const navigate = useNavigate();
  const base = modulePath(deviceId, module.moduleId);
  const extensionTabs = useNavContributions("module", "tab", context);
  const tabs = [
    ...TABS.map((t) => ({ ...t, key: t.label })),
    ...extensionTabs.map((t) => ({ label: t.label, to: t.to, end: false, key: `x:${t.to}` })),
  ];

  return (
    <>
      <nav aria-label="Module navigation" className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm font-medium text-muted-foreground">
        {tabs.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.to ? `${base}/${tab.to}` : base}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-md px-4 py-1.5 text-center transition-colors focus:outline-hidden ${isActive ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route
          index
          element={
            <ExtensionOutlet
              target="module"
              placement="replace:config"
              context={context}
              onDataChanged={onDataChanged}
              fallback={
                <ModuleConfigTab deviceId={deviceId} moduleName={module.moduleId} moduleStatus={module.status}
                                 onOpenHistory={() => navigate(`${base}/history`)} />
              }
            />
          }
        />
        <Route path="raw" element={<ModuleConfig moduleName={module.moduleId} moduleStatus={module.status} />} />
        <Route
          path="history"
          element={
            <ModuleConfigHistory
              deviceId={deviceId}
              moduleName={module.moduleId}
              blocked={module.status === "delete_scheduled" || module.status === "deploy_scheduled"}
              onUseValues={(r) => navigate(base, {
                state: { prefill: { templateId: r.template_id, version: r.template_version, values: r.values ?? {} } },
              })}
            />
          }
        />
        <Route
          path="methods"
          element={<Box label="Direct methods" title="Direct methods" description="Run a method on the module."><DirectMethods moduleName={module.moduleId} /></Box>}
        />
        <Route path="reported" element={<ModuleReported deviceId={deviceId} moduleName={module.moduleId} />} />
        <Route path="logs" element={<ModuleLogs moduleName={module.moduleId} />} />
        <Route path="x/:ext/:path/*" element={<RoutedExtensionPanel target="module" placement="tab" context={context} />} />
      </Routes>
    </>
  );
}
