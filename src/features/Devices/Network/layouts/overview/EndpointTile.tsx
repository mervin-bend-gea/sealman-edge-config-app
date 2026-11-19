import { useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EndpointStatus, Port, LastStatusChange } from "@/features/Devices/Network/components";
import { MappedEndpoint, MappedPort } from "@/generated/edge-administration/hooks/network/usePostNetworkOverview";
import { portListKey } from "./overviewMerge";
import { TILE_WIDTH } from "./canvasLayout";
import {
  EndpointDialogs,
  EndpointIdentity,
  EndpointPrimaryAction,
  PortActions,
} from "./endpointShared";
import { BrowseTarget, portNeedsAssignment, useEndpointDisplay } from "./endpointLogic";
import { useShowConnectionState } from "./connectionStateContext";

export interface EndpointNodeData extends Record<string, unknown> {
  endpoint: MappedEndpoint;
  deviceId: string;
  onCreated: () => void;
  onOpenDetails: (endpointId: string) => void;
  onOpenServiceDetails: (serviceId: string) => void;
}

export type EndpointNode = Node<EndpointNodeData, "endpoint">;

const STATUS_ACCENT: Record<MappedEndpoint["status"], string> = {
  online: "border-l-green-500",
  offline: "border-l-red-400",
  unknown: "border-l-orange-400",
};

/** An endpoint as a free-floating canvas tile: same data and actions as the list row, laid out as a card. */
export default function EndpointTile({ data }: NodeProps<EndpointNode>) {
  const { endpoint, deviceId, onCreated, onOpenDetails, onOpenServiceDetails } = data;
  const display = useEndpointDisplay(endpoint);
  const showState = useShowConnectionState();
  const { isConfigured, isUnidentified, needsAssignment } = display;

  const [assignEndpointOpen, setAssignEndpointOpen] = useState(false);
  const [assignPort, setAssignPort] = useState<MappedPort | null>(null);
  const [browsing, setBrowsing] = useState<BrowseTarget | null>(null);

  const border = isUnidentified ? "border-orange-300" : needsAssignment ? "border-amber-300" : "border-border";

  return (
    <div
      style={{ width: TILE_WIDTH }}
      className={`cursor-grab overflow-hidden rounded-xl border border-l-4 bg-background shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${border} ${showState ? STATUS_ACCENT[endpoint.status] : "border-l-slate-300"}`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="opacity-0!" />
      <div className={`flex items-start gap-2 border-b px-3 py-3 ${needsAssignment ? "bg-amber-50" : isUnidentified ? "bg-orange-50/60" : "bg-slate-50/60"}`}>
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        <EndpointIdentity display={display} className="min-w-0 flex-1" />
        {showState && (
          <div className="shrink-0 pt-0.5">
            <EndpointStatus value={endpoint.status} type="icon" />
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        {endpoint.ports.length === 0 ? (
          <p className="text-xs text-muted-foreground">No services detected on this endpoint.</p>
        ) : (
          <ul className="space-y-2">
            {endpoint.ports.map((port) => {
              const needsPortAssignment = portNeedsAssignment(port);
              // Only an already-assigned service has a detail page to jump to.
              const serviceId = port.service_id;
              return (
                <li
                  key={portListKey(port)}
                  className={`nodrag nopan rounded-lg border px-3 py-2 ${
                    needsPortAssignment ? "border-amber-200 bg-amber-50" : "bg-background"
                  } ${serviceId ? "cursor-pointer hover:bg-muted/40" : "cursor-default"}`}
                  onClick={serviceId ? () => onOpenServiceDetails(serviceId) : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Port value={port.port != null ? port.port.toString() : "-"} />
                      <span className={`truncate text-sm ${needsPortAssignment ? "font-medium text-amber-700" : "font-medium"}`}>
                        {port.type_label ?? "Unidentified"}
                      </span>
                    </div>
                    {showState && <EndpointStatus value={port.status} type="text" />}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {needsPortAssignment && (
                        <Badge variant="outline" className="shrink-0 border-amber-400 bg-amber-100 text-amber-700">
                          Not assigned
                        </Badge>
                      )}
                      {showState && <LastStatusChange date={port.lastStatusChange ?? undefined} variant="outline" />}
                    </div>
                    <PortActions
                      endpoint={endpoint}
                      port={port}
                      deviceId={deviceId}
                      isConfigured={isConfigured}
                      onAssignPort={setAssignPort}
                      onBrowse={setBrowsing}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="nodrag nopan flex justify-end border-t bg-slate-50/60 px-3 py-2">
        <EndpointPrimaryAction
          endpoint={endpoint}
          display={display}
          deviceId={deviceId}
          onOpenDetails={onOpenDetails}
          onAssign={() => setAssignEndpointOpen(true)}
        />
      </div>

      <EndpointDialogs
        endpoint={endpoint}
        deviceId={deviceId}
        onCreated={onCreated}
        assignEndpointOpen={assignEndpointOpen}
        setAssignEndpointOpen={setAssignEndpointOpen}
        assignPort={assignPort}
        setAssignPort={setAssignPort}
        browsing={browsing}
        setBrowsing={setBrowsing}
      />
    </div>
  );
}
