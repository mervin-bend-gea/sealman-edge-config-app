import { useEffect, useRef, useState } from "react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EndpointStatus, Port, LastStatusChange } from "@/features/Devices/Network/components";
import { MappedEndpoint, MappedPort } from "@/generated/edge-administration/hooks/network/usePostNetworkOverview";
import { EndpointDialogs, EndpointIdentity, EndpointPrimaryAction, PortActions, } from "./endpointShared";
import { BrowseTarget, portNeedsAssignment, useEndpointDisplay } from "./endpointLogic";
import { endpointListKey, portListKey } from "./overviewMerge";

interface props {
  endpoint: MappedEndpoint;
  deviceId: string;
  onCreated: () => void;
  onOpenDetails: (endpointId: string) => void;
  onOpenServiceDetails: (serviceId: string) => void;
  highlighted?: boolean;
  onHighlightDone?: () => void;
}

const HIGHLIGHT_DURATION_MS = 4000;

export default function EndpointAccordionItem({ endpoint, deviceId, onCreated, onOpenDetails, onOpenServiceDetails, highlighted = false, onHighlightDone }: props) {
  const display = useEndpointDisplay(endpoint);
  const { needsAssignment, isConfigured } = display;
  const [assignEndpointOpen, setAssignEndpointOpen] = useState(false);
  const [assignPort, setAssignPort] = useState<MappedPort | null>(null);
  const [browsing, setBrowsing] = useState<BrowseTarget | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const onHighlightDoneRef = useRef(onHighlightDone);
  useEffect(() => {
    onHighlightDoneRef.current = onHighlightDone;
  }, [onHighlightDone]);

  // Scroll to the row and flash it for a few seconds, once.
  useEffect(() => {
    if (!highlighted) return;
    rowRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    const timer = setTimeout(() => onHighlightDoneRef.current?.(), HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  return (
    <AccordionItem value={endpointListKey(endpoint)} className="last:border-b-0">
      <div
        ref={rowRef}
        data-highlighted={highlighted || undefined}
        className={`flex items-center pr-4 ${needsAssignment ? "bg-amber-50" : ""} ${highlighted ? "animate-search-highlight" : ""}`}
      >
        <div className="flex-1">
          <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/40">
            <div className="flex items-center justify-between w-full gap-4">
              <EndpointIdentity display={display} />
              <div className="flex items-center gap-3 shrink-0">
                <EndpointStatus value={endpoint.status} type="icon" />
              </div>
            </div>
          </AccordionTrigger>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <EndpointPrimaryAction
            endpoint={endpoint}
            display={display}
            deviceId={deviceId}
            onOpenDetails={onOpenDetails}
            onAssign={() => setAssignEndpointOpen(true)}
          />
        </div>
      </div>
      <AccordionContent className="px-4">
        {endpoint.ports.length === 0 ? (
          <p className="text-xs text-muted-foreground">No services detected on this endpoint.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[100px]">Port</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Last status change</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoint.ports.map((port) => {
                const needsPortAssignment = portNeedsAssignment(port);
                // Only an already-assigned service has a detail page to jump to - clicking an
                // unassigned/unidentified port's row wouldn't have anywhere to go.
                const serviceId = port.service_id;
                return (
                <TableRow
                  key={portListKey(port)}
                  className={[needsPortAssignment ? "bg-amber-50" : "", serviceId ? "cursor-pointer hover:bg-muted/40" : ""].join(" ")}
                  onClick={serviceId ? () => onOpenServiceDetails(serviceId) : undefined}
                >
                  <TableCell>
                    <EndpointStatus value={port.status} type="text" />
                  </TableCell>
                  <TableCell>
                    <Port value={port.port != null ? port.port.toString() : "-"} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={needsPortAssignment ? "text-amber-700 font-medium" : ""}>
                        {port.type_label ?? "Unidentified"}
                      </span>
                      {needsPortAssignment && (
                        <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-100">
                          Not assigned
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <LastStatusChange date={port.lastStatusChange ?? undefined} variant="outline" />
                  </TableCell>
                  <TableCell className="text-right">
                    <PortActions
                      endpoint={endpoint}
                      port={port}
                      deviceId={deviceId}
                      isConfigured={isConfigured}
                      onAssignPort={setAssignPort}
                      onBrowse={setBrowsing}
                    />
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </AccordionContent>

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
    </AccordionItem>
  );
}
