import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import EndpointActions from "../EndpointActions";

vi.mock("@/features/authorization/permissions/use-permissions", () => ({
  usePermissions: vi.fn(),
}));

describe("EndpointActions", () => {
  beforeEach(() => {
    vi.mocked(usePermissions).mockReset();
  });

  it("disables Add Endpoint without device-scoped endpoint write permission", () => {
    vi.mocked(usePermissions).mockReturnValue({ hasPermission: false });
    const onAddEndpoint = vi.fn();
    render(<EndpointActions deviceId="device-a" onScan={vi.fn()} isScanning={false} onAddEndpoint={onAddEndpoint} />);

    expect(usePermissions).toHaveBeenCalledWith({ deviceId: "device-a", permissionKey: "device.endpoint.write" });
    const button = screen.getByRole("button", { name: "Add Endpoint" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onAddEndpoint).not.toHaveBeenCalled();
  });

  it("allows Add Endpoint with write permission even when discovery is denied", () => {
    vi.mocked(usePermissions).mockReturnValue({ hasPermission: true });
    const onAddEndpoint = vi.fn();
    render(<EndpointActions deviceId="device-a" onScan={vi.fn()} isScanning={false} scanDisabled onAddEndpoint={onAddEndpoint} />);

    expect(screen.getByRole("button", { name: "Scan Network" })).toBeDisabled();
    const button = screen.getByRole("button", { name: "Add Endpoint" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onAddEndpoint).toHaveBeenCalledTimes(1);
  });

  it("does not offer Scan Network while the network scan is disabled platform-wide", () => {
    vi.mocked(usePermissions).mockReturnValue({ hasPermission: true });
    render(<EndpointActions deviceId="device-a" onScan={vi.fn()} isScanning={false} scanAvailable={false} onAddEndpoint={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Scan Network" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Endpoint" })).toBeEnabled();
  });
});
