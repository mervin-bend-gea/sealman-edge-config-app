import { HelpCircle, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MappedEndpoint, MappedPort } from "@/generated/edge-administration/hooks/network/usePostNetworkOverview";
import { resolveBrowseTarget } from "@/lib/browserRegistry";
import { withPermissionRequiredTooltip } from "@/features/authorization/permissions/withPermissionRequiredTooltip";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import AssignEndpointDialog from "./AssignEndpointDialog";
import AssignServiceDialog from "./AssignServiceDialog";
import BrowseDialog from "./BrowseDialog";
import type { BrowseTarget, EndpointDisplay } from "./endpointLogic";
import { useShowConnectionState } from "./connectionStateContext";

/**
 * Building blocks shared by the list view (EndpointAccordionItem) and the canvas view (EndpointTile),
 * so both views offer exactly the same actions for an endpoint and its services.
 */

const GuardedButton = withPermissionRequiredTooltip(Button);

export function EndpointIdentity({ display, className }: { display: EndpointDisplay; className?: string }) {
  const { isUnidentified, needsAssignment, title, subtitle } = display;
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      {isUnidentified ? (
        <HelpCircle className="w-5 h-5 text-orange-500 shrink-0" />
      ) : (
        <Server className={`w-5 h-5 shrink-0 ${needsAssignment ? "text-amber-600" : "text-muted-foreground"}`} />
      )}
      <div className="text-left min-w-0">
        <div className="flex items-center gap-2">
          <p className={isUnidentified ? "font-medium text-orange-600" : needsAssignment ? "font-medium text-amber-700" : "font-medium"}>
            {title}
          </p>
          {needsAssignment && (
            <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-100">
              Not assigned
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

/** "Details" for an already-configured endpoint, "Assign" for everything else. */
export function EndpointPrimaryAction({
  endpoint,
  display,
  deviceId,
  onOpenDetails,
  onAssign,
}: {
  endpoint: MappedEndpoint;
  display: EndpointDisplay;
  deviceId: string;
  onOpenDetails: (endpointId: string) => void;
  onAssign: () => void;
}) {
  return display.isConfigured ? (
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onOpenDetails(endpoint.endpoint_id as string);
      }}
    >
      Details
    </Button>
  ) : (
    <GuardedButton
      deviceId={deviceId}
      permissionKey={PERMISSION_KEYS.DEVICE_ENDPOINT_WRITE}
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onAssign();
      }}
    >
      Assign
    </GuardedButton>
  );
}

/** Per-service "Assign" / "Browse" buttons. */
export function PortActions({
  endpoint,
  port,
  deviceId,
  isConfigured,
  onAssignPort,
  onBrowse,
}: {
  endpoint: MappedEndpoint;
  port: MappedPort;
  deviceId: string;
  isConfigured: boolean;
  onAssignPort: (port: MappedPort) => void;
  onBrowse: (target: BrowseTarget) => void;
}) {
  const target = resolveBrowseTarget(endpoint.ip, port.port);
  const kind = port.browser_kind;
  // Without connection states (network scan disabled) there's nothing to gate Browse on.
  const browseBlocked = useShowConnectionState() && port.status !== "online";
  return (
    <div className="flex items-center justify-end gap-2">
      {port.source !== "configured" && isConfigured && (
        <GuardedButton
          deviceId={deviceId}
          permissionKey={PERMISSION_KEYS.DEVICE_ENDPOINT_WRITE}
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onAssignPort(port);
          }}
        >
          Assign
        </GuardedButton>
      )}
      {kind && target && (
        <Button
          variant="outline"
          size="sm"
          disabled={browseBlocked}
          title={browseBlocked ? "Only available while the service is online" : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onBrowse({ kind, ...target });
          }}
        >
          Browse
        </Button>
      )}
    </div>
  );
}

/** The dialogs an endpoint (and its services) can open - identical for both views. */
export function EndpointDialogs({
  endpoint,
  deviceId,
  onCreated,
  assignEndpointOpen,
  setAssignEndpointOpen,
  assignPort,
  setAssignPort,
  browsing,
  setBrowsing,
}: {
  endpoint: MappedEndpoint;
  deviceId: string;
  onCreated: () => void;
  assignEndpointOpen: boolean;
  setAssignEndpointOpen: (open: boolean) => void;
  assignPort: MappedPort | null;
  setAssignPort: (port: MappedPort | null) => void;
  browsing: BrowseTarget | null;
  setBrowsing: (target: BrowseTarget | null) => void;
}) {
  return (
    <>
      <AssignEndpointDialog
        open={assignEndpointOpen}
        onOpenChange={setAssignEndpointOpen}
        deviceId={deviceId}
        ip={endpoint.ip ?? undefined}
        defaultTypeId={endpoint.source === "default" ? endpoint.type_id : null}
        onCreated={onCreated}
      />

      {endpoint.endpoint_id && assignPort && (
        <AssignServiceDialog
          open={assignPort !== null}
          onOpenChange={(open) => !open && setAssignPort(null)}
          endpointId={endpoint.endpoint_id}
          port={assignPort.port ?? undefined}
          defaultTypeId={assignPort.source === "default" ? assignPort.type_id : null}
          onCreated={onCreated}
        />
      )}

      {browsing && (
        <BrowseDialog
          open
          onOpenChange={(open) => !open && setBrowsing(null)}
          kind={browsing.kind}
          ip={browsing.ip}
          port={browsing.port}
        />
      )}
    </>
  );
}
