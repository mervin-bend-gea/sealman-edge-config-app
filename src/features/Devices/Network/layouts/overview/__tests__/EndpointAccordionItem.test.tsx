import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Accordion } from "@/components/ui/accordion";
import type { MappedEndpoint } from "@/generated/edge-administration/hooks/network/usePostNetworkOverview";
import EndpointAccordionItem from "../EndpointAccordionItem";
import { endpointListKey } from "../overviewMerge";
import { ShowConnectionStateContext } from "../connectionStateContext";

const { typesRef } = vi.hoisted(() => ({ typesRef: { current: [] as unknown[] } }));

vi.mock("@/generated/edge-administration/hooks/endpoint_types/useGetEndpointTypes", () => ({
  default: () => ({ data: typesRef.current }),
}));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({
  usePermissions: () => ({ hasPermission: true }),
}));
vi.mock("../AssignEndpointDialog", () => ({ default: () => null }));
vi.mock("../AssignServiceDialog", () => ({ default: () => null }));
vi.mock("../BrowseDialog", () => ({ default: () => null }));

const STRING = { type: "string", ui: "input", required: false, changeable: true, show_in_list: true, default: null } as const;

function renderItem(endpoint: MappedEndpoint) {
  return render(
    <Accordion type="single" defaultValue={endpointListKey(endpoint)}>
      <EndpointAccordionItem endpoint={endpoint} deviceId="dev-1" onCreated={() => {}} onOpenDetails={() => {}} onOpenServiceDetails={() => {}} />
    </Accordion>
  );
}

describe("EndpointAccordionItem", () => {
  beforeEach(() => {
    typesRef.current = [
      { type_id: "plc", label: "PLC", description: null, fields: {}, mapping: { title: "name", addr: "ip" } },
      { type_id: "sensor", label: "Sensor", description: null, fields: {}, mapping: {} },
    ];
  });

  it("uses the name-role value as title", () => {
    renderItem({
      endpoint_id: "e1", type_id: "plc", type_label: "PLC", ip: "10.0.0.1", status: "online", source: "configured", ports: [],
      endpoint_data: {
        title: { value: "Press 1", field: { ...STRING, label: "Title" } },
        addr: { value: "10.0.0.1", field: { ...STRING, label: "Address" } },
      },
    });
    expect(screen.getByText("Press 1")).toBeInTheDocument();
  });

  it("shows a field called ip without the ip role as extra info", () => {
    renderItem({
      endpoint_id: "e2", type_id: "sensor", type_label: "Sensor", status: "unknown", source: "configured", ports: [],
      endpoint_data: { ip: { value: "192.168.9.9", field: { ...STRING, label: "Old IP" } } },
    });
    expect(screen.getByText(/192\.168\.9\.9/)).toBeInTheDocument();
  });

  it("has no leading separator in the subtitle of an IP-less endpoint with extra info", () => {
    renderItem({
      endpoint_id: "e8", type_id: "sensor", type_label: "Sensor", status: "unknown", source: "configured", ports: [],
      endpoint_data: { foo: { value: "bar", field: { ...STRING, label: "Foo" } } },
    });
    expect(screen.getByText(/bar/).textContent).toBe("bar");
  });

  it("hides role fields from the extra info", () => {
    renderItem({
      endpoint_id: "e3", type_id: "plc", type_label: "PLC", ip: "10.0.0.3", status: "online", source: "configured", ports: [],
      endpoint_data: { title: { value: "Press 3", field: { ...STRING, label: "Title" } }, addr: { value: "10.0.0.3", field: { ...STRING, label: "Address" } } },
    });
    expect(screen.queryByText(/Press 3 ·/)).not.toBeInTheDocument();
  });

  it("lists an endpoint without IP with the type label as title and unknown services", () => {
    renderItem({
      endpoint_id: "e4", type_id: "sensor", type_label: "Sensor", status: "unknown", source: "configured",
      endpoint_data: {},
      ports: [{ status: "unknown", source: "configured", service_id: "s1", type_label: "Modbus" }],
    });
    expect(screen.getByText("Sensor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("Modbus")).toBeInTheDocument();
  });

  it("shows Browse for a service with a browser, an ip and a port", () => {
    renderItem({
      endpoint_id: "e5", type_id: "sensor", type_label: "Sensor", ip: "10.0.0.5", status: "online", source: "configured", endpoint_data: {},
      ports: [{ port: 4840, status: "online", source: "configured", service_id: "s5", type_label: "OPC UA", browser_kind: "opcua" }],
    });
    expect(screen.getByRole("button", { name: "Browse" })).toBeInTheDocument();
  });

  it("shows no Browse without an ip", () => {
    renderItem({
      endpoint_id: "e6", type_id: "sensor", type_label: "Sensor", status: "unknown", source: "configured", endpoint_data: {},
      ports: [{ port: 4840, status: "unknown", source: "configured", service_id: "s6", type_label: "OPC UA", browser_kind: "opcua" }],
    });
    expect(screen.queryByRole("button", { name: "Browse" })).not.toBeInTheDocument();
  });

  it("shows no Browse without a port", () => {
    renderItem({
      endpoint_id: "e7", type_id: "sensor", type_label: "Sensor", ip: "10.0.0.7", status: "online", source: "configured", endpoint_data: {},
      ports: [{ status: "unknown", source: "configured", service_id: "s7", type_label: "OPC UA", browser_kind: "opcua" }],
    });
    expect(screen.queryByRole("button", { name: "Browse" })).not.toBeInTheDocument();
  });

  it("shows no connection states and keeps Browse usable while the network scan is disabled", () => {
    render(
      <ShowConnectionStateContext.Provider value={false}>
        <Accordion type="single" defaultValue="id:e9">
          <EndpointAccordionItem
            endpoint={{
              endpoint_id: "e9", type_id: "sensor", type_label: "Sensor", ip: "10.0.0.9", status: "offline", source: "configured", endpoint_data: {},
              ports: [{ port: 4840, status: "offline", source: "configured", service_id: "s9", type_label: "OPC UA", browser_kind: "opcua" }],
            }}
            deviceId="dev-1" onCreated={() => {}} onOpenDetails={() => {}} onOpenServiceDetails={() => {}}
          />
        </Accordion>
      </ShowConnectionStateContext.Provider>
    );
    expect(screen.getByText("OPC UA")).toBeInTheDocument();
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Last status change")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse" })).toBeEnabled();
  });
});
