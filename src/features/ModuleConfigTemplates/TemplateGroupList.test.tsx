import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import TemplateGroupList from "./TemplateGroupList";

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApiInstance: http }));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({ usePermissions: () => ({ hasPermission: true }) }));

const BASE = { description: null, template_count: 1, created_at: "2026-11-09T10:00:00Z", updated_at: "2026-11-09T10:00:00Z" };
const GROUPS = [
  { ...BASE, id: 1, name: "BU Packaging", description: "Packaging lines", module_names: ["seal-opcua-client"], scopes: [] },
  { ...BASE, id: 2, name: "Site Aachen - Discovery", template_count: 0, module_names: ["seal-app-net-discover"], scopes: [{ id: "s1", name: "Aachen devices" }] },
];

const renderList = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/module-templates"]}>
        <Routes>
          <Route path="/module-templates" element={<TemplateGroupList />} />
          <Route path="/module-templates/new" element={<div>new template group page</div>} />
          <Route path="/module-templates/:id" element={<div>template group page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("TemplateGroupList", () => {
  it("lists every template group in its own box with modules, scopes and template count", async () => {
    http.get.mockResolvedValue({ data: GROUPS });
    renderList();
    const open = await screen.findByRole("link", { name: "Template Group BU Packaging" });
    expect(within(open).getByText("seal-opcua-client")).toBeInTheDocument();
    expect(within(open).getByText("Packaging lines")).toBeInTheDocument();
    expect(within(open).getByText("1 template")).toBeInTheDocument();
    expect(within(open).getByText("No scope: accessible for everyone")).toBeInTheDocument();
    const scoped = screen.getByRole("link", { name: "Template Group Site Aachen - Discovery" });
    expect(within(scoped).getByText("Aachen devices")).toHaveClass("truncate");
    expect(within(scoped).getByText("0 templates")).toBeInTheDocument();
    expect(within(scoped).queryByText("No scope: accessible for everyone")).not.toBeInTheDocument();
  });

  it("filters by name, module and scope in the browser", async () => {
    http.get.mockResolvedValue({ data: GROUPS });
    renderList();
    await screen.findByRole("link", { name: "Template Group BU Packaging" });
    const search = screen.getByLabelText("Search template groups", { selector: "input" });
    fireEvent.change(search, { target: { value: "aachen" } });
    expect(screen.queryByRole("link", { name: "Template Group BU Packaging" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Template Group Site Aachen - Discovery" })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "opcua" } });
    expect(screen.getByRole("link", { name: "Template Group BU Packaging" })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "nothing" } });
    expect(screen.getByText('No template group matches "nothing".')).toBeInTheDocument();
  });

  it("opens a template group and the creation page", async () => {
    http.get.mockResolvedValue({ data: GROUPS });
    renderList();
    fireEvent.click(await screen.findByRole("link", { name: "Template Group BU Packaging" }));
    expect(await screen.findByText("template group page")).toBeInTheDocument();
  });

  it("creates a new template group from the page header", async () => {
    http.get.mockResolvedValue({ data: [] });
    renderList();
    expect(await screen.findByText("No template groups yet: create one to add templates.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New template group/ }));
    expect(await screen.findByText("new template group page")).toBeInTheDocument();
  });
});
