import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModulePage from "./ModulePage";

const mocks = vi.hoisted(() => ({
  getModules: vi.fn(),
  getConfigStatus: vi.fn(),
  outletProps: vi.fn(),
}));
vi.mock("@/auth", () => ({ useAuth: () => ({ isAuthenticated: true, user: { sub: "user-a" } }) }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApi: { getModules: mocks.getModules, getConfigStatus: mocks.getConfigStatus } }));
vi.mock("@/features/Extensions/outlets/useOutletUser", () => ({ useOutletUser: () => ({ id: "user-a", name: "A" }) }));
vi.mock("@/generated/edge-administration/hooks/device_metadata/useGetDeviceMetadata", () => ({
  default: () => ({ data: { typeId: "gateway-x" }, isLoading: false }),
}));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({ usePermissions: () => ({ hasPermission: true }) }));
vi.mock("@/features/Extensions/outlets/ExtensionOutlet", () => ({
  default: (props: { target: string; placement: string; context: object; fallback: React.ReactNode }) => {
    mocks.outletProps(props);
    return <div data-testid="outlet">{props.fallback}</div>;
  },
}));
vi.mock("./ModuleConfig", () => ({ default: ({ moduleName }: { moduleName: string }) => <div>built-in config for {moduleName}</div> }));
vi.mock("./DirectMethods", () => ({ default: () => <div>methods view</div> }));
vi.mock("./ModuleReported", () => ({ default: ({ moduleName }: { moduleName: string }) => <div>reported view for {moduleName}</div> }));
vi.mock("./ModuleLogs", () => ({ default: () => <div>logs view</div> }));

describe("ModulePage", () => {
  let client: QueryClient;
  const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(50); }); };
  const renderAt = (path: string) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/devices/:deviceId/applications">
              <Route index element={<div>applications list</div>} />
              <Route path=":moduleId/*" element={<ModulePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.outletProps.mockReset();
    mocks.getModules.mockReset().mockResolvedValue([
      { moduleId: "seal-opcua-client", moduleName: "seal-opcua-client", moduleType: "iotedge", version: "1.3.3", status: "running", connectionState: "Connected" },
    ]);
    mocks.getConfigStatus.mockReset().mockResolvedValue({});
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => { client.clear(); vi.useRealTimers(); });

  it("shows the configuration on the page, through the replace:config outlet, not in a dialog", async () => {
    renderAt("/devices/dev-1/applications/seal-opcua-client");
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "seal-opcua-client" })).toBeInTheDocument();
    expect(screen.getByText("built-in config for seal-opcua-client")).toBeInTheDocument();
    expect(mocks.outletProps).toHaveBeenLastCalledWith(expect.objectContaining({
      target: "module",
      placement: "replace:config",
      context: expect.objectContaining({
        deviceId: "dev-1", deviceTypeId: "gateway-x", moduleId: "seal-opcua-client",
        moduleType: "iotedge", moduleVersion: "1.3.3", canEdit: true,
      }),
    }));
  });

  it.each([
    ["methods", "methods view"],
    ["logs", "logs view"],
    ["reported", "reported view for seal-opcua-client"],
  ])("routes the %s tab", async (tab, text) => {
    renderAt(`/devices/dev-1/applications/seal-opcua-client/${tab}`);
    await flush();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });

  it("decodes encoded module IDs from the URL", async () => {
    mocks.getModules.mockResolvedValue([{ moduleId: "$edgeAgent", moduleName: "$edgeAgent", status: null }]);
    renderAt("/devices/dev-1/applications/%24edgeAgent");
    await flush();
    expect(screen.getByRole("heading", { name: "$edgeAgent" })).toBeInTheDocument();
  });

  it("reports an unknown module with a way back", async () => {
    renderAt("/devices/dev-1/applications/nope");
    await flush();
    expect(screen.getByText("Module not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Applications/ })).toHaveAttribute("href", "/devices/dev-1/applications");
  });
});
