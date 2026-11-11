import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NamespacePage from "./NamespacePage";
import type { Namespace } from "./api";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApiInstance: http }));
vi.mock("@/api/edgeConfig/edgeConfigApiHooks", () => ({
  edgeConfigApiHooks: { useGetScopes: () => ({ data: [{ id: "s1", name: "Aachen devices" }, { id: "s2", name: "Test-Devices" }], isError: false }) },
}));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({ usePermissions: () => ({ hasPermission: true }) }));
vi.mock("@/components/Input/JsonEditor", () => ({ default: () => <div data-testid="editor" /> }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NAMESPACE: Namespace = {
  id: 1, name: "BU", description: "Packaging", module_names: ["m"], scopes: [{ id: "s1", name: "Aachen devices" }], template_count: 1,
  created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z",
};
const TEMPLATE = { id: 1, name: "t", namespace_id: 1, namespace_name: "BU", module_names: ["m"], scopes: [], archived: false, latest_version: 2, created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z" };
const SUMMARIES = [
  { template_id: 1, version: 2, created_by: "alice", created_at: "2026-11-09T11:00:00Z", comment: "faster" },
  { template_id: 1, version: 1, created_by: "bob", created_at: "2026-11-09T10:00:00Z", comment: "first" },
];
const version = (n: number) => ({ ...SUMMARIES[2 - n], body: { interval: n === 1 ? 60 : 5 }, variables: [], references: { variables: [], device: [] } });

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/module-templates" element={<div>all namespaces</div>} />
          <Route path="/module-templates/new" element={<NamespacePage />} />
          <Route path="/module-templates/:namespaceId" element={<NamespacePage />} />
          <Route path="/module-templates/:namespaceId/edit" element={<NamespacePage mode="edit" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("NamespacePage", () => {
  beforeEach(() => {
    http.post.mockReset().mockImplementation(async (url: string) =>
      url === "/module-config-namespaces"
        ? { data: { ...NAMESPACE, id: 9, name: "Business Unit XYZ - OPC UA" } }
        : { data: { ok: true, config: {}, findings: [] } });
    http.patch.mockReset().mockResolvedValue({ data: NAMESPACE });
    http.delete.mockReset().mockResolvedValue({});
    http.get.mockReset().mockImplementation(async (url: string) => {
      if (url === "/module-config-templates") return { data: [TEMPLATE] };
      if (url === "/module-config-namespaces") return { data: [NAMESPACE, { ...NAMESPACE, id: 2, name: "Other", template_count: 0 }] };
      if (url === "/module-config-templates/1/versions") return { data: SUMMARIES };
      if (url.endsWith("/versions/latest") || url.endsWith("/versions/2")) return { data: version(2) };
      if (url.endsWith("/versions/1")) return { data: version(1) };
      throw new Error(`unexpected GET ${url}`);
    });
  });

  it("shows a compact summary of the namespace above its own templates, without the edit form", async () => {
    renderAt("/module-templates/1");
    const details = await screen.findByRole("region", { name: "Namespace details" });
    expect(within(details).getByRole("heading", { name: "BU" })).toBeInTheDocument();
    expect(within(details).getByText("Packaging")).toBeInTheDocument();
    expect(within(details).getByText("m")).toBeInTheDocument();
    expect(within(details).getByText("Aachen devices")).toBeInTheDocument();
    expect(within(details).queryByLabelText("Name")).not.toBeInTheDocument();
    expect(within(details).getByRole("button", { name: /Edit namespace/ })).toBeInTheDocument();
    const templates = screen.getByRole("region", { name: "Templates" });
    expect(await within(templates).findByText("t")).toBeInTheDocument();
    expect(details.compareDocumentPosition(templates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("edits in a separate, roomier view that does not list the templates and goes back to the namespace", async () => {
    renderAt("/module-templates/1");
    fireEvent.click(await screen.findByRole("button", { name: /Edit namespace/ }));
    const details = await screen.findByRole("region", { name: "Namespace details" });
    expect(within(details).getByLabelText("Name")).toHaveValue("BU");
    expect(within(details).getByLabelText("Description")).toHaveValue("Packaging");
    expect(screen.queryByRole("region", { name: "Templates" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to BU" })).toHaveAttribute("href", "/module-templates/1");
  });

  it("lists a template as a link to its own subpage", async () => {
    renderAt("/module-templates/1");
    const templates = await screen.findByRole("region", { name: "Templates" });
    const link = await within(templates).findByRole("link", { name: /^t/ });
    expect(link).toHaveAttribute("href", "/module-templates/1/templates/1");
    expect(within(templates).getByRole("button", { name: /New template/ })).toBeEnabled();
  });

  it("saves changed details of the namespace only when something changed, then returns to the namespace", async () => {
    renderAt("/module-templates/1/edit");
    const save = await screen.findByRole("button", { name: "Save namespace" });
    expect(save).toBeDisabled();
    fireEvent.click(within(screen.getByRole("region", { name: "Namespace details" })).getByRole("button", { name: "Remove Aachen devices" }));
    expect(screen.getByText("No scope: accessible for everyone")).toBeInTheDocument();
    fireEvent.click(save);
    await waitFor(() => expect(http.patch).toHaveBeenCalledWith("/module-config-namespaces/1", {
      name: "BU", description: "Packaging", module_names: ["m"], scope_ids: [],
    }));
    expect(await screen.findByRole("region", { name: "Templates" })).toBeInTheDocument();
  });

  it("creates a namespace from typed module names and picked scopes, then opens it", async () => {
    http.get.mockImplementation(async (url: string) => {
      if (url === "/module-config-namespaces") return { data: [{ ...NAMESPACE, id: 9, name: "Business Unit XYZ - OPC UA" }] };
      return { data: [] };
    });
    renderAt("/module-templates/new");
    const create = await screen.findByRole("button", { name: "Create namespace" });
    expect(screen.getByText("No scope: accessible for everyone")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Business Unit XYZ - OPC UA" } });
    expect(create).toBeDisabled();

    const input = screen.getByLabelText("Module name");
    fireEvent.change(input, { target: { value: "seal-opcua-client" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "bad name" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/Use the exact module name/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "seal-mqtt-*" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/no wildcards/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "seal-mqtt" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const modules = document.getElementById("ns-modules")!.parentElement!;
    expect(within(modules).getByText("seal-opcua-client")).toBeInTheDocument();
    expect(within(modules).getByText("seal-mqtt")).toBeInTheDocument();
    expect(within(modules).queryByText("seal-mqtt-*")).not.toBeInTheDocument();
    fireEvent.click(within(modules).getByRole("button", { name: "Remove seal-opcua-client" }));

    fireEvent.click(screen.getByRole("button", { name: "Add scope" }));
    fireEvent.click(await screen.findByText("Test-Devices"));
    expect(screen.getByText("Test-Devices").parentElement).toHaveClass("bg-yellow-300");

    fireEvent.click(create);
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-namespaces", {
      name: "Business Unit XYZ - OPC UA", description: undefined, module_names: ["seal-mqtt"], scope_ids: ["s2"],
    }));
    expect(await screen.findByRole("heading", { name: "Business Unit XYZ - OPC UA" })).toBeInTheDocument();
  });

  it("deletes an empty namespace and offers no delete while it holds templates", async () => {
    renderAt("/module-templates/2/edit");
    fireEvent.click(await screen.findByRole("button", { name: "Delete namespace" }));
    await waitFor(() => expect(http.delete).toHaveBeenCalledWith("/module-config-namespaces/2"));
    expect(await screen.findByText("all namespaces")).toBeInTheDocument();
  });

  it("does not offer deleting a namespace that still has templates", async () => {
    renderAt("/module-templates/1/edit");
    await screen.findByRole("button", { name: "Save namespace" });
    expect(screen.queryByRole("button", { name: "Delete namespace" })).not.toBeInTheDocument();
  });
});
