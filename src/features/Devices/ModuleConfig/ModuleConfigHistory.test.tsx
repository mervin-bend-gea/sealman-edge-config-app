import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModuleConfigHistory from "./ModuleConfigHistory";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApiInstance: http }));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({ usePermissions: () => ({ hasPermission: true }) }));
vi.mock("@/components/Input/JsonEditor", () => ({
  default: ({ label, value }: { label?: string; value: string }) => <pre data-testid={`editor-${label}`}>{value}</pre>,
}));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const REVISIONS = {
  current_config_id: "c2",
  revisions: [
    { id: 2, device_id: "dev-1", module_name: "seal-demo-x", config_id: "c2", blob_name: "c2", source: "raw", actor: "bob", parent_revision_id: 1,
      created_at: "2026-11-09T11:00:00Z", current: true },
    { id: 1, device_id: "dev-1", module_name: "seal-demo-x", config_id: "c1", blob_name: "c1", source: "template",
      template_id: 7, template_name: "discover-basic", template_version: 2, template_version_tag: "2.0", values: { interval: 30 }, actor: "alice",
      created_at: "2026-11-09T10:30:00Z", current: false },
  ],
};

describe("ModuleConfigHistory", () => {
  let client: QueryClient;
  const onUseValues = vi.fn();
  const renderHistory = () =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ModuleConfigHistory deviceId="dev-1" moduleName="seal-demo-x" blocked={false} onUseValues={onUseValues} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    onUseValues.mockReset();
    http.get.mockReset().mockImplementation(async (url: string) => {
      if (url.endsWith("/config/revisions")) return { data: REVISIONS };
      if (url.endsWith("/config/revisions/1")) return { data: { ...REVISIONS.revisions[1], content: { interval: 30 }, content_available: true } };
      if (url.endsWith("/config/revisions/2")) return { data: { ...REVISIONS.revisions[0], content: { interval: 5 }, content_available: true } };
      throw new Error(`unexpected GET ${url}`);
    });
    http.post.mockReset().mockResolvedValue({ data: { configId: "c4", revision: { id: 4 }, findings: [] } });
  });
  afterEach(() => client.clear());

  it("lists the revisions in a box with the current one selected, the selected revision in a box below", async () => {
    renderHistory();
    const history = await screen.findByRole("region", { name: "History" });
    expect(within(history).getByText("current")).toBeInTheDocument();
    expect(within(history).getByText("raw edit")).toBeInTheDocument();
    expect(within(history).getByText("discover-basic 2.0")).toBeInTheDocument();
    const detail = await screen.findByRole("region", { name: "Revision 2" });
    expect(history.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await within(detail).findByTestId("editor-Revision content")).toHaveTextContent('"interval": 5');
  });

  it("re-applies an earlier revision and offers its values for editing", async () => {
    renderHistory();
    fireEvent.click(await screen.findByText("discover-basic 2.0"));
    const detail = await screen.findByRole("region", { name: "Revision 1" });
    fireEvent.click(within(detail).getByRole("button", { name: /Edit values/ }));
    expect(onUseValues).toHaveBeenCalledWith(expect.objectContaining({ id: 1, template_id: 7, values: { interval: 30 } }));
    fireEvent.click(within(detail).getByRole("button", { name: /Re-apply/ }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith(
      "/dev-1/modules/seal-demo-x/config/revisions/1/reapply", { comment: undefined },
    ));
  });

  it("shows what a revision changed compared to the previous one", async () => {
    renderHistory();
    await screen.findByRole("region", { name: "Revision 2" });
    fireEvent.click(screen.getByRole("tab", { name: "Changes to previous" }));
    const diff = await screen.findByRole("table", { name: "Differences" });
    expect(diff).toHaveTextContent('"interval": 30');
    expect(diff).toHaveTextContent('"interval": 5');
  });

  it("lists every revision as a step-wise change with who and when", async () => {
    renderHistory();
    fireEvent.click(await screen.findByRole("tab", { name: "Changelog" }));
    const latest = await screen.findByRole("article", { name: "Revision 2" });
    expect(latest).toHaveTextContent("bob");
    expect(await within(latest).findByRole("table", { name: "Differences" })).toHaveTextContent('"interval": 5');
    const first = screen.getByRole("article", { name: "Revision 1" });
    expect(first).toHaveTextContent("alice");
    expect(first).toHaveTextContent("discover-basic 2.0");
    expect(screen.queryByRole("region", { name: "Revision 2" })).not.toBeInTheDocument();
  });

  it("says so when nothing has been written yet", async () => {
    http.get.mockResolvedValue({ data: { revisions: [] } });
    renderHistory();
    expect(await screen.findByText("No configuration has been written to this module yet.")).toBeInTheDocument();
  });
});
