import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeviceList from "./DeviceList";

const mocks = vi.hoisted(() => ({
  getDeviceManagementPermissions: vi.fn(),
  getPermissions: vi.fn(),
  devices: [
    { deviceId: "device-1", iotEdgeRuntime: "Connected", deviceMetadata: {} },
    { deviceId: "device-2", iotEdgeRuntime: "Disconnected", deviceMetadata: {} },
  ],
}));

vi.mock("@/auth", () => ({ useAuth: () => ({ isAuthenticated: true, user: { iss: "test", sub: "user-1" } }) }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApi: mocks }));
vi.mock("@/generated/edge-administration/hooks/device_types/useGetDeviceTypes", () => ({
  default: () => ({ data: [], refetch: vi.fn() }),
}));
vi.mock("@/generated/edge-administration/hooks/useGetDevices/useGetDevices", () => ({
  default: () => ({
    isLoading: false,
    isError: false,
    data: mocks.devices,
  }),
}));
vi.mock("@/features/PlatformTypes/useDeviceMetadataFields", () => ({ default: () => ({ fields: [] }) }));
vi.mock("./DevicesHeader", () => ({ default: () => null, DeviceOnlineFilterStatus: { All: "ALL", Online: "ONLINE", Offline: "OFFLINE" } }));

describe("device list delete permissions", () => {
  beforeEach(() => {
    mocks.getDeviceManagementPermissions.mockReset().mockResolvedValue({ can_create: true, deletable_device_ids: ["device-1"] });
    mocks.getPermissions.mockReset();
    mocks.devices = [
      { deviceId: "device-1", iotEdgeRuntime: "Connected", deviceMetadata: {} },
      { deviceId: "device-2", iotEdgeRuntime: "Disconnected", deviceMetadata: {} },
    ];
  });

  it("uses one bulk response to show only authorized delete buttons", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><MemoryRouter><DeviceList /></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete device device-1" })).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: "Add Device" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Delete device device-2" })).not.toBeInTheDocument();
    expect(mocks.getDeviceManagementPermissions).toHaveBeenCalledTimes(1);
    expect(mocks.getDeviceManagementPermissions).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mocks.getPermissions).not.toHaveBeenCalled();

    view.unmount();
    client.clear();
  });

  it("allows creation on an empty device list", async () => {
    mocks.devices = [];
    mocks.getDeviceManagementPermissions.mockResolvedValue({ can_create: true, deletable_device_ids: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><MemoryRouter><DeviceList /></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(screen.getAllByRole("button", { name: "Add Device" })).toHaveLength(2));
    expect(mocks.getDeviceManagementPermissions).toHaveBeenCalledTimes(1);
    expect(mocks.getDeviceManagementPermissions).toHaveBeenCalledWith(expect.any(AbortSignal));

    view.unmount();
    client.clear();
  });
});