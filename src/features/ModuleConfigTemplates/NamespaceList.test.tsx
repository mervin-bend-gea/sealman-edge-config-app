import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import NamespaceList from "./NamespaceList";

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApiInstance: http }));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({ usePermissions: () => ({ hasPermission: true }) }));

const BASE = { description: null, template_count: 1, created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z" };
const NAMESPACES = [
  { ...BASE, id: 1, name: "BU Packaging", description: "Packaging lines", module_names: ["seal-opcua-client"], scopes: [] },
  { ...BASE, id: 2, name: "Site Aachen - Discovery", template_count: 0, module_names: ["seal-app-net-discover"], scopes: [{ id: "s1", name: "Aachen devices" }] },
];

const renderList = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/module-templates"]}>
        <Routes>
          <Route path="/module-templates" element={<NamespaceList />} />
          <Route path="/module-templates/new" element={<div>new namespace page</div>} />
          <Route path="/module-templates/:id" element={<div>namespace page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("NamespaceList", () => {
  it("lists every namespace in its own box with modules, scopes and template count", async () => {
    http.get.mockResolvedValue({ data: NAMESPACES });
    renderList();
    const open = await screen.findByRole("link", { name: "Namespace BU Packaging" });
    expect(within(open).getByText("seal-opcua-client")).toBeInTheDocument();
    expect(within(open).getByText("Packaging lines")).toBeInTheDocument();
    expect(within(open).getByText("1 template")).toBeInTheDocument();
    expect(within(open).getByText("No scope: accessible for everyone")).toBeInTheDocument();
    const scoped = screen.getByRole("link", { name: "Namespace Site Aachen - Discovery" });
    expect(within(scoped).getByText("Aachen devices")).toHaveClass("truncate");
    expect(within(scoped).getByText("0 templates")).toBeInTheDocument();
    expect(within(scoped).queryByText("No scope: accessible for everyone")).not.toBeInTheDocument();
  });

  it("filters by name, module and scope in the browser", async () => {
    http.get.mockResolvedValue({ data: NAMESPACES });
    renderList();
    await screen.findByRole("link", { name: "Namespace BU Packaging" });
    const search = screen.getByLabelText("Search namespaces", { selector: "input" });
    fireEvent.change(search, { target: { value: "aachen" } });
    expect(screen.queryByRole("link", { name: "Namespace BU Packaging" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Namespace Site Aachen - Discovery" })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "opcua" } });
    expect(screen.getByRole("link", { name: "Namespace BU Packaging" })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "nothing" } });
    expect(screen.getByText('No namespace matches "nothing".')).toBeInTheDocument();
  });

  it("opens a namespace and the creation page", async () => {
    http.get.mockResolvedValue({ data: NAMESPACES });
    renderList();
    fireEvent.click(await screen.findByRole("link", { name: "Namespace BU Packaging" }));
    expect(await screen.findByText("namespace page")).toBeInTheDocument();
  });

  it("creates a new namespace from the page header", async () => {
    http.get.mockResolvedValue({ data: [] });
    renderList();
    expect(await screen.findByText("No namespaces yet: create one to add templates.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New namespace/ }));
    expect(await screen.findByText("new namespace page")).toBeInTheDocument();
  });
});
