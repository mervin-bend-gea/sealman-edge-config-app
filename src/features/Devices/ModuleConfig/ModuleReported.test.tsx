import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import ModuleReported from "./ModuleReported";

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApiInstance: http }));
vi.mock("@/components/Input/JsonEditor", () => ({ default: ({ value }: { value: string }) => <pre data-testid="json">{value}</pre> }));

const renderReported = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ModuleReported deviceId="dev-1" moduleName="seal-demo-x" />
    </QueryClientProvider>,
  );

describe("ModuleReported", () => {
  it("shows the module's reported twin properties", async () => {
    http.get.mockResolvedValue({ data: { configId: "c2", custom: { temp: 21 }, lastUpdated: "2026-11-09T11:00:00Z" } });
    renderReported();
    expect(await screen.findByTestId("json")).toHaveTextContent('"temp": 21');
    expect(http.get).toHaveBeenCalledWith("/dev-1/twin/reported/seal-demo-x");
    expect(screen.getByText(/last updated/)).toBeInTheDocument();
  });

  it("says so when nothing was reported yet", async () => {
    http.get.mockResolvedValue({ data: null });
    renderReported();
    expect(await screen.findByText("This module has not reported any properties yet.")).toBeInTheDocument();
  });
});
