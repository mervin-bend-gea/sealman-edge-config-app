import { NavLink, Navigate, Route, Routes, useParams } from "react-router-dom";
import DeviceIpSetup from "./DeviceIpSetup";
import { Cellular } from "./DeviceCellularConfig";
import DeviceNatConfigProvided from "./NatConfig/DeviceNatConfigProvided";
import PortForwardingConfigProvider from "./PortForwardingConfig/provider";
import PortForwardingConfig from "./PortForwardingConfig/PortForwardingConfig";
import SavePortForwardingConfig from "./PortForwardingConfig/SavePortForwardingConfig";
import SecurityInformation from "../DeviceInfo/Security/SecurityInformation";
import Firmware from "./Firmware";
import CommandHistory from "./CommandHistory";
import { ActivateConfigButton } from "./ActivateConfigButton";
import useSmartEmsStatusPolling from "./useSmartEmsStatusPolling";

const TABS = [
  { title: "Network Interfaces", path: "network-interfaces" },
  // { title: "Firmware", path: "firmware" },
  { title: "NAT", path: "nat" },
  { title: "Port Forwarding", path: "port-forwarding" },
  { title: "Security", path: "security" },
  { title: "Activity", path: "config-activity" },
];

export default function DeviceConfig() {
  const { deviceId = "" } = useParams<{ deviceId: string }>();
  const base = `/devices/${deviceId}/device-config`;
  const { data: status } = useSmartEmsStatusPolling(deviceId);

  return (
    <div className="rounded-lg border bg-background shadow-xs">
      <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Device Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Firmware, security and network settings. Saved changes take effect once the config is activated.
          </p>
        </div>
        <div className="shrink-0">
          <ActivateConfigButton hasPendingChanges={status?.configUpdateScheduled === true} />
        </div>
      </div>

      <div className="flex items-start">
        <nav
          aria-label="Device configuration"
          className="flex w-52 shrink-0 flex-col gap-1 self-stretch border-r p-3 text-sm font-medium text-muted-foreground"
        >
          {TABS.map((tab) => (
            <NavLink
              key={tab.path}
              to={`${base}/${tab.path}`}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 transition-colors ${
                  tab.path === "config-activity" ? "mt-3 border-t border-border pt-4" : ""
                } ${isActive ? "bg-muted text-foreground shadow-sm" : "hover:bg-muted/60 hover:text-foreground"}`
              }
            >
              {tab.title}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-6 p-6">
        <Routes>
          <Route index element={<Navigate to={`${base}/network-interfaces`} replace />} />
          <Route path="firmware" element={<Firmware />} />
          <Route path="config-activity" element={<CommandHistory />} />
          <Route path="command-history" element={<Navigate to={`${base}/config-activity`} replace />} />
          <Route path="security" element={<SecurityInformation />} />
          <Route
            path="network-interfaces"
            element={
              <div className="space-y-4">
                <DeviceIpSetup />
                <Cellular />
              </div>
            }
          />
          <Route path="nat" element={<DeviceNatConfigProvided />} />
          <Route
            path="port-forwarding"
            element={
              <PortForwardingConfigProvider deviceId={deviceId}>
                <PortForwardingConfig footer={<SavePortForwardingConfig deviceId={deviceId} />} />
              </PortForwardingConfigProvider>
            }
          />
          <Route path="*" element={<Navigate to={`${base}/network-interfaces`} replace />} />
        </Routes>
        </div>
      </div>
    </div>
  );
}
