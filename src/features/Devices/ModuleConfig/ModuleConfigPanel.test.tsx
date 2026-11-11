import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModuleConfigPanel from "./ModuleConfigPanel";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApiInstance: http }));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({ usePermissions: () => ({ hasPermission: true }) }));
vi.mock("./ModuleConfig", () => ({ default: ({ moduleName }: { moduleName: string }) => <div>raw editor for {moduleName}</div> }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TEMPLATE = {
  id: 7, name: "discover-basic", namespace_id: 1, namespace_name: "Business Unit XYZ - Demo", module_names: ["seal-demo"],
  scopes: [{ id: "s1", name: "Aachen devices" }], archived: false, latest_version: 2,
  created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z",
};
const VERSION = {
  template_id: 7, version: 2, created_at: "2026-11-09T10:00:00Z",
  body: { interval: "${interval}", site: "${device.site}" },
  variables: [{ name: "interval", type: "integer", required: true, label: "Interval" }],
  references: { variables: ["interval"], device: ["site"] },
};
const REVISIONS = {
  current_config_id: "c2",
  revisions: [
    { id: 2, device_id: "dev-1", module_name: "seal-demo-x", config_id: "c2", blob_name: "c2", source: "raw", actor: "bob", parent_revision_id: 1,
      created_at: "2026-11-09T11:00:00Z", current: true },
    { id: 1, device_id: "dev-1", module_name: "seal-demo-x", config_id: "c1", blob_name: "c1", source: "template",
      template_id: 7, template_name: "discover-basic", template_version: 2, values: { interval: 30 }, actor: "alice",
      created_at: "2026-11-09T10:30:00Z", current: false },
  ],
};

function routeGet(templates: unknown[]) {
  http.get.mockImplementation(async (url: string) => {
    if (url === "/dev-1/modules/seal-demo-x/config/templates") return { data: templates };
    if (url === "/module-config-templates/7/versions") return { data: [VERSION] };
    if (url.startsWith("/module-config-templates/7/versions/")) return { data: VERSION };
    if (url.endsWith("/config/revisions")) return { data: REVISIONS };
    if (url.endsWith("/config/revisions/1")) return { data: { ...REVISIONS.revisions[1], content: { interval: 30 }, content_available: true } };
    if (url.endsWith("/config/revisions/2")) return { data: { ...REVISIONS.revisions[0], content: { interval: 5 }, content_available: true } };
    throw new Error(`unexpected GET ${url}`);
  });
}

describe("ModuleConfigPanel", () => {
  let client: QueryClient;
  const renderPanel = () =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/devices/dev-1"]}>
          <ModuleConfigPanel deviceId="dev-1" moduleName="seal-demo-x" moduleStatus="running" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
      if (url.endsWith("/reapply")) return { data: { configId: "c4", revision: { id: 4 }, findings: [] } };
      throw new Error(`unexpected POST ${url}`);
    });
  });
  afterEach(() => client.clear());

  it("falls back to the raw editor when no template applies to the module", async () => {
    routeGet([]);
    renderPanel();
    expect(await screen.findByText("raw editor for seal-demo-x")).toBeInTheDocument();
    expect(http.get).toHaveBeenCalledWith("/dev-1/modules/seal-demo-x/config/templates");
  });

  it("renders the template form, previews the result and applies it", async () => {
    routeGet([TEMPLATE]);
    renderPanel();
    const input = await screen.findByLabelText("Interval *");
    expect(screen.getByText("Business Unit XYZ - Demo")).toBeInTheDocument();
    expect(screen.getByText("seal-demo")).toBeInTheDocument();
    expect(screen.getByText("Aachen devices")).toBeInTheDocument();
    expect(await screen.findByText("'Interval' is required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply v2/ })).toBeDisabled();

    fireEvent.change(input, { target: { value: "45" } });
    await waitFor(() => expect(screen.getByText(/"interval": 45/)).toBeInTheDocument(), { timeout: 2000 });
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "faster" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply v2/ }));

    await waitFor(() => expect(http.post).toHaveBeenCalledWith(
      "/dev-1/modules/seal-demo-x/config/apply",
      { template_id: 7, version: 2, values: { interval: "45" }, comment: "faster" },
    ));
    // after applying, the history is shown
    expect(await screen.findByText("discover-basic v2")).toBeInTheDocument();
  });

  it("lists the history and re-applies an earlier revision", async () => {
    routeGet([]);
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: "History" }));
    expect(await screen.findByText("current")).toBeInTheDocument();
    expect(screen.getByText("raw edit")).toBeInTheDocument();

    fireEvent.click(screen.getByText("discover-basic v2"));
    expect(await screen.findByText("Revision 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Re-apply/ }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith(
      "/dev-1/modules/seal-demo-x/config/revisions/1/reapply", { comment: undefined },
    ));
  });

  it("renders text variables as a multi-line field", async () => {
    http.get.mockImplementation(async (url: string) => {
      if (url === "/dev-1/modules/seal-demo-x/config/templates") return { data: [TEMPLATE] };
      if (url === "/module-config-templates/7/versions") return { data: [VERSION] };
      if (url.startsWith("/module-config-templates/7/versions/")) {
        return { data: { ...VERSION, variables: [{ name: "script", type: "text", required: true, label: "Script" }] } };
      }
      throw new Error(`unexpected GET ${url}`);
    });
    renderPanel();
    const field = await screen.findByLabelText("Script *");
    expect(field.tagName).toBe("TEXTAREA");
  });

  it("shows what a revision changed compared to the previous one", async () => {
    routeGet([]);
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: "History" }));
    await screen.findByText("Revision 2");
    fireEvent.click(screen.getByRole("tab", { name: "Changes to previous" }));
    const diff = await screen.findByRole("table", { name: "Differences" });
    expect(diff).toHaveTextContent('"interval": 30');
    expect(diff).toHaveTextContent('"interval": 5');
  });

  it("lists every revision as a step-wise change with who and when", async () => {
    routeGet([]);
    renderPanel();
    fireEvent.click(await screen.findByRole("tab", { name: "History" }));
    fireEvent.click(await screen.findByRole("tab", { name: "Changelog" }));
    const latest = await screen.findByRole("article", { name: "Revision 2" });
    expect(latest).toHaveTextContent("bob");
    expect(await within(latest).findByRole("table", { name: "Differences" })).toHaveTextContent('"interval": 5');
    const first = screen.getByRole("article", { name: "Revision 1" });
    expect(first).toHaveTextContent("alice");
    expect(first).toHaveTextContent("First recorded revision");
  });
});
