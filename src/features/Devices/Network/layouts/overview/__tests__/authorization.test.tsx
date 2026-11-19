import { act, fireEvent, render, screen } from "@testing-library/react";
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OverviewContentContainer from "../OverviewContentContainer";
import { queryClient } from "@/config/queryConfig";

const mocks = vi.hoisted(() => ({
  deviceId: "device-a", user: "user-a", get: vi.fn(), discover: vi.fn(), overview: vi.fn(), savePorts: vi.fn(), notify: vi.fn(),
  scanEnabled: true as boolean | undefined,
}));
vi.mock("@/features/PlatformFunctions/platformFunctionsApi", () => ({
  PLATFORM_FUNCTIONS_QUERY_KEY: ["platformFunctions"],
  useNetworkScanEnabled: () => mocks.scanEnabled,
}));
vi.mock("@/auth", () => ({ useAuth: () => ({ isAuthenticated: true, user: { sub: mocks.user } }) }));
vi.mock("@/features/Devices/Network/stores", () => ({
  useNetworkPageStore: (select: (state: { deviceId: string }) => unknown) => select({ deviceId: mocks.deviceId }),
}));
vi.mock("@/generated/edge-administration/api", () => ({ client: { GET: mocks.get } }));
vi.mock("@/generated/edge-administration/hooks/network/usePostDeviceNetworkDiscover", () => ({ default: () => ({ mutateAsync: mocks.discover }) }));
vi.mock("@/generated/edge-administration/hooks/network/usePostNetworkOverview", () => ({ default: () => ({ mutateAsync: mocks.overview }) }));
vi.mock("@/generated/edge-administration/hooks/network/usePostDeviceScanPorts", () => ({ default: () => ({ mutateAsync: mocks.savePorts }) }));
vi.mock("react-toastify", () => ({ toast: { error: mocks.notify } }));
vi.mock("../DiscoveredEndpointsCard", () => ({
  default: ({ endpoints, onScan, scanDisabled, scanAvailable }: { endpoints: { ip: string }[]; onScan: () => void; scanDisabled: boolean; scanAvailable?: boolean }) => (
    <div>{endpoints.map((endpoint) => <span key={endpoint.ip}>{endpoint.ip}</span>)}{scanAvailable !== false && <button disabled={scanDisabled} onClick={onScan}>Custom scan</button>}</div>
  ),
}));
vi.mock("../EndpointCanvas", () => ({
  default: ({ endpoints }: { endpoints: { ip: string }[] }) => <div>{endpoints.map((endpoint) => <span key={endpoint.ip}>{endpoint.ip}</span>)}</div>,
}));
vi.mock("../EndpointActions", () => ({ default: ({ onScan, scanDisabled }: { onScan: () => void; scanDisabled: boolean }) => <button disabled={scanDisabled} onClick={onScan}>Custom scan</button> }));
vi.mock("../ScanNetworkDialog", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: (range: null, ports: number[], ips: string[]) => void }) => (
    open ? <button onClick={() => onConfirm(null, [8080], ["10.0.0.2"])}>Run custom scan</button> : null
  ),
}));
vi.mock("../UnidentifiedEndpointsCard", () => ({ default: () => null }));
vi.mock("../AssignEndpointDialog", () => ({ default: () => null }));
vi.mock("../EndpointDetailsPage", () => ({ default: () => null }));
vi.mock("../ServiceDetailsPage", () => ({ default: () => null }));
vi.mock("@/features/Devices/Gateway/DeviceGatewayCard", () => ({ default: () => null }));

const definition = { networkDefinition: "10.0.0.0", subnetMask: 24, ports: [80] };
const persisted = { scanDefinition: definition, endpoints: [{ ip: "10.0.0.1", endpoint_id: "one", source: "configured", ports: [] }] };
const scan = { payload: { scanDefinition: definition, scanResults: [] } };
const forbidden = () => Object.assign(new Error("Denied"), { statusCode: 403 });

