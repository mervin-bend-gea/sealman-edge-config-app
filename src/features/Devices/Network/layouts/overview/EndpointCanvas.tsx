import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MiniMap,
  NodeChange,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MappedEndpoint } from "@/generated/edge-administration/hooks/network/usePostNetworkOverview";
import { endpointListKey } from "./overviewMerge";
import EndpointTile, { EndpointNode, EndpointNodeData } from "./EndpointTile";
import GatewayTile, { GatewayNode } from "./GatewayTile";
import { useShowConnectionState } from "./connectionStateContext";
import {
  GATEWAY_EDGE_SPACE,
  GATEWAY_ESTIMATED_HEIGHT,
  GATEWAY_ID,
  Position,
  clearSavedLayout,
  defaultGatewayPosition,
  estimateTileHeight,
  layoutTiles,
  loadSavedLayout,
  saveLayout,
} from "./canvasLayout";

const nodeTypes = { endpoint: EndpointTile, gateway: GatewayTile };

type AssetNode = EndpointNode | GatewayNode;

const EDGE_COLORS: Record<MappedEndpoint["status"], string> = {
  online: "#22c55e",
  offline: "#f87171",
  unknown: "#fb923c",
};

const NEUTRAL_COLOR = "#94a3b8";

const noop = () => {};

interface props {
  endpoints: MappedEndpoint[];
  deviceId: string;
  onEndpointCreated: () => void;
  onOpenDetails: (endpointId: string) => void;
  onOpenServiceDetails: (serviceId: string) => void;
}

interface Size {
  width: number;
  height: number;
}

function miniMapColor(node: { id?: string; data?: Record<string, unknown> }, showState: boolean): string {
  if (node.id === GATEWAY_ID) return "#2563eb";
  if (!showState) return NEUTRAL_COLOR;
  const status = (node.data?.endpoint as MappedEndpoint | undefined)?.status;
  return status === "online" ? "#22c55e" : status === "offline" ? "#f87171" : "#fb923c";
}

function CanvasInner({ endpoints, deviceId, onEndpointCreated, onOpenDetails, onOpenServiceDetails }: props) {
  const { fitView } = useReactFlow();
  const showState = useShowConnectionState();

  // Only tiles the user has dragged have a stored position (and survive a reload); every other tile is
  // placed automatically, so a tile that grows (more services) pushes the auto-placed tiles below it down.
  const [positions, setPositions] = useState<Record<string, Position>>(() => loadSavedLayout(deviceId));
  // React Flow reports each tile's rendered size; a controlled flow has to feed it back or tiles stay hidden.
  const [sizes, setSizes] = useState<Record<string, Size>>({});

  const nodes = useMemo<AssetNode[]>(() => {
    const gatewayHeight = sizes[GATEWAY_ID]?.height ?? GATEWAY_ESTIMATED_HEIGHT;
    const tiles = endpoints.map((e) => {
      const id = endpointListKey(e);
      return { id, height: sizes[id]?.height ?? estimateTileHeight(e) };
    });
    // New tiles start below the gateway, leaving room for the edges that connect them to it.
    const layout = layoutTiles(tiles, positions, undefined, gatewayHeight + GATEWAY_EDGE_SPACE);

    const gateway: GatewayNode = {
      id: GATEWAY_ID,
      type: "gateway",
      position: positions[GATEWAY_ID] ?? defaultGatewayPosition(),
      dragHandle: ".gateway-drag-handle",
      data: { deviceId },
      measured: sizes[GATEWAY_ID],
    };

    const endpointNodes = endpoints.map((endpoint): EndpointNode => {
      const id = endpointListKey(endpoint);
      // Unidentified endpoints behave exactly as in the list view, where they have no detail pages.
      const unidentified = endpoint.source === "unidentified";
      const data: EndpointNodeData = {
        endpoint,
        deviceId,
        onCreated: onEndpointCreated,
        onOpenDetails: unidentified ? noop : onOpenDetails,
        onOpenServiceDetails: unidentified ? noop : onOpenServiceDetails,
      };
      return {
        id,
        type: "endpoint" as const,
        position: layout[id],
        data,
        measured: sizes[id],
      };
    });

    return [gateway, ...endpointNodes];
  }, [endpoints, positions, sizes, deviceId, onEndpointCreated, onOpenDetails, onOpenServiceDetails]);

  const edges = useMemo<Edge[]>(
    () =>
      endpoints.map((endpoint) => {
        const id = endpointListKey(endpoint);
        return {
          id: `gateway-${id}`,
          source: GATEWAY_ID,
          target: id,
          type: "smoothstep",
          selectable: false,
          style: { stroke: showState ? EDGE_COLORS[endpoint.status] : NEUTRAL_COLOR, strokeWidth: 2 },
        };
      }),
    [endpoints, showState],
  );

  const onNodesChange = useCallback((changes: NodeChange<AssetNode>[]) => {
    for (const change of changes) {
      if (change.type === "dimensions" && change.dimensions) {
        const { width, height } = change.dimensions;
        setSizes((previous) => {
          const current = previous[change.id];
          return current && current.width === width && current.height === height
            ? previous
            : { ...previous, [change.id]: { width, height } };
        });
      } else if (change.type === "position" && change.position) {
        const { x, y } = change.position;
        setPositions((previous) => ({ ...previous, [change.id]: { x, y } }));
      }
    }
  }, []);

  // The dragged nodes carry the final position, which the state above may not have caught up with yet.
  const persistLayout = useCallback(
    (_event: unknown, _node: unknown, dragged: AssetNode[]) => {
      const next = { ...positions };
      for (const n of dragged) next[n.id] = { x: n.position.x, y: n.position.y };
      saveLayout(deviceId, next);
    },
    [positions, deviceId],
  );

  const resetLayout = () => {
    clearSavedLayout(deviceId);
    setPositions({});
    window.requestAnimationFrame(() => fitView({ padding: 0.1, maxZoom: 1, duration: 300 }));
  };

  return (
    <div className="h-[calc(100vh-24rem)] min-h-[520px] overflow-hidden rounded-lg border bg-slate-50">
      <ReactFlow
        id="assets-canvas"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={persistLayout}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        preventScrolling={false}
        minZoom={0.2}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#cbd5e1" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(node) => miniMapColor(node, showState)} className="hidden lg:block" />
        <Panel position="top-right">
          <Button variant="outline" size="sm" onClick={resetLayout} className="bg-background">
            <LayoutGrid /> Reset layout
          </Button>
        </Panel>
        {endpoints.length === 0 && (
          <Panel position="bottom-center">
            <p className="mb-4 rounded-md border bg-background px-4 py-2 text-sm text-muted-foreground">
              No endpoints discovered yet.
            </p>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

/** Free-form canvas: every endpoint is a draggable tile that grows with the number of services it runs. */
export default function EndpointCanvas(props: props) {
  return (
    <ReactFlowProvider>
      <CanvasInner key={props.deviceId} {...props} />
    </ReactFlowProvider>
  );
}
