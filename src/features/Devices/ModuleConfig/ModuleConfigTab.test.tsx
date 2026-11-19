import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModuleConfigTab from "./ModuleConfigTab";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApiInstance: http }));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({ usePermissions: () => ({ hasPermission: true }) }));
vi.mock("@/components/Input/JsonEditor", () => ({
  default: ({ label, value }: { label?: string; value: string }) => <pre data-testid={`editor-${label}`}>{value}</pre>,
}));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TEMPLATE = {
  id: 7, name: "discover-basic", description: "Basic discovery", group_id: 1, group_name: "Business Unit XYZ - Demo", module_names: ["seal-demo"],
  scopes: [{ id: "s1", name: "Aachen devices" }], archived: false, latest_version: 2,
  created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z",
};
const OTHER_TEMPLATE = { ...TEMPLATE, id: 8, name: "discover-fast", description: "Fast scans", latest_version: 1 };
const OTHER_GROUP_TEMPLATE = { ...TEMPLATE, id: 9, name: "commissioning", description: undefined, group_id: 2, group_name: "Commissioning", scopes: [], latest_version: 1 };
const VERSION = (id: number) => ({
  template_id: id, version: 2, created_at: "2026-11-09T10:00:00Z",
  body: { interval: "${interval}", site: "${device.site}" },
  variables: [{ name: "interval", type: "integer", required: true, label: "Interval" }],
  references: { variables: ["interval"], device: ["site"] },
});
const REVISIONS = {
  current_config_id: "c2",
  revisions: [
    { id: 2, device_id: "dev-1", module_name: "seal-demo-x", config_id: "c2", blob_name: "c2", source: "template", actor: "bob", parent_revision_id: 1,
      template_id: 7, template_name: "discover-basic", comment: "faster scans",
      created_at: "2026-11-09T11:00:00Z", current: true },
    { id: 1, device_id: "dev-1", module_name: "seal-demo-x", config_id: "c1", blob_name: "c1", source: "raw", actor: "alice",
      created_at: "2026-11-09T10:30:00Z", current: false },
  ],
};

function routeGet(templates: unknown[], revisions: unknown = REVISIONS) {
  http.get.mockImplementation(async (url: string) => {
    if (url === "/dev-1/modules/seal-demo-x/config/templates") return { data: templates };
    const versions = /^\/module-config-templates\/(\d+)\/versions(\/.*)?$/.exec(url);
    if (versions) return { data: versions[2] ? VERSION(Number(versions[1])) : [VERSION(Number(versions[1]))] };
    if (url.endsWith("/config/revisions")) return { data: revisions };
    throw new Error(`unexpected GET ${url}`);
  });
}

const MACHINE = { key: "machine", slot: "machine", copy: null, fields: ["ip"], service_fields: ["port"] };
const SERVICE_INPUTS = {
  variables: [] as unknown[], endpoints: [MACHINE], device: [], copies: [],
  lists: [{
    key: "clients", label: "Clients", path: "/clients",
    blocks: [{ block_id: 1, name: "ClientSeparator", inputs: { variables: [], endpoints: [MACHINE], device: [], copies: [] } }],
  }],
};
const SERVICES: Record<string, unknown[]> = {
  e1: [{ service_id: "s1", type_id: "opcua", type_label: "OPC UA", name: "opc-a", port: 4840, fields: {} }],
  e2: [{ service_id: "s2", type_id: "opcua", type_label: "OPC UA", name: "opc-b", port: 4841, fields: {} }],
};

/** A template whose version has `inputs` (endpoint slots with services, lists), and the device's endpoints and services. */
function routeServices(templates: unknown[], inputs: unknown) {
  http.get.mockImplementation(async (url: string) => {
    if (url === "/dev-1/modules/seal-demo-x/config/templates") return { data: templates };
    const versions = /^\/module-config-templates\/(\d+)\/versions(\/.*)?$/.exec(url);
    if (versions) {
      const version = { ...VERSION(Number(versions[1])), variables: [], references: { variables: [], device: [] }, inputs };
      return { data: versions[2] ? version : [version] };
    }
    if (url === "/module-config-templates") return { data: [] };
    if (url.endsWith("/config/endpoints")) {
      return { data: [
        { endpoint_id: "e1", type_id: "t", type_label: "PLC", name: "plc-1", fields: {} },
        { endpoint_id: "e2", type_id: "t", type_label: "PLC", name: "plc-2", fields: {} },
      ] };
    }
    const services = /\/config\/endpoints\/(\w+)\/services$/.exec(url);
    if (services) return { data: SERVICES[services[1]] };
    if (url.endsWith("/config/revisions")) return { data: { revisions: [] } };
    throw new Error(`unexpected GET ${url}`);
  });
}

