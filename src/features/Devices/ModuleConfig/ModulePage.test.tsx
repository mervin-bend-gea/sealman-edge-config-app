import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModulePage from "./ModulePage";

const mocks = vi.hoisted(() => ({
  getModules: vi.fn(),
  getConfigStatus: vi.fn(),
  outletProps: vi.fn(),
  replacePage: false,
  replaceConfig: false,
  extensionTabs: [] as { label: string; to: string }[],
  routedProps: vi.fn(),
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
    if (props.placement === "replace:page" && mocks.replacePage) return <div>extension page</div>;
    if (props.placement === "replace:config" && mocks.replaceConfig) return <div>extension configuration</div>;
    return <div data-testid={`outlet-${props.placement}`}>{props.fallback}</div>;
  },
}));
vi.mock("@/features/Extensions/outlets/useNavContributions", () => ({ useNavContributions: () => mocks.extensionTabs }));
vi.mock("@/features/Extensions/outlets/RoutedExtensionPanel", () => ({
  default: (props: { target: string; placement: string; context: object }) => {
    mocks.routedProps(props);
    return <div>routed extension tab</div>;
  },
}));
vi.mock("./ModuleConfigTab", () => ({ default: ({ moduleName }: { moduleName: string }) => <div>configuration for {moduleName}</div> }));
vi.mock("./ModuleConfig", () => ({ default: ({ moduleName }: { moduleName: string }) => <div>raw editor for {moduleName}</div> }));
vi.mock("./ModuleConfigHistory", () => ({ default: () => <div>history view</div> }));
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
    mocks.routedProps.mockReset();
    mocks.replacePage = false;
    mocks.replaceConfig = false;
    mocks.extensionTabs = [];
    mocks.getModules.mockReset().mockResolvedValue([
      { moduleId: "seal-opcua-client", moduleName: "seal-opcua-client", moduleType: "iotedge", version: "1.3.3", status: "running", connectionState: "Connected" },
    ]);
    mocks.getConfigStatus.mockReset().mockResolvedValue({});
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => { client.clear(); vi.useRealTimers(); });

  it("shows the summary and the configuration on the page, through the replace outlets, not in a dialog", async () => {
    renderAt("/devices/dev-1/applications/seal-opcua-client");
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Module summary" });
    expect(within(summary).getByRole("heading", { name: "seal-opcua-client" })).toBeInTheDocument();
    expect(screen.getByText("configuration for seal-opcua-client")).toBeInTheDocument();
    const context = expect.objectContaining({
      deviceId: "dev-1", deviceTypeId: "gateway-x", moduleId: "seal-opcua-client",
      moduleType: "iotedge", moduleVersion: "1.3.3", canEdit: true,
    });
    expect(mocks.outletProps).toHaveBeenCalledWith(expect.objectContaining({ target: "module", placement: "replace:page", context }));
    expect(mocks.outletProps).toHaveBeenCalledWith(expect.objectContaining({ target: "module", placement: "replace:config", context }));
  });

  it("has one flat tab bar: configuration, raw JSON, history, methods, reported, logs", async () => {
    renderAt("/devices/dev-1/applications/seal-opcua-client");
    await flush();
    const tabs = within(screen.getByRole("navigation", { name: "Module navigation" })).getAllByRole("link");
    expect(tabs.map((t) => t.textContent)).toEqual(["Configuration", "Raw JSON", "History", "Methods", "Reported", "Logs"]);
    expect(tabs[1]).toHaveAttribute("href", "/devices/dev-1/applications/seal-opcua-client/raw");
  });

  it.each([
    ["raw", "raw editor for seal-opcua-client"],
    ["history", "history view"],
    ["methods", "methods view"],
    ["logs", "logs view"],
    ["reported", "reported view for seal-opcua-client"],
  ])("routes the %s tab", async (tab, text) => {
    renderAt(`/devices/dev-1/applications/seal-opcua-client/${tab}`);
    await flush();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText("configuration for seal-opcua-client")).not.toBeInTheDocument();
  });

  it("appends the tabs extensions contribute to the module tab bar and routes them", async () => {
    mocks.extensionTabs = [{ label: "Simulator", to: "x/acme/simulator" }];
    renderAt("/devices/dev-1/applications/seal-opcua-client/x/acme/simulator");
    await flush();
    const tabs = within(screen.getByRole("navigation", { name: "Module navigation" })).getAllByRole("link");
    expect(tabs.map((t) => t.textContent)).toEqual(["Configuration", "Raw JSON", "History", "Methods", "Reported", "Logs", "Simulator"]);
    expect(tabs[6]).toHaveAttribute("href", "/devices/dev-1/applications/seal-opcua-client/x/acme/simulator");
    expect(screen.getByText("routed extension tab")).toBeInTheDocument();
    expect(mocks.routedProps).toHaveBeenCalledWith(expect.objectContaining({
      target: "module", placement: "tab", context: expect.objectContaining({ moduleId: "seal-opcua-client", deviceTypeId: "gateway-x" }),
    }));
  });

  it("lets an extension replace the whole page below the summary, tab bar included", async () => {
    mocks.replacePage = true;
    renderAt("/devices/dev-1/applications/seal-opcua-client");
    await flush();
    expect(screen.getByText("extension page")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Module summary" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Module navigation" })).not.toBeInTheDocument();
    expect(screen.queryByText("configuration for seal-opcua-client")).not.toBeInTheDocument();
  });

  it("lets an extension replace just the configuration tab, the other tabs stay", async () => {
    mocks.replaceConfig = true;
    renderAt("/devices/dev-1/applications/seal-opcua-client");
    await flush();
    expect(screen.getByText("extension configuration")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Module navigation" })).toBeInTheDocument();
  });

  it("shows what the application says about its configuration in the summary", async () => {
    mocks.getModules.mockResolvedValue([
      { moduleId: "seal-opcua-client", moduleName: "seal-opcua-client", moduleType: "iotedge", version: "1.3.3", status: "running", connectionState: "Connected" },
    ]);
    mocks.getConfigStatus.mockResolvedValue({ "seal-opcua-client": { appStatus: "ERROR", appMessage: "endpoint unreachable", confStatus: "OK" } });
    renderAt("/devices/dev-1/applications/seal-opcua-client");
    await flush();
    const summary = screen.getByRole("region", { name: "Module summary" });
    expect(within(summary).getByRole("alert")).toHaveTextContent("endpoint unreachable");
  });

  it("shows a message of an application that reports its configuration as OK as a success note, not a warning", async () => {
    mocks.getConfigStatus.mockResolvedValue({ "seal-opcua-client": { appStatus: "OK", appMessage: "Module fully operational", confStatus: "OK" } });
    renderAt("/devices/dev-1/applications/seal-opcua-client");
    await flush();
    const note = within(screen.getByRole("region", { name: "Module summary" })).getByRole("status");
    expect(note).toHaveTextContent("Module fully operational");
    expect(note).toHaveClass("text-green-700");
    expect(note).not.toHaveClass("text-amber-800");
  });

  it("stays quiet when the application reports success", async () => {
    mocks.getConfigStatus.mockResolvedValue({ "seal-opcua-client": { appStatus: "OK", appMessage: "configuration successful", confStatus: "OK" } });
    renderAt("/devices/dev-1/applications/seal-opcua-client");
    await flush();
    expect(within(screen.getByRole("region", { name: "Module summary" })).queryByRole("alert")).not.toBeInTheDocument();
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
