import type { ReactNode } from "react";
import { Accordion } from "@/components/ui/accordion";
import EndpointAccordionItem from "./EndpointAccordionItem";
import EndpointActions from "./EndpointActions";
import { MappedEndpoint } from "@/generated/edge-administration/hooks/network/usePostNetworkOverview";
import { endpointListKey } from "./overviewMerge";

interface props {
  endpoints: MappedEndpoint[];
  deviceId: string;
  onScan: () => void;
  isScanning: boolean;
  onAddEndpoint: () => void;
  onEndpointCreated: () => void;
  onOpenDetails: (endpointId: string) => void;
  onOpenServiceDetails: (serviceId: string) => void;
  viewToggle?: ReactNode;
  // The endpoint to scroll to and flash (e.g. when arriving from the device search).
  highlightedEndpointId?: string | null;
  onHighlightDone?: () => void;
}

export default function DiscoveredEndpointsCard({
  endpoints,
  deviceId,
  onScan,
  isScanning,
  onAddEndpoint,
  onEndpointCreated,
  onOpenDetails,
  onOpenServiceDetails,
  viewToggle,
  highlightedEndpointId,
  onHighlightDone,
}: props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Assets</h2>
          <p className="text-sm text-muted-foreground">
            Physical machines and systems discovered on the network. Expand each endpoint to view its services.
          </p>
        </div>
        <EndpointActions onScan={onScan} isScanning={isScanning} onAddEndpoint={onAddEndpoint} leading={viewToggle} />
      </div>

      <div className="border rounded-lg overflow-hidden bg-background">
        {endpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">No endpoints discovered yet.</p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {endpoints.map((endpoint) => (
              <EndpointAccordionItem
                key={endpointListKey(endpoint)}
                endpoint={endpoint}
                deviceId={deviceId}
                onCreated={onEndpointCreated}
                onOpenDetails={onOpenDetails}
                onOpenServiceDetails={onOpenServiceDetails}
                highlighted={endpoint.endpoint_id != null && endpoint.endpoint_id === highlightedEndpointId}
                onHighlightDone={onHighlightDone}
              />
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}