describe("ModuleConfigTab", () => {
  let client: QueryClient;
  const onOpenHistory = vi.fn();
  const renderTab = (state?: unknown) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[{ pathname: "/devices/dev-1", state }]}>
          <ModuleConfigTab deviceId="dev-1" moduleName="seal-demo-x" moduleStatus="running" onOpenHistory={onOpenHistory} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    onOpenHistory.mockReset();
    http.get.mockReset();
    http.post.mockReset().mockImplementation(async (url: string, body: { values?: { interval?: string } }) => {
      if (url.endsWith("/config/render")) {
        const ok = !!body.values?.interval;
        return {
          data: ok
            ? { ok, config: { interval: Number(body.values!.interval), site: "Aachen" }, findings: [] }
            : { ok, config: { site: "Aachen" }, findings: [{ path: "/values/interval", level: "error", code: "missing-variable", message: "'Interval' is required" }] },
        };
      }
      if (url.endsWith("/config/apply")) return { data: { configId: "c3", revision: { id: 3 }, findings: [] } };
      throw new Error(`unexpected POST ${url}`);
    });
  });
  afterEach(() => client.clear());

  it("says so, and points to the template library and the raw tab, when no template applies to the module", async () => {
    routeGet([]);
    renderTab();
    expect(await screen.findByText(/No template is available for/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Module Templates" })).toHaveAttribute("href", "/module-templates");
    expect(screen.queryByRole("region", { name: "Apply a template" })?.querySelector("#cfg-group")).toBeNull();
  });

  it("shows what is applied now in a compact box and opens the history from it", async () => {
    routeGet([TEMPLATE]);
    renderTab();
    const current = await screen.findByRole("region", { name: "Current configuration" });
    expect(await within(current).findByText("discover-basic")).toBeInTheDocument();
    expect(within(current).getByText("template")).toBeInTheDocument();
    expect(within(current).getByText("by bob")).toBeInTheDocument();
    expect(within(current).getByText(/faster scans/)).toBeInTheDocument();
    fireEvent.click(within(current).getByRole("button", { name: /History/ }));
    expect(onOpenHistory).toHaveBeenCalled();
  });

  it("preselects the only template group and template, previews the result and applies it", async () => {
    routeGet([TEMPLATE]);
    renderTab();
    const input = await screen.findByLabelText("Interval *");
    expect(screen.getByRole("combobox", { name: "Template Group" })).toHaveTextContent("Business Unit XYZ - Demo");
    expect(screen.getByRole("combobox", { name: "Template" })).toHaveTextContent("discover-basic");
    expect(screen.getByText("seal-demo")).toBeInTheDocument();
    expect(screen.getByText("Aachen devices")).toBeInTheDocument();
    expect(await screen.findByText("'Interval' is required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply to/ })).toBeDisabled();

    fireEvent.change(input, { target: { value: "45" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /Apply to/ })).toBeEnabled(), { timeout: 2000 });
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "faster" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply to/ }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith(
      "/dev-1/modules/seal-demo-x/config/apply",
      { template_id: 7, values: { interval: "45" }, comment: "faster" },
    ));
  });

  it("shows the resulting configuration in a dialog", async () => {
    routeGet([TEMPLATE]);
    renderTab();
    fireEvent.change(await screen.findByLabelText("Interval *"), { target: { value: "45" } });
    const show = screen.getByRole("button", { name: /Show resulting configuration/ });
    await waitFor(() => expect(show).toBeEnabled());
    await waitFor(() => expect(screen.getByText("valid")).toBeInTheDocument(), { timeout: 2000 });
    fireEvent.click(show);
    const dialog = await screen.findByRole("dialog", { name: "Resulting configuration" });
    await waitFor(() => expect(within(dialog).getByTestId("editor-Resulting configuration")).toHaveTextContent('"interval": 45'), { timeout: 2000 });
  });

  it("picks the template in two searchable steps: template group first, then one of its templates", async () => {
    routeGet([TEMPLATE, OTHER_TEMPLATE, OTHER_GROUP_TEMPLATE]);
    renderTab();
    const template = await screen.findByRole("combobox", { name: "Template" });
    expect(screen.getByRole("combobox", { name: "Template Group" })).toHaveTextContent("Select a template group");
    expect(template).toBeDisabled();
    expect(screen.queryByText("Inputs")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Template Group" }));
    fireEvent.change(await screen.findByPlaceholderText("Search template groups"), { target: { value: "commis" } });
    let list = await screen.findByRole("listbox");
    expect(within(list).queryByText("Business Unit XYZ - Demo")).not.toBeInTheDocument();
    fireEvent.click(within(list).getByText("Commissioning"));
    // a template group with a single template selects it
    expect(await screen.findByLabelText("Interval *")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Template" })).toHaveTextContent("commissioning");

    fireEvent.click(screen.getByRole("combobox", { name: "Template Group" }));
    fireEvent.click(await screen.findByText("Business Unit XYZ - Demo", { selector: "span.block" }));
    // two templates in this template group: none preselected, the search finds by name and description
    expect(screen.getByRole("combobox", { name: "Template" })).toHaveTextContent("Select a template");
    expect(screen.queryByLabelText("Interval *")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Template" }));
    fireEvent.change(await screen.findByPlaceholderText("Search templates"), { target: { value: "fast" } });
    list = await screen.findByRole("listbox");
    expect(within(list).queryByText("discover-basic")).not.toBeInTheDocument();
    fireEvent.click(within(list).getByText("discover-fast"));
    expect(await screen.findByLabelText("Interval *")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Template" })).toHaveTextContent("discover-fast");
  });

  it("starts from the values of a revision when the history asks to edit them", async () => {
    routeServices([TEMPLATE, OTHER_TEMPLATE], { ...SERVICE_INPUTS, variables: [{ key: "interval", name: "interval", type: "integer", required: true, label: "Interval" }] });
    renderTab({ prefill: { templateId: 7, values: {
      interval: "30",
      $endpoints: { machine: "e1", "clients/sep1/machine": "e2" },
      $services: { machine: "s1", "clients/sep1/machine": "s2" },
      $lists: { clients: [{ name: "sep1", block_id: 1 }] },
    } } });
    const input = await screen.findByLabelText("Interval *");
    expect(input).toHaveValue("30");
    expect(screen.getByRole("combobox", { name: "Template Group" })).toHaveTextContent("Business Unit XYZ - Demo");
    expect(screen.getByRole("combobox", { name: "Template" })).toHaveTextContent("discover-basic");
    // the top-level slot comes first, then the card's
    await waitFor(() => expect(screen.getAllByRole("combobox", { name: "Service: machine" })[0]).toHaveTextContent("opc-a"));
    const card = screen.getByRole("group", { name: "client 1" });
    await waitFor(() => expect(within(card).getByRole("combobox", { name: "Service: machine" })).toHaveTextContent("opc-b"));
  });

  it("service dropdown follows the endpoint", async () => {
    routeServices([TEMPLATE], SERVICE_INPUTS);
    http.post.mockImplementation(async (url: string) => {
      if (url.endsWith("/config/render")) return { data: { ok: true, config: {}, findings: [] } };
      if (url.endsWith("/config/apply")) return { data: { configId: "c3", revision: { id: 3 }, findings: [] } };
      throw new Error(`unexpected POST ${url}`);
    });
    renderTab();
    const apply = () => screen.getByRole("button", { name: /Apply to/ });
    const service = () => screen.getByRole("combobox", { name: "Service: machine" });
    fireEvent.click(await screen.findByRole("combobox", { name: "Endpoint: machine" }));
    fireEvent.click(await screen.findByText("plc-1", { selector: "span.block" }));
    fireEvent.click(service());
    const list = await screen.findByRole("listbox");
    expect(await within(list).findByText("opc-a (4840)")).toBeInTheDocument();
    expect(within(list).queryByText(/opc-b/)).not.toBeInTheDocument();
    fireEvent.keyDown(list, { key: "Escape" });
    // never preselected, even with a single service
    expect(service()).toHaveTextContent("Select a service");
    expect(screen.getByText("Choose a service")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("valid")).toBeInTheDocument(), { timeout: 2000 });
    expect(apply()).toBeDisabled();

    fireEvent.click(service());
    fireEvent.click(await screen.findByText("opc-a (4840)", { selector: "span.block" }));
    await waitFor(() => expect(apply()).toBeEnabled(), { timeout: 2000 });
    fireEvent.click(apply());
    await waitFor(() => expect(http.post).toHaveBeenCalledWith(
      "/dev-1/modules/seal-demo-x/config/apply",
      expect.objectContaining({ endpoints: { machine: "e1" }, services: { machine: "s1" } }),
    ));

    fireEvent.click(screen.getByRole("combobox", { name: "Endpoint: machine" }));
    fireEvent.click(await screen.findByText("plc-2", { selector: "span.block" }));
    expect(service()).toHaveTextContent("Select a service");
    expect(apply()).toBeDisabled();
  });

  it("renders text variables as a multi-line field", async () => {
    http.get.mockImplementation(async (url: string) => {
      if (url === "/dev-1/modules/seal-demo-x/config/templates") return { data: [TEMPLATE] };
      if (url === "/module-config-templates/7/versions") return { data: [VERSION(7)] };
      if (url.startsWith("/module-config-templates/7/versions/")) {
        return { data: { ...VERSION(7), variables: [{ name: "script", type: "text", required: true, label: "Script" }] } };
      }
      if (url.endsWith("/config/revisions")) return { data: { revisions: [] } };
      throw new Error(`unexpected GET ${url}`);
    });
    renderTab();
    const field = await screen.findByLabelText("Script *");
    expect(field.tagName).toBe("TEXTAREA");
  });

  it("groups inputs per copy and sends prefixed keys", async () => {
    const copy = (key: string) => ({ key, label: key, block_id: 3, name: "separator", parent: null, path: `/${key}` });
    const inputs = {
      variables: ["separatorA", "separatorB"].map((c) => ({ key: `${c}/machine_name`, copy: c, name: "machine_name", type: "string", required: true })),
      endpoints: ["separatorA", "separatorB"].map((c) => ({ key: `${c}/plc`, copy: c, slot: "plc", fields: ["ip"] })),
      device: [], copies: [copy("separatorA"), copy("separatorB")],
    };
    http.get.mockImplementation(async (url: string) => {
      if (url === "/dev-1/modules/seal-demo-x/config/templates") return { data: [TEMPLATE] };
      if (url === "/module-config-templates/7/versions") return { data: [VERSION(7)] };
      if (url.startsWith("/module-config-templates/7/versions/")) return { data: { ...VERSION(7), variables: [], references: { variables: [], device: [] }, inputs } };
      if (url.endsWith("/config/endpoints")) return { data: [{ endpoint_id: "e1", type_id: "t", type_label: "PLC", name: "plc-1", fields: {} }] };
      if (url.endsWith("/config/revisions")) return { data: { revisions: [] } };
      throw new Error(`unexpected GET ${url}`);
    });
    const post = http.post.getMockImplementation()!;
    http.post.mockImplementation(async (url: string, body: unknown) =>
      url.endsWith("/config/render") ? { data: { ok: true, config: {}, findings: [] } } : post(url, body));
    renderTab();
    const a = await screen.findByRole("group", { name: "separatorA · separator" });
    const b = screen.getByRole("group", { name: "separatorB · separator" });
    fireEvent.change(within(a).getByLabelText("machine_name *"), { target: { value: "sepA" } });
    fireEvent.click(await within(a).findByRole("combobox", { name: "Endpoint: plc" }));
    fireEvent.click(await screen.findByText("plc-1", { selector: "span.block" }));
    fireEvent.click(within(b).getByRole("combobox", { name: "Endpoint: plc" }));
    fireEvent.click(await screen.findByText("plc-1", { selector: "span.block" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Apply to/ })).toBeEnabled(), { timeout: 2000 });
    fireEvent.click(screen.getByRole("button", { name: /Apply to/ }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith(
      "/dev-1/modules/seal-demo-x/config/apply",
      expect.objectContaining({ values: { "separatorA/machine_name": "sepA" }, endpoints: { "separatorA/plc": "e1", "separatorB/plc": "e1" } }),
    ));
  });
});
