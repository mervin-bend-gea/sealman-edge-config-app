import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeviceManagementPermissions } from "./use-device-management-permissions";

const mocks = vi.hoisted(() => ({ user: "user-a", authenticated: true, getPermissions: vi.fn() }));
vi.mock("@/auth", () => ({ useAuth: () => ({ isAuthenticated: mocks.authenticated, user: { sub: mocks.user, iss: "test" } }) }));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApi: { getDeviceManagementPermissions: mocks.getPermissions } }));

describe("device management permissions", () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.user = "user-a";
    mocks.authenticated = true;
    mocks.getPermissions.mockReset().mockResolvedValue({ can_create: true, deletable_device_ids: ["device-1"] });
  });

  afterEach(() => { client.clear(); });

  it("requests all device permissions together", async () => {
    const { result } = renderHook(() => useDeviceManagementPermissions(true), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ can_create: true, deletable_device_ids: ["device-1"] }));
    expect(mocks.getPermissions).toHaveBeenCalledTimes(1);
    expect(mocks.getPermissions).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("does not reuse another user's grants", async () => {
    const { result, rerender } = renderHook(() => useDeviceManagementPermissions(true), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ can_create: true, deletable_device_ids: ["device-1"] }));
    mocks.user = "user-b";
    mocks.getPermissions.mockImplementation(() => new Promise(() => {}));
    rerender();
    expect(result.current).toBeUndefined();
  });

  it("clears grants when a refresh fails", async () => {
    const { result } = renderHook(() => useDeviceManagementPermissions(true), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ can_create: true, deletable_device_ids: ["device-1"] }));
    mocks.getPermissions.mockRejectedValue(new Error("Permission lookup failed"));
    await act(async () => { await client.invalidateQueries(); });
    await waitFor(() => expect(result.current).toBeUndefined());
  });

  it("requests create permission for an empty device list", async () => {
    const { result } = renderHook(() => useDeviceManagementPermissions(true), { wrapper });
    await waitFor(() => expect(result.current?.can_create).toBe(true));
    expect(mocks.getPermissions).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("waits for the device list to load", () => {
    const { result } = renderHook(() => useDeviceManagementPermissions(false), { wrapper });
    expect(result.current).toBeUndefined();
    expect(mocks.getPermissions).not.toHaveBeenCalled();
  });
});