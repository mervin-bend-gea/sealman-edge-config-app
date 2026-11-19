import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DeviceManageDialog, { DeleteDeviceButton, DeleteDeviceDialog } from "./DeviceManageDialog";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";

const mocks = vi.hoisted(() => ({ invalidateQueries: vi.fn(), deleteDevice: vi.fn() }));

vi.mock("@/features/authorization/permissions/use-permissions", () => ({
  usePermissions: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock("@/generated/edge-administration/hooks/device_types/useGetDeviceTypes", () => ({
  default: () => ({ data: [], refetch: vi.fn() }),
}));
vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({ edgeConfigApi: { deleteDevice: mocks.deleteDevice } }));

describe("device management permissions", () => {
  beforeEach(() => {
    vi.mocked(usePermissions).mockReset();
    mocks.invalidateQueries.mockReset();
    mocks.deleteDevice.mockReset().mockResolvedValue(undefined);
  });

  it.each([false, true])("only shows Add Device when create is granted: %s", (hasPermission) => {
    render(<DeviceManageDialog canCreate={hasPermission} />);

    expect(usePermissions).not.toHaveBeenCalled();
    const button = screen.queryByRole("button", { name: "Add Device" });
    if (hasPermission) expect(button).toBeInTheDocument();
    else expect(button).not.toBeInTheDocument();
  });

  it.each([false, true])("only shows delete when the device capability allows it: %s", (canDelete) => {
    render(<DeleteDeviceButton deviceId="device-123" canDelete={canDelete} onDelete={vi.fn()} />);

    expect(usePermissions).not.toHaveBeenCalled();
    const button = screen.queryByRole("button", { name: "Delete device device-123" });
    if (canDelete) expect(button).toBeInTheDocument();
    else expect(button).not.toBeInTheDocument();
  });

  it("hides both actions while permissions are loading or unavailable", () => {
    vi.mocked(usePermissions).mockReturnValue({ hasPermission: false, isLoading: true });
    const { rerender } = render(<><DeviceManageDialog canCreate={false} /><DeleteDeviceButton deviceId="device-123" canDelete={false} onDelete={vi.fn()} /></>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    vi.mocked(usePermissions).mockReturnValue({ hasPermission: false, isError: true });
    rerender(<><DeviceManageDialog canCreate={false} /><DeleteDeviceButton deviceId="device-123" canDelete={false} onDelete={vi.fn()} /></>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("refreshes management permissions after deleting a device", async () => {
    render(<DeleteDeviceDialog deviceId="device-123" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mocks.deleteDevice).toHaveBeenCalledWith("device-123"));
    await waitFor(() => expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["permissions", "device-management"] }));
  });
});