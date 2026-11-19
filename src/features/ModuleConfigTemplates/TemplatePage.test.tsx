import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TemplatePage from "./TemplatePage";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApiInstance: http }));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({ usePermissions: () => ({ hasPermission: true }) }));
vi.mock("@/components/Input/JsonEditor", () => ({
  default: ({ className, label, value }: { className?: string; label?: string; value: string }) => (
    <div data-testid={`editor-${label}`} className={className}>{value}</div>
  ),
}));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const GROUP = {
  id: 1, name: "BU Packaging", module_names: ["m"], scopes: [{ id: "s1", name: "Aachen devices" }], template_count: 1,
  created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z",
};
const TEMPLATE = { id: 1, name: "t", group_id: 1, group_name: "BU Packaging", module_names: ["m"], scopes: [], archived: false, latest_version: 2, created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z" };
const SUMMARIES = [
  { template_id: 1, version: 2, created_by: "alice", created_at: "2026-11-09T11:00:00Z", comment: "faster" },
  { template_id: 1, version: 1, created_by: "bob", created_at: "2026-11-09T10:00:00Z", comment: "first" },
];
const VARIABLES = [{ name: "interval", type: "integer", required: true }];
const version = (n: number) => ({ ...SUMMARIES[2 - n], body: { interval: n === 1 ? 60 : 5 }, variables: VARIABLES, references: { variables: [], device: [] } });

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/module-templates/:groupId" element={<div>template group page</div>} />
          <Route path="/module-templates/:groupId/templates/new" element={<TemplatePage />} />
          <Route path="/module-templates/:groupId/templates/:templateId" element={<TemplatePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("TemplatePage", () => {
  beforeEach(() => {
    http.post.mockReset().mockImplementation(async (url: string) =>
      url === "/module-config-templates"
        ? { data: { ...TEMPLATE, id: 5, name: "fresh", latest_version: 1 } }
        : url.endsWith("/versions") ? { data: { ...version(2), version: 3 } }
        : { data: { ok: true, config: { rendered: true }, findings: [] } });
    http.patch.mockReset().mockResolvedValue({ data: TEMPLATE });
    http.get.mockReset().mockImplementation(async (url: string) => {
      if (url === "/module-config-templates") return { data: [TEMPLATE] };
      if (url === "/module-config-template-groups") return { data: [GROUP] };
      if (url === "/module-config-templates/1/versions") return { data: SUMMARIES };
      if (url.endsWith("/versions/latest") || url.endsWith("/versions/2")) return { data: version(2) };
      if (url.endsWith("/versions/1")) return { data: version(1) };
      throw new Error(`unexpected GET ${url}`);
    });
  });

  it("goes back to its template group and shows the template group's modules and scopes", async () => {
    renderAt("/module-templates/1/templates/1");
    const back = await screen.findByRole("link", { name: "Back to BU Packaging" });
    expect(back).toHaveAttribute("href", "/module-templates/1");
    const details = await screen.findByRole("region", { name: "Template details" });
    expect(within(details).getByLabelText("Name")).toHaveValue("t");
    expect(within(details).getByText("Aachen devices")).toBeInTheDocument();
    fireEvent.click(back);
    expect(await screen.findByText("template group page")).toBeInTheDocument();
  });

  it("puts details, a tall template editor, variables, preview and the save row in separate boxes", async () => {
    renderAt("/module-templates/1/templates/1");
    for (const name of ["Template details", "Configuration template", "Template variables", "Preview", "Save template"]) {
      expect(await screen.findByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("region", { name: "Compare versions" })).not.toBeInTheDocument();
    expect(screen.getByTestId("editor-Configuration template").className).toContain("h-[clamp(28rem,");
  });

  it("compares versions in a dialog opened from the top of the page, by their numbers", async () => {
    renderAt("/module-templates/1/templates/1");
    fireEvent.click(await screen.findByRole("button", { name: /Compare versions/ }));
    const dialog = await screen.findByRole("dialog", { name: "Compare versions" });
    const diff = await within(dialog).findByRole("table", { name: "Differences" });
    expect(diff).toHaveTextContent('"interval": 60');
    expect(diff).toHaveTextContent('"interval": 5');
    expect(within(diff).getByText("#1")).toBeInTheDocument();
    expect(within(diff).getByText("#2")).toBeInTheDocument();
    expect(within(dialog).getByText(/From #1/)).toBeInTheDocument();
    expect(within(dialog).getByText(/by bob on/)).toBeInTheDocument();
    expect(within(dialog).getByText(/by alice on .*: faster/)).toBeInTheDocument();
  });

  it("only offers saving when something changed", async () => {
    renderAt("/module-templates/1/templates/1");
    const save = await screen.findByRole("button", { name: "Save details" });
    expect(save).toBeDisabled();
    expect(screen.getByText("No changes to save.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Variable label"), { target: { value: "Interval" } });
    const newVersion = await screen.findByRole("button", { name: "Save new version" });
    fireEvent.change(screen.getByLabelText("Change comment"), { target: { value: "slower" } });
    expect(newVersion).toBeEnabled();
    fireEvent.click(newVersion);
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-templates/1/versions", expect.objectContaining({
      comment: "slower", body: { interval: 5 },
    })));
  });

  it("saves only the details without a new version when the content is untouched", async () => {
    renderAt("/module-templates/1/templates/1");
    fireEvent.change(await screen.findByLabelText("Description"), { target: { value: "now described" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(http.patch).toHaveBeenCalledWith("/module-config-templates/1", expect.objectContaining({ description: "now described" })));
    expect(http.post).not.toHaveBeenCalledWith("/module-config-templates/1/versions", expect.anything());
  });

  it("creates a new template in the template group and opens its page", async () => {
    renderAt("/module-templates/1/templates/new");
    const details = await screen.findByRole("region", { name: "Template details" });
    expect(within(details).getByText("New template")).toBeInTheDocument();
    const create = screen.getByRole("button", { name: "Create template" });
    expect(create).toBeDisabled();
    expect(screen.getByText("The template needs a name.")).toBeInTheDocument();
    fireEvent.change(within(details).getByLabelText("Name"), { target: { value: "fresh" } });
    fireEvent.click(create);
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-templates", expect.objectContaining({ name: "fresh", group_id: 1 })));
  });

  it("creates a block when opened for a new block", async () => {
    renderAt("/module-templates/1/templates/new?kind=block");
    const details = await screen.findByRole("region", { name: "Block details" });
    expect(within(details).getByText("New block")).toBeInTheDocument();
    fireEvent.change(within(details).getByLabelText("Name"), { target: { value: "separator" } });
    fireEvent.click(screen.getByRole("button", { name: "Create block" }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-templates", expect.objectContaining({ name: "separator", kind: "block" })));
  });

  it("lays the details out as name and description, then a searchable template group next to what it applies to", async () => {
    http.get.mockImplementation(async (url: string) => {
      if (url === "/module-config-template-groups") return { data: [GROUP, { ...GROUP, id: 2, name: "Site Düsseldorf", module_names: ["other"], scopes: [] }] };
      if (url === "/module-config-templates") return { data: [TEMPLATE] };
      if (url === "/module-config-templates/1/versions") return { data: SUMMARIES };
      return { data: version(2) };
    });
    renderAt("/module-templates/1/templates/1");
    const details = await screen.findByRole("region", { name: "Template details" });
    const applies = within(details).getByLabelText("Template Group modules and scopes");
    expect(within(applies).getByText("m")).toBeInTheDocument();
    expect(within(applies).getByText("Aachen devices")).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("combobox", { name: "Template Group" }));
    fireEvent.change(await screen.findByPlaceholderText("Search template groups"), { target: { value: "düssel" } });
    const list = await screen.findByRole("listbox");
    expect(within(list).queryByText("BU Packaging")).not.toBeInTheDocument();
    fireEvent.click(await within(list).findByText("Site Düsseldorf"));
    expect(within(details).getByRole("combobox", { name: "Template Group" })).toHaveTextContent("Site Düsseldorf");
    expect(within(applies).getByText("other")).toBeInTheDocument();
    expect(within(applies).getByText("No scope: accessible for everyone")).toBeInTheDocument();
  });

  it("previews with the chosen device's endpoint and service, and shows the result in a dialog", async () => {
    localStorage.setItem("moduleTemplatePreviewCollapsed", "0");
    const machine = { key: "machine", slot: "machine", copy: null, fields: ["ip"], service_fields: ["port"] };
    const base = http.get.getMockImplementation()!;
    http.get.mockImplementation(async (url: string) => {
      if (url === "/module-config-template-groups/1/example-devices") return { data: [{ device_id: "dev-1", device_data: { description: "Test bench" } }] };
      if (url === "/dev-1/config/endpoints") return { data: [{ endpoint_id: "e1", type_id: "t", type_label: "PLC", name: "plc-1", fields: {} }] };
      if (url === "/dev-1/config/endpoints/e1/services") return { data: [{ service_id: "s1", type_id: "o", type_label: "OPC UA", name: "opc-a", port: 4840, fields: {} }] };
      return base(url);
    });
    const post = http.post.getMockImplementation()!;
    http.post.mockImplementation(async (url: string, payload: unknown) =>
      url.endsWith("/lint")
        ? { data: { ok: true, findings: [], references: { variables: [], device: [] }, inputs: { variables: [], endpoints: [machine], device: [], copies: [], lists: [] } } }
        : post(url, payload));
    renderAt("/module-templates/1/templates/1");
    const before = await screen.findByRole("region", { name: "Preview" });
    expect(within(before).queryByRole("combobox", { name: "Endpoint: machine" })).not.toBeInTheDocument();
    fireEvent.click(within(before).getByRole("combobox"));
    fireEvent.click(await screen.findByText("dev-1 · Test bench"));
    // a new device starts a fresh form
    const preview = await screen.findByRole("region", { name: "Preview" });
    fireEvent.click(await within(preview).findByRole("combobox", { name: "Endpoint: machine" }));
    fireEvent.click(await screen.findByText("plc-1", { selector: "span.block" }));
    fireEvent.click(within(preview).getByRole("combobox", { name: "Service: machine" }));
    fireEvent.click(await screen.findByText("opc-a (4840)", { selector: "span.block" }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-templates/preview", expect.objectContaining({
      device_id: "dev-1", group_id: 1, endpoints: { machine: "e1" }, services: { machine: "s1" },
    })), { timeout: 2000 });
    fireEvent.click(within(preview).getByRole("button", { name: /Show rendered configuration/ }));
    const dialog = await screen.findByRole("dialog", { name: "Rendered configuration" });
    expect(within(dialog).getByTestId("editor-Rendered configuration")).toHaveTextContent('"rendered": true');
    localStorage.removeItem("moduleTemplatePreviewCollapsed");
  });

  it("says so for an unknown template", async () => {
    renderAt("/module-templates/1/templates/99");
    expect(await screen.findByText("This template does not exist (any more).")).toBeInTheDocument();
  });
});
