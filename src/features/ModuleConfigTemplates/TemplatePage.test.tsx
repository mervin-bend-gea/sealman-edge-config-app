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

const NAMESPACE = {
  id: 1, name: "BU Packaging", module_names: ["m"], scopes: [{ id: "s1", name: "Aachen devices" }], template_count: 1,
  created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z",
};
const TEMPLATE = { id: 1, name: "t", namespace_id: 1, namespace_name: "BU Packaging", module_names: ["m"], scopes: [], archived: false, latest_version: 2, latest_tag: "2.0", created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z" };
const SUMMARIES = [
  { template_id: 1, version: 2, tag: "2.0", created_by: "alice", created_at: "2026-11-09T11:00:00Z", comment: "faster" },
  { template_id: 1, version: 1, tag: "1.0", created_by: "bob", created_at: "2026-11-09T10:00:00Z", comment: "first" },
];
const VARIABLES = [{ name: "interval", type: "integer", required: true, default: 60 }];
const version = (n: number) => ({ ...SUMMARIES[2 - n], body: { interval: n === 1 ? 60 : 5 }, variables: VARIABLES, references: { variables: [], device: [] } });

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/module-templates/:namespaceId" element={<div>namespace page</div>} />
          <Route path="/module-templates/:namespaceId/templates/new" element={<TemplatePage />} />
          <Route path="/module-templates/:namespaceId/templates/:templateId" element={<TemplatePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("TemplatePage", () => {
  beforeEach(() => {
    http.post.mockReset().mockImplementation(async (url: string) =>
      url === "/module-config-templates"
        ? { data: { ...TEMPLATE, id: 5, name: "fresh", latest_version: 1, latest_tag: "v1" } }
        : url.endsWith("/versions") ? { data: { ...version(2), version: 3, tag: "3.0" } }
        : { data: { ok: true, config: { rendered: true }, findings: [] } });
    http.patch.mockReset().mockResolvedValue({ data: TEMPLATE });
    http.get.mockReset().mockImplementation(async (url: string) => {
      if (url === "/module-config-templates") return { data: [TEMPLATE] };
      if (url === "/module-config-namespaces") return { data: [NAMESPACE] };
      if (url === "/module-config-templates/1/versions") return { data: SUMMARIES };
      if (url.endsWith("/versions/latest") || url.endsWith("/versions/2")) return { data: version(2) };
      if (url.endsWith("/versions/1")) return { data: version(1) };
      throw new Error(`unexpected GET ${url}`);
    });
  });

  it("goes back to its namespace and shows the namespace's modules and scopes", async () => {
    renderAt("/module-templates/1/templates/1");
    const back = await screen.findByRole("link", { name: "Back to BU Packaging" });
    expect(back).toHaveAttribute("href", "/module-templates/1");
    const details = await screen.findByRole("region", { name: "Template details" });
    expect(within(details).getByLabelText("Name")).toHaveValue("t");
    expect(within(details).getByText("Aachen devices")).toBeInTheDocument();
    fireEvent.click(back);
    expect(await screen.findByText("namespace page")).toBeInTheDocument();
  });

  it("puts details, a tall template editor, variables, preview and the save row in separate boxes", async () => {
    renderAt("/module-templates/1/templates/1");
    for (const name of ["Template details", "Configuration template", "Template variables", "Preview", "Save template"]) {
      expect(await screen.findByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("region", { name: "Compare versions" })).not.toBeInTheDocument();
    expect(screen.getByTestId("editor-Configuration template").className).toContain("h-[clamp(28rem,");
  });

  it("compares versions in a dialog opened from the top of the page, by their tags", async () => {
    renderAt("/module-templates/1/templates/1");
    fireEvent.click(await screen.findByRole("button", { name: /Compare versions/ }));
    const dialog = await screen.findByRole("dialog", { name: "Compare versions" });
    const diff = await within(dialog).findByRole("table", { name: "Differences" });
    expect(diff).toHaveTextContent('"interval": 60');
    expect(diff).toHaveTextContent('"interval": 5');
    expect(within(diff).getByText("1.0")).toBeInTheDocument();
    expect(within(diff).getByText("2.0")).toBeInTheDocument();
    expect(within(dialog).getByText(/From 1\.0/)).toBeInTheDocument();
    expect(within(dialog).getByText(/by bob on/)).toBeInTheDocument();
    expect(within(dialog).getByText(/by alice on .*: faster/)).toBeInTheDocument();
  });

  it("shows the rendered configuration in a dialog instead of beside the inputs", async () => {
    renderAt("/module-templates/1/templates/1");
    const preview = await screen.findByRole("region", { name: "Preview" });
    expect(within(preview).queryByText(/"rendered"/)).not.toBeInTheDocument();
    const show = await within(preview).findByRole("button", { name: /Show rendered configuration/ });
    await waitFor(() => expect(show).toBeEnabled());
    fireEvent.click(show);
    const dialog = await screen.findByRole("dialog", { name: "Rendered configuration" });
    expect(within(dialog).getByTestId("editor-Rendered configuration")).toHaveTextContent('"rendered": true');
  });

  it("only offers saving when something changed, and asks for a free tag for a new version", async () => {
    renderAt("/module-templates/1/templates/1");
    const save = await screen.findByRole("button", { name: "Save details" });
    expect(save).toBeDisabled();
    expect(screen.getByText("No changes to save.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Variable default"), { target: { value: "30" } });
    const newVersion = await screen.findByRole("button", { name: "Save new version" });
    expect(screen.getByLabelText("Version tag")).toHaveValue("v3");
    fireEvent.change(screen.getByLabelText("Version tag"), { target: { value: "1.0" } });
    expect(newVersion).toBeDisabled();
    expect(screen.getByText("A version tagged '1.0' already exists.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Version tag"), { target: { value: "-bad" } });
    expect(newVersion).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Version tag"), { target: { value: "3.0" } });
    fireEvent.change(screen.getByLabelText("Change comment"), { target: { value: "slower" } });
    expect(newVersion).toBeEnabled();
    fireEvent.click(newVersion);
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-templates/1/versions", expect.objectContaining({
      tag: "3.0", comment: "slower", body: { interval: 5 },
    })));
  });

  it("blocks saving while the variables are invalid", async () => {
    renderAt("/module-templates/1/templates/1");
    await screen.findByRole("button", { name: "Save details" });
    fireEvent.change(screen.getByLabelText("Variable name"), { target: { value: "" } });
    expect(screen.getByText("Variable 1: Give the variable a name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save new version" })).toBeDisabled();
    expect(screen.getByText("Fix the variable declarations.")).toBeInTheDocument();
  });

  it("saves only the details without a new version when the content is untouched", async () => {
    renderAt("/module-templates/1/templates/1");
    fireEvent.change(await screen.findByLabelText("Description"), { target: { value: "now described" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(http.patch).toHaveBeenCalledWith("/module-config-templates/1", expect.objectContaining({ description: "now described" })));
    expect(http.post).not.toHaveBeenCalledWith("/module-config-templates/1/versions", expect.anything());
  });

  it("creates a new template in the namespace with a tag and opens its page", async () => {
    renderAt("/module-templates/1/templates/new");
    const details = await screen.findByRole("region", { name: "Template details" });
    expect(within(details).getByText("New template")).toBeInTheDocument();
    const create = screen.getByRole("button", { name: "Create template" });
    expect(create).toBeDisabled();
    expect(screen.getByText("The template needs a name.")).toBeInTheDocument();
    fireEvent.change(within(details).getByLabelText("Name"), { target: { value: "fresh" } });
    expect(screen.getByLabelText("Version tag")).toHaveValue("v1");
    fireEvent.change(screen.getByLabelText("Version tag"), { target: { value: "initial" } });
    fireEvent.click(create);
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-templates", expect.objectContaining({ name: "fresh", namespace_id: 1, tag: "initial" })));
  });

  it("lays the details out as name and description, then a searchable namespace next to what it applies to", async () => {
    http.get.mockImplementation(async (url: string) => {
      if (url === "/module-config-namespaces") return { data: [NAMESPACE, { ...NAMESPACE, id: 2, name: "Site Düsseldorf", module_names: ["other"], scopes: [] }] };
      if (url === "/module-config-templates") return { data: [TEMPLATE] };
      if (url === "/module-config-templates/1/versions") return { data: SUMMARIES };
      return { data: version(2) };
    });
    renderAt("/module-templates/1/templates/1");
    const details = await screen.findByRole("region", { name: "Template details" });
    const applies = within(details).getByLabelText("Namespace modules and scopes");
    expect(within(applies).getByText("m")).toBeInTheDocument();
    expect(within(applies).getByText("Aachen devices")).toBeInTheDocument();

    fireEvent.click(within(details).getByRole("combobox", { name: "Namespace" }));
    fireEvent.change(await screen.findByPlaceholderText("Search namespaces"), { target: { value: "düssel" } });
    const list = await screen.findByRole("listbox");
    expect(within(list).queryByText("BU Packaging")).not.toBeInTheDocument();
    fireEvent.click(await within(list).findByText("Site Düsseldorf"));
    expect(within(details).getByRole("combobox", { name: "Namespace" })).toHaveTextContent("Site Düsseldorf");
    expect(within(applies).getByText("other")).toBeInTheDocument();
    expect(within(applies).getByText("No scope: accessible for everyone")).toBeInTheDocument();
  });

  it("starts with the preview collapsed to its header, which still tells whether the template is valid", async () => {
    localStorage.removeItem("moduleTemplatePreviewCollapsed");
    renderAt("/module-templates/1/templates/1");
    const preview = await screen.findByRole("region", { name: "Preview" });
    expect(within(preview).queryByLabelText("Sample device metadata")).not.toBeInTheDocument();
    expect(await within(preview).findByText("valid")).toBeInTheDocument();
    fireEvent.click(within(preview).getByRole("button", { name: "Expand Preview" }));
    expect(within(preview).getByLabelText("Sample device metadata")).toBeInTheDocument();
    expect(localStorage.getItem("moduleTemplatePreviewCollapsed")).toBe("0");
    fireEvent.click(within(preview).getByRole("button", { name: "Collapse Preview" }));
    expect(within(preview).getByRole("button", { name: "Expand Preview" })).toHaveAttribute("aria-expanded", "false");
    expect(localStorage.getItem("moduleTemplatePreviewCollapsed")).toBe("1");
    localStorage.removeItem("moduleTemplatePreviewCollapsed");
  });

  it("explains the sample device metadata and names the device fields the template uses", async () => {
    localStorage.setItem("moduleTemplatePreviewCollapsed", "0");
    http.get.mockImplementation(async (url: string) => {
      if (url === "/module-config-namespaces") return { data: [NAMESPACE] };
      if (url === "/module-config-templates") return { data: [TEMPLATE] };
      if (url === "/module-config-templates/1/versions") return { data: SUMMARIES };
      return { data: { ...version(2), body: { site: "${device.city}", note: "$${device.skipped}", again: "x ${device.city}" } } };
    });
    renderAt("/module-templates/1/templates/1");
    const preview = await screen.findByRole("region", { name: "Preview" });
    const hint = await within(preview).findByText(/Example data standing in for a device\. Change it freely/);
    expect(hint).toHaveTextContent("This template uses: city");
    expect(hint).not.toHaveTextContent("skipped");
    fireEvent.focus(within(preview).getByRole("button", { name: "About the device metadata" }));
    expect((await screen.findAllByText(/filled from the metadata of the device/)).length).toBeGreaterThan(0);
    localStorage.removeItem("moduleTemplatePreviewCollapsed");
  });

  it("previews with a real example device of the namespace instead of the sample metadata, optionally", async () => {
    localStorage.setItem("moduleTemplatePreviewCollapsed", "0");
    const devices = [
      { device_id: "dev-1", device_data: { city: "Aachen", description: "Test bench" } },
      { device_id: "dev-2", device_data: { city: "Aachen" } },
    ];
    const base = http.get.getMockImplementation()!;
    http.get.mockImplementation(async (url: string, config?: { params?: { q?: string } }) =>
      url === "/module-config-namespaces/1/example-devices"
        ? { data: devices.filter((d) => !config?.params?.q || d.device_id.includes(config.params.q)) }
        : base(url));
    renderAt("/module-templates/1/templates/1");
    const preview = await screen.findByRole("region", { name: "Preview" });
    // sample metadata is the default; no device is requested
    expect(within(preview).getByRole("radio", { name: "Sample metadata" })).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-templates/preview", expect.objectContaining({ device: expect.any(Object) })));
    expect(http.get).not.toHaveBeenCalledWith("/module-config-namespaces/1/example-devices", expect.anything());

    fireEvent.click(within(preview).getByRole("radio", { name: "Example device" }));
    expect(within(preview).queryByLabelText("Sample device metadata")).not.toBeInTheDocument();
    expect(within(preview).getByText(/in your scopes and in this namespace's scopes/)).toBeInTheDocument();
    fireEvent.click(within(preview).getByRole("combobox"));
    fireEvent.click(await screen.findByText("dev-1 · Test bench"));
    expect(within(preview).getByRole("combobox")).toHaveTextContent("dev-1 · Test bench");
    expect(within(preview).getByLabelText("Metadata of the example device")).toHaveTextContent('"description": "Test bench"');
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-templates/preview", expect.objectContaining({
      device_id: "dev-1", namespace_id: 1,
    })));
    expect(http.post).toHaveBeenLastCalledWith("/module-config-templates/preview", expect.not.objectContaining({ device: expect.anything() }));

    fireEvent.click(within(preview).getByRole("radio", { name: "Sample metadata" }));
    expect(within(preview).getByLabelText("Sample device metadata")).toBeInTheDocument();
    localStorage.removeItem("moduleTemplatePreviewCollapsed");
  });

  it("says when the sample device metadata does not matter", async () => {
    localStorage.setItem("moduleTemplatePreviewCollapsed", "0");
    renderAt("/module-templates/1/templates/1");
    expect(await screen.findByText(/uses no \$\{device\.\*\} placeholder/)).toBeInTheDocument();
    localStorage.removeItem("moduleTemplatePreviewCollapsed");
  });

  it("says so for an unknown template", async () => {
    renderAt("/module-templates/1/templates/99");
    expect(await screen.findByText("This template does not exist (any more).")).toBeInTheDocument();
  });
});
