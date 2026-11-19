import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModuleConfigTab from "./ModuleConfigTab";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApiInstance: http }));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({ usePermissions: () => ({ hasPermission: true }) }));
vi.mock("@/components/Input/JsonEditor", () => ({ default: () => null }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TEMPLATE = {
  id: 7, kind: "template", name: "cell", group_id: 1, group_name: "Plant", module_names: ["seal-demo"], scopes: [],
  archived: false, latest_version: 1, created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z",
};
const BLOCK = { ...TEMPLATE, id: 1, kind: "block", name: "ClientSeparator" };
const VERSION = {
  template_id: 7, version: 1, created_at: "2026-11-09T10:00:00Z", body: { clients: { $list: [1] } }, variables: [],
  references: { variables: [], device: [] },
  inputs: {
    variables: [], endpoints: [], device: [], copies: [],
    lists: [{
      key: "clients", label: "Clients", path: "/clients",
      blocks: [{
        block_id: 1, name: "ClientSeparator",
        inputs: {
          variables: [{ key: "machine_name", name: "machine_name", type: "string", required: true }],
          endpoints: [{ key: "machine", slot: "machine", copy: null, fields: ["ip"], service_fields: ["port"] }], device: [], copies: [],
        },
      }],
    }],
  },
};

describe("ListEntries", () => {
  let client: QueryClient;
  const renderTab = (state?: unknown) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[{ pathname: "/devices/dev-1", state }]}>
          <ModuleConfigTab deviceId="dev-1" moduleName="m" moduleStatus="running" onOpenHistory={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  const applyButton = () => screen.getByRole("button", { name: /Apply to/ });

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    http.get.mockReset().mockImplementation(async (url: string) => {
      if (url === "/dev-1/modules/m/config/templates") return { data: [TEMPLATE] };
      if (url === "/module-config-templates") return { data: [BLOCK] };
      if (url.startsWith("/module-config-templates/7/versions")) return { data: url.endsWith("/versions") ? [VERSION] : VERSION };
      if (url.endsWith("/config/revisions")) return { data: { revisions: [] } };
      if (url === "/dev-1/config/endpoints") return { data: [{ endpoint_id: "e1", type_id: "t", type_label: "PLC", name: "plc-1", fields: {} }] };
      if (url === "/dev-1/config/endpoints/e1/services") {
        return { data: [{ service_id: "s1", type_id: "opcua", type_label: "OPC UA", name: "opc", port: 4840, fields: {} }] };
      }
      throw new Error(`unexpected GET ${url}`);
    });
    http.post.mockReset().mockImplementation(async (url: string) => {
      if (url.endsWith("/config/render")) return { data: { ok: true, config: {}, findings: [] } };
      if (url.endsWith("/config/apply")) return { data: { configId: "c3", revision: { id: 3 }, findings: [] } };
      throw new Error(`unexpected POST ${url}`);
    });
  });
  afterEach(() => client.clear());

  const addCard = async (name: string) => {
    fireEvent.click(await screen.findByRole("button", { name: "+ Add client" }));
    const cards = screen.getAllByRole("group", { name: /^client \d+$/ });
    const card = cards[cards.length - 1];
    fireEvent.change(within(card).getByLabelText("Name"), { target: { value: name } });
    fireEvent.click(within(card).getByRole("combobox", { name: "Type" }));
    fireEvent.click(await screen.findByText("ClientSeparator", { selector: "span.block" }));
    return card;
  };

  it("renaming a card keeps its values", async () => {
    renderTab();
    const card = await addCard("sep1");
    fireEvent.change(await within(card).findByLabelText("machine_name *"), { target: { value: "A" } });
    fireEvent.click(await within(card).findByRole("combobox", { name: "Endpoint: machine" }));
    fireEvent.click(await screen.findByText("plc-1", { selector: "span.block" }));
    fireEvent.click(within(card).getByRole("combobox", { name: "Service: machine" }));
    fireEvent.click(await screen.findByText("opc (4840)", { selector: "span.block" }));
    fireEvent.change(within(card).getByLabelText("Name"), { target: { value: "sepA" } });
    await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 2000 });
    fireEvent.click(applyButton());
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/dev-1/modules/m/config/apply", {
      template_id: 7, values: { "clients/sepA/machine_name": "A" }, lists: { clients: [{ name: "sepA", block_id: 1 }] },
      endpoints: { "clients/sepA/machine": "e1" }, services: { "clients/sepA/machine": "s1" },
    }));
  });

  it("list section uses item_label", async () => {
    const labelled = { ...VERSION, inputs: { ...VERSION.inputs, lists: [{ ...VERSION.inputs.lists[0], item_label: "Slave" }] } };
    http.get.mockImplementation(async (url: string) => {
      if (url === "/dev-1/modules/m/config/templates") return { data: [TEMPLATE] };
      if (url === "/module-config-templates") return { data: [BLOCK] };
      if (url.startsWith("/module-config-templates/7/versions")) return { data: url.endsWith("/versions") ? [labelled] : labelled };
      if (url.endsWith("/config/revisions")) return { data: { revisions: [] } };
      throw new Error(`unexpected GET ${url}`);
    });
    renderTab();
    expect(await screen.findByRole("heading", { name: "Slaves" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add slave" })).toBeInTheDocument();
  });

  it("duplicate names block apply", async () => {
    renderTab();
    await addCard("x");
    await addCard("x");
    expect(screen.getAllByText("Name already used")).toHaveLength(2);
    await waitFor(() => expect(screen.getByText("valid")).toBeInTheDocument(), { timeout: 2000 });
    expect(applyButton()).toBeDisabled();
  });

  it("a stored entry whose block is no longer allowed is kept and flagged", async () => {
    renderTab({ prefill: { templateId: 7, values: {
      "clients/old/x": "1",
      $lists: { clients: [{ name: "old", block_id: 99 }], servers: [{ name: "srv1", block_id: 5 }, { name: "srv2", block_id: 5 }] },
    } } });
    const card = await screen.findByRole("group", { name: "client 1" });
    expect(within(card).getByLabelText("Name")).toHaveValue("old");
    expect(within(card).getByText("This client type is no longer offered: choose another or remove it")).toBeInTheDocument();
    expect(screen.getByText("This template no longer has the list 'servers': entries srv1, srv2 will not be applied.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("valid")).toBeInTheDocument(), { timeout: 2000 });
    expect(applyButton()).toBeDisabled();
    const sent = http.post.mock.calls.find(([url]) => url.endsWith("/config/render"))![1];
    expect(Object.keys(sent.values).some((k) => k.startsWith("$"))).toBe(false);

    fireEvent.click(within(card).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 2000 });
  });
});
