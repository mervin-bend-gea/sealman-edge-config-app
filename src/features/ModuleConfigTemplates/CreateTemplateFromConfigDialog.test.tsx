import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import CreateTemplateFromConfigDialog from "./CreateTemplateFromConfigDialog";
import { escapePlaceholders } from "./utils";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApiInstance: http }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("escapePlaceholders", () => {
  it("escapes ${ in nested strings only", () => {
    expect(escapePlaceholders({ a: "x ${y}", b: ["${z}", 1, true, null], c: { d: "{{$ENV}}" } })).toEqual(
      { a: "x $${y}", b: ["$${z}", 1, true, null], c: { d: "{{$ENV}}" } },
    );
  });
});

const NAMESPACE = { id: 3, name: "Business Unit XYZ - Demo", module_names: ["seal-demo"], scopes: [{ id: "s1", name: "Aachen devices" }],
  template_count: 1, created_at: "2026-11-11T09:00:00Z", updated_at: "2026-11-11T09:00:00Z" };

describe("CreateTemplateFromConfigDialog", () => {
  const renderDialog = (config: unknown) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/devices/dev-1/applications/seal-demo"]}>
          <Routes>
            <Route path="/devices/*" element={<CreateTemplateFromConfigDialog open onOpenChange={() => {}} moduleName="seal-demo" config={config} />} />
            <Route path="/module-templates/:namespaceId/templates/:templateId" element={<div>library page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it("asks for a name, creates the template in a namespace of the module and opens it in the library", async () => {
    http.get.mockResolvedValue({ data: [NAMESPACE] });
    http.post.mockResolvedValue({ data: { id: 12, name: "from-device" } });
    renderDialog({ interval: 5, url: "${raw}" });
    expect(await screen.findByText("Aachen devices")).toBeInTheDocument();
    expect(http.get).toHaveBeenCalledWith("/module-config-namespaces", { params: { module: "seal-demo" } });
    const create = screen.getByRole("button", { name: "Create template" });
    expect(create).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "from-device" } });
    fireEvent.click(create);

    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-templates", {
      name: "from-device", description: undefined, namespace_id: 3,
      body: { interval: 5, url: "$${raw}" }, variables: [], comment: "Created from the configuration of seal-demo",
    }));
    expect(await screen.findByText("library page")).toBeInTheDocument();
  });

  it("creates a namespace for the module when none lists it", async () => {
    http.get.mockResolvedValue({ data: [] });
    http.post.mockReset().mockImplementation(async (url: string) =>
      url === "/module-config-namespaces" ? { data: { ...NAMESPACE, id: 9, name: "New NS" } } : { data: { id: 12, name: "t" } });
    renderDialog({ a: 1 });
    const create = screen.getByRole("button", { name: "Create template" });
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "t" } });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByLabelText("New namespace name"), { target: { value: "New NS" } });
    fireEvent.click(create);
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-namespaces",
      { name: "New NS", module_names: ["seal-demo"], scope_ids: [] }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith("/module-config-templates", expect.objectContaining({ namespace_id: 9 })));
  });

  it("refuses a configuration that is not an object", () => {
    http.get.mockResolvedValue({ data: [] });
    renderDialog([1, 2]);
    expect(screen.getByText("The configuration must be a JSON object.")).toBeInTheDocument();
  });
});
