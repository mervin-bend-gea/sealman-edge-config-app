import { LinkIcon } from "@heroicons/react/24/outline";
import Badge, { BadgeColor } from "@/components/Typography/Badge";
import type { ModuleData } from "@/api/edgeConfig/edgeConfigApiHooks";

const RUNTIME_MODULES = ["$edgeAgent", "$edgeHub"];

function moduleStatusColor(module: ModuleData): BadgeColor {
  const isRuntime = RUNTIME_MODULES.includes(module.moduleName);
  switch (module.status) {
    case "runtime_online":
      return isRuntime ? BadgeColor.Green : BadgeColor.Gray;
    case "runtime_offline":
      return isRuntime ? BadgeColor.Yellow : BadgeColor.Gray;
    case null:
      return isRuntime ? BadgeColor.Green : BadgeColor.Gray;
    case "running":
      return BadgeColor.Green;
    case "backoff":
    case "failed":
    case "unhealthy":
    case "stopped":
      return BadgeColor.Red;
    case "deploy_scheduled":
      return BadgeColor.Purple;
    case "delete_scheduled":
      return BadgeColor.Yellow;
    default:
      return BadgeColor.Gray;
  }
}

const MODULE_STATUS_LABELS: Record<string, string> = {
  running: "RUNNING",
  backoff: "BACKOFF",
  failed: "FAILED",
  unhealthy: "UNHEALTHY",
  stopped: "STOPPED",
  unknown: "UNKNOWN",
  "failed:grey": "FAILED",
  "running:grey": "RUNNING",
  "backoff:grey": "BACKOFF",
  "unhealthy:grey": "UNHEALTHY",
  "stopped:grey": "STOPPED",
  runtime_online: "RUNTIME ONLINE",
  runtime_offline: "RUNTIME OFFLINE",
};

export function ConnectionBadge({ module }: { module: ModuleData }) {
  const connected = module.connectionState === "Connected";
  return (
    <Badge color={connected ? BadgeColor.Green : BadgeColor.Red}>
      {connected ? <LinkIcon className="w-3 h-3" /> : ""}
    </Badge>
  );
}

export function ModuleStatusBadge({ module }: { module: ModuleData }) {
  return (
    <Badge color={moduleStatusColor(module)}>
      {module.status === null ? "UNKNOWN" : MODULE_STATUS_LABELS[module.status]}
    </Badge>
  );
}

export function ConfigSyncBadge({ module }: { module: ModuleData }) {
  switch (module.confStatus) {
    case "NO_CONFIG":
      return <Badge color={BadgeColor.Gray}>NTS</Badge>;
    case "OK":
      return <Badge color={BadgeColor.Green}>SYNC</Badge>;
    case "PENDING":
      return <Badge color={BadgeColor.Yellow}>PENDING</Badge>;
    case "INITIAL_PENDING":
      return <Badge color={BadgeColor.Purple}>INITIAL_PENDING</Badge>;
    default:
      return <Badge color={BadgeColor.Purple}>{module.confStatus}</Badge>;
  }
}

export function ConfigStatusBadge({ module }: { module: ModuleData }) {
  switch (module.appStatus) {
    case "OK":
      return <Badge color={BadgeColor.Green}>CONFIG OK</Badge>;
    case "ERROR":
      return <Badge color={BadgeColor.Red}>CONFIG ERROR</Badge>;
    case "NO_STATUS":
      return <Badge color={BadgeColor.Gray}>NO CONFIG</Badge>;
    default:
      return <Badge color={BadgeColor.Purple}>{module.appStatus}</Badge>;
  }
}

export function StackBadge({ module }: { module: ModuleData }) {
  return <Badge color={module.deploymentType === "sems" ? BadgeColor.Yellow : BadgeColor.Indigo}>
    {module.deploymentType === "sems" ? "sems" : "base"}
  </Badge>;
}

export function TypeBadge({ module }: { module: ModuleData }) {
  switch (module.moduleType) {
    case "api":
      return <Badge color={BadgeColor.Purple}>api</Badge>;
    case "compose":
      return <Badge color={BadgeColor.Yellow}>compose</Badge>;
    default:
      return <Badge color={BadgeColor.Indigo}>iotedge</Badge>;
  }
}