describe("Assets reactive authorization", () => {
  let client: QueryClient;
  const tree = () => <QueryClientProvider client={client}><OverviewContentContainer /></QueryClientProvider>;
  const flush = async (ms = 50) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.deviceId = "device-a"; mocks.user = "user-a"; mocks.scanEnabled = true;
    mocks.get.mockReset().mockImplementation(async (path: string) => {
      if (path.endsWith("scan-ports")) return { data: [80] };
      if (path.endsWith("scan-range")) return { data: { ...definition, suggestedIps: [] } };
      return { data: persisted };
    });
    mocks.discover.mockReset().mockResolvedValue(scan);
    mocks.overview.mockReset().mockResolvedValue(persisted);
    mocks.savePorts.mockReset().mockResolvedValue({});
    mocks.notify.mockReset();
    client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  });
  afterEach(() => { client.clear(); vi.useRealTimers(); });

  it("never scans while the network scan is disabled platform-wide but still shows configured endpoints", async () => {
    mocks.scanEnabled = false;
    render(tree());
    await flush();
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Custom scan" })).not.toBeInTheDocument();
    expect(screen.queryByText("Not permitted")).not.toBeInTheDocument();
    await flush(15000);
    expect(mocks.get.mock.calls.every(([path]) => path.endsWith("last-known"))).toBe(true);
    expect(mocks.discover).not.toHaveBeenCalled();
    expect(mocks.overview).not.toHaveBeenCalled();
  });

  it("does not start anything before the network scan switch is known", async () => {
    mocks.scanEnabled = undefined;
    render(tree());
    await flush();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.discover).not.toHaveBeenCalled();
  });

  it.each(["scan-ports", "scan-range", "discover", "overview"])(
    "stops scanning after a %s denial but preserves readable configured endpoints",
    async (step) => {
      if (step === "discover") mocks.discover.mockRejectedValue(forbidden());
      else if (step === "overview") mocks.overview.mockRejectedValue(forbidden());
      else {
        const get = mocks.get.getMockImplementation()!;
        mocks.get.mockImplementation((path: string) => path.endsWith(step) ? Promise.reject(forbidden()) : get(path));
      }
      render(tree());
      await flush();
      expect(screen.getByText("Not permitted")).toBeInTheDocument();
      expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Custom scan" })).toBeDisabled();
      const scanCalls = () => [
        mocks.get.mock.calls.filter(([path]) => !path.endsWith("last-known")).length,
        mocks.discover.mock.calls.length,
        mocks.overview.mock.calls.length,
      ];
      const calls = scanCalls();
      await act(async () => {
        focusManager.setFocused(false); focusManager.setFocused(true);
        onlineManager.setOnline(false); onlineManager.setOnline(true);
        await client.invalidateQueries();
      });
      await flush(15000);
      expect(scanCalls()).toEqual(calls);
      if (step === "discover") expect(mocks.overview).not.toHaveBeenCalled();
    },
  );

  it("hides restricted live results on scan denial, keeps configured endpoints and resumes on explicit retry", async () => {
    mocks.overview.mockResolvedValue({
      ...persisted,
      endpoints: [...persisted.endpoints, { ip: "10.0.0.2", source: "discovered", ports: [] }],
    });
    render(tree());
    await flush();
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.2")).toBeInTheDocument();
    mocks.discover.mockRejectedValue(forbidden());
    await flush(3000);
    expect(screen.getByText("Not permitted")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    expect(screen.queryByText("10.0.0.2")).not.toBeInTheDocument();
    mocks.discover.mockResolvedValue(scan);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await flush();
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.2")).toBeInTheDocument();
    const calls = mocks.discover.mock.calls.length;
    await flush(3000);
    expect(mocks.discover.mock.calls.length).toBeGreaterThan(calls);
  });

  it("finishes a pending configured-endpoint read after discovery is denied", async () => {
    let finish: ((value: { data: typeof persisted }) => void) | undefined;
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((path: string) => path.endsWith("last-known")
      ? new Promise<{ data: typeof persisted }>((resolve) => { finish = resolve; })
      : get(path));
    mocks.discover.mockRejectedValue(forbidden());
    render(tree());
    await flush();
    await act(async () => { finish?.({ data: persisted }); });
    await flush();
    expect(screen.getByText("Not permitted")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
  });

  it("hides all Assets results and stops requests when the endpoint read is denied", async () => {
    render(tree());
    await flush();
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((path: string) => path.endsWith("last-known") ? Promise.reject(forbidden()) : get(path));
    await act(async () => { await client.invalidateQueries({ queryKey: ["network-offline-fallback"] }); });
    await flush();
    expect(screen.getByText("Not permitted")).toBeInTheDocument();
    expect(screen.queryByText("10.0.0.1")).not.toBeInTheDocument();
    const calls = [mocks.get.mock.calls.length, mocks.discover.mock.calls.length, mocks.overview.mock.calls.length];
    await act(async () => {
      focusManager.setFocused(false); focusManager.setFocused(true);
      onlineManager.setOnline(false); onlineManager.setOnline(true);
      await client.invalidateQueries();
    });
    await flush(15000);
    expect([mocks.get.mock.calls.length, mocks.discover.mock.calls.length, mocks.overview.mock.calls.length]).toEqual(calls);
  });

  it("continues temporary-port scanning after one optional save denial", async () => {
    mocks.savePorts.mockRejectedValue(forbidden());
    render(tree());
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Custom scan" }));
    fireEvent.click(screen.getByRole("button", { name: "Run custom scan" }));
    await flush();
    expect(mocks.savePorts).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining("Failed to save"));
    expect(mocks.discover).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ ports: [80, 8080] }) }));
    expect(screen.queryByText("Not permitted")).not.toBeInTheDocument();
    await flush(10000);
    expect(mocks.savePorts).toHaveBeenCalledTimes(1);
  });

  it("does not submit overview after a device/account change while discovery is pending", async () => {
    let finish: ((value: typeof scan) => void) | undefined;
    mocks.discover.mockImplementationOnce(() => new Promise<typeof scan>((resolve) => { finish = resolve; }));
    const { rerender } = render(tree());
    await flush();
    expect(mocks.discover).toHaveBeenCalledTimes(1);
    const signal: AbortSignal = mocks.discover.mock.calls[0][0].signal;
    mocks.deviceId = "device-b"; mocks.user = "user-b";
    mocks.get.mockImplementation(() => new Promise(() => {}));
    rerender(tree());
    await act(async () => { finish?.(scan); });
    await flush();
    expect(signal.aborted).toBe(true);
    expect(mocks.overview).not.toHaveBeenCalled();
    expect(screen.queryByText("10.0.0.1")).not.toBeInTheDocument();
  });

  it("stops a pending discovery chain when another required read is denied", async () => {
    let finish: ((value: typeof scan) => void) | undefined;
    mocks.discover.mockImplementationOnce(() => new Promise<typeof scan>((resolve) => { finish = resolve; }));
    render(tree());
    await flush();
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((path: string) => path.endsWith("last-known") ? Promise.reject(forbidden()) : get(path));
    await act(async () => { await client.invalidateQueries({ queryKey: ["network-offline-fallback"] }); });
    await flush();
    await act(async () => { finish?.(scan); });
    await flush();
    expect(screen.getByText("Not permitted")).toBeInTheDocument();
    expect(mocks.overview).not.toHaveBeenCalled();
  });
});
