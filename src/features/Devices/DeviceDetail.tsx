import { NavLink, Navigate, Route, Routes, useParams } from "react-router-dom";
import {
  Cog6ToothIcon,
  InformationCircleIcon,
  PuzzlePieceIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import DeviceConfig from "./DeviceConfig/DeviceConfig";
import ModuleList from "./ModuleConfig/ModuleList";
import ModulePage from "./ModuleConfig/ModulePage";
import DeviceInformation from "./DeviceInfo/DeviceInformation";
import useGetDevice from "@/generated/edge-administration/hooks/devices/useGetDevice";
import OPCUABrrowserPage from "../../pages/OPCUABrowser";
import DeploymentInfo from "./ModuleConfig/DeploymentInfo";
import { NetworkPage } from "./Network";
import { usePermissions } from "../authorization/permissions/use-permissions";
import { NoPermissionsPanel } from "../authorization/permissions/NoPermissionsPanel";
import { PERMISSION_KEYS } from "../authorization/permissions/permission-keys";
import DeviceHeader from "./DeviceHeader";
import RemoteAccess from "./Vpn/RemoteAccess";
import DevicePanel from "./DevicePanel";
import { LoadingState } from "@/components/ui/page-state";
import useGetDeviceMetadata from "@/generated/edge-administration/hooks/device_metadata/useGetDeviceMetadata";
import RoutedExtensionPanel from "@/features/Extensions/outlets/RoutedExtensionPanel";
import { useNavContributions } from "@/features/Extensions/outlets/useNavContributions";
import { useOutletUser } from "@/features/Extensions/outlets/useOutletUser";

function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border bg-white p-4">{children}</div>;
}

export default function DeviceDetail() {
  const { deviceId } = useParams();

  const device = useGetDevice(deviceId ?? "");

  const { hasPermission, noPermissionsMessage, isLoading } = usePermissions({ deviceId: deviceId, permissionKey: PERMISSION_KEYS.DEVICE_READ });

  const user = useOutletUser();
  const metadata = useGetDeviceMetadata(deviceId ?? "");
  const deviceTypeId = metadata.data?.typeId ?? "";
  const { hasPermission: canEdit } = usePermissions({ deviceId, permissionKey: PERMISSION_KEYS.DEVICE_METADATA_WRITE });
  const tabContext = { user, deviceId: deviceId ?? "", deviceTypeId, canEdit };
  const extensionTabs = useNavContributions("device", "tab", tabContext);

  const menu = [
    { title: "Info", href: "", icon: InformationCircleIcon, end: true },
    { title: "Device Config", href: "device-config", icon: Cog6ToothIcon },
    { title: "Assets", href: "assets", icon: ServerStackIcon },
    { title: "Applications", href: "applications", icon: Squares2X2Icon },
    { title: "Remote Access", href: "remote-access", icon: ShieldCheckIcon },
    ...extensionTabs.map((t) => ({ title: t.label, href: t.to, icon: PuzzlePieceIcon })),
  ];

  if (isLoading) {
    return <LoadingState label="Loading device..." className="h-full" />;
  }

  if (!hasPermission) {
    return <NoPermissionsPanel>{noPermissionsMessage}</NoPermissionsPanel>;
  }

  const base = `/devices/${deviceId}`;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <DeviceHeader
        deviceId={deviceId}
        connectionStatus={device.data?.connectionStatus}
        isLoading={device.isLoading}
        isError={device.isError}
        error={device.error}
      />

      <nav aria-label="Device navigation" className="shrink-0 rounded-lg border bg-white p-2">
        <div className="flex gap-1 overflow-x-auto">
          {menu.map((item) => (
            <NavLink
              key={item.href}
              to={item.href ? `${base}/${item.href}` : base}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 whitespace-nowrap rounded px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {item.title}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Routes>
            <Route
              path=""
              element={
                <DevicePanel
                  title="Information"
                  description="Hardware, firmware and the metadata stored for this device. Metadata is edited on the Assets tab."
                >
                  <DeviceInformation
                    data={device.data}
                    isPending={device.isPending}
                    isError={device.isError}
                    error={device.error as any}
                  />
                </DevicePanel>
              }
            />
            <Route path="device-config/*" element={<DeviceConfig />} />
            <Route
              path="applications/*"
              element={
                <Routes>
                  <Route
                    index
                    element={
                      <DevicePanel
                        title="Applications"
                        description="The deployment assigned to this device and the modules running on it. Select a module to configure it."
                      >
                        <DeploymentInfo />
                        <ModuleList />
                      </DevicePanel>
                    }
                  />
                  <Route path=":moduleId/*" element={<Panel><ModulePage /></Panel>} />
                </Routes>
              }
            />
            <Route
              path="assets"
              element={
                <Panel>
                  <NetworkPage deviceId={deviceId ?? "no device ID in the path"} />
                </Panel>
              }
            />
            <Route path="remote-access/*" element={<RemoteAccess />} />
            <Route
              path="x/:ext/:path/*"
              element={
                // wait for the device type: panels must not see an empty deviceTypeId, nor "not found" early
                metadata.isLoading ? (
                  <LoadingState label="Loading device..." />
                ) : (
                  <RoutedExtensionPanel target="device" placement="tab" context={tabContext} />
                )
              }
            />
            <Route path="vpn" element={<Navigate to={`${base}/remote-access/vpn`} replace />} />
            <Route
              path="opcua"
              element={
                <Panel>
                  <OPCUABrrowserPage />
                </Panel>
              }
            />
            <Route path="module-config" element={<Navigate to={`${base}/applications`} replace />} />
            <Route path="network" element={<Navigate to={`${base}/assets`} replace />} />
          </Routes>
        </div>
    </div>
  );
}
