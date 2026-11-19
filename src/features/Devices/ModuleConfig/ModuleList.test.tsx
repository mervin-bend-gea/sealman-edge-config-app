import { act, fireEvent, render, screen } from "@testing-library/react";
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModuleList from "./ModuleList";
import { queryClient } from "@/config/queryConfig";

const mocks = vi.hoisted(() => ({
  deviceId: "device-a",
  user: "user-a",
  getModules: vi.fn(),
  getConfigStatus: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@/auth", () => ({ useAuth: () => ({ isAuthenticated: true, user: { sub: mocks.user } }) }));
vi.mock("react-router-dom", () => ({ useParams: () => ({ deviceId: mocks.deviceId }), useNavigate: () => mocks.navigate }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApi: { getModules: mocks.getModules, getConfigStatus: mocks.getConfigStatus } }));

describe("Applications config-status denials", () => {
  let client: QueryClient;
  const tree = () => <QueryClientProvider client={client}><ModuleList /></QueryClientProvider>;
  const flush = async (ms = 50) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.deviceId = "device-a";
    mocks.user = "user-a";
    mocks.getModules.mockReset().mockResolvedValue([
      { moduleId: "$edgeAgent", moduleName: "$edgeAgent" },
      { moduleId: "$edgeHub", moduleName: "$edgeHub" },
    ]);
    mocks.getConfigStatus.mockReset().mockResolvedValue({});
    mocks.navigate.mockReset();
    client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  });
  afterEach(() => { client.clear(); vi.useRealTimers(); });

  it.each([400, 403])("stops HTTP %s polling and automatic refetches until explicit retry", async (status) => {
    render(tree());
    await flush();
    expect(mocks.getConfigStatus).toHaveBeenCalledWith(
      "device-a", { modules: ["$edgeAgent", "$edgeHub"] }, expect.any(AbortSignal),
    );
    const error = new AxiosError("Invalid input or denied");
    Object.defineProperty(error, "response", { value: { status } });
    mocks.getConfigStatus.mockRejectedValue(error);
    await flush(5000);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "$edgeAgent" })).not.toBeInTheDocument();
    const calls = mocks.getConfigStatus.mock.calls.length;
    await act(async () => {
      focusManager.setFocused(false); focusManager.setFocused(true);
      onlineManager.setOnline(false); onlineManager.setOnline(true);
      await client.invalidateQueries();
    });
    await flush(15000);
    expect(mocks.getConfigStatus).toHaveBeenCalledTimes(calls);
    mocks.getConfigStatus.mockResolvedValue({});
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await flush();
    expect(screen.getByRole("cell", { name: "$edgeAgent" })).toBeInTheDocument();
    await flush(5000);
    expect(mocks.getConfigStatus.mock.calls.length).toBeGreaterThan(calls + 1);
  });

  it("restarts for corrected module IDs, not ordinary module-status changes", async () => {
    mocks.getConfigStatus.mockRejectedValue(Object.assign(new Error("Invalid module ID"), { statusCode: 400 }));
    render(tree());
    await flush();
    const calls = mocks.getConfigStatus.mock.calls.length;
    mocks.getModules.mockResolvedValue([{ moduleId: "$edgeAgent", moduleName: "$edgeAgent", status: "running" }, { moduleId: "$edgeHub", moduleName: "$edgeHub" }]);
    await flush(8000);
    expect(mocks.getConfigStatus).toHaveBeenCalledTimes(calls);
    mocks.getModules.mockResolvedValue([{ moduleId: "corrected-id", moduleName: "corrected" }]);
    mocks.getConfigStatus.mockResolvedValue({});
    await flush(8000);
    expect(screen.getByRole("cell", { name: "corrected" })).toBeInTheDocument();
  });

  it("isolates device/account changes and aborts old config requests", async () => {
    let oldSignal: AbortSignal | undefined;
    mocks.getConfigStatus.mockImplementation((_device, _body, signal: AbortSignal) => {
      oldSignal = signal;
      return new Promise(() => {});
    });
    const { rerender } = render(tree());
    await flush();
    const signal = oldSignal;
    mocks.user = "user-b";
    mocks.deviceId = "device-b";
    mocks.getModules.mockResolvedValue([{ moduleId: "new-module", moduleName: "new module" }]);
    mocks.getConfigStatus.mockResolvedValue({});
    rerender(tree());
    await flush();
    expect(signal?.aborted).toBe(true);
    expect(screen.getByRole("cell", { name: "new module" })).toBeInTheDocument();
    expect(screen.queryByText("$edgeAgent")).not.toBeInTheDocument();
  });

  it("opens a module's own page on click and on Enter instead of a dialog", async () => {
    mocks.getModules.mockResolvedValue([{ moduleId: "seal-opcua-client", moduleName: "seal-opcua-client" }]);
    render(tree());
    await flush();
    const row = screen.getByRole("cell", { name: "seal-opcua-client" }).closest("tr")!;
    fireEvent.click(row);
    expect(mocks.navigate).toHaveBeenLastCalledWith("/devices/device-a/applications/seal-opcua-client");
    fireEvent.keyDown(row, { key: "Enter" });
    expect(mocks.navigate).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("encodes module IDs that are not URL-safe", async () => {
    render(tree());
    await flush();
    fireEvent.click(screen.getByRole("cell", { name: "$edgeAgent" }).closest("tr")!);
    expect(mocks.navigate).toHaveBeenLastCalledWith("/devices/device-a/applications/%24edgeAgent");
  });
});
