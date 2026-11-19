import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import DeviceList from "../DeviceList";
import useDeviceStore from "../deviceStore";

const mocks = vi.hoisted(() => ({ search: vi.fn() }));

const device = (deviceId: string, city: string) => ({
  deviceId, typeId: "default", deviceStatus: "Disconnected", iotEdgeRuntime: "Disconnected", iotHub: "x", sems: "x", vpn: "x",
  deviceMetadata: { city: { value: city, source: "device" } },
});
const devices = [device("1230", "LKO"), device("4560", "PYRJ"), device("7890", "BLR")];

vi.mock("@/generated/edge-administration/hooks/useGetDevices/useGetDevices", () => ({
  default: () => ({ isLoading: false, isError: false, isSuccess: true, data: devices }),
}));
vi.mock("@/features/PlatformTypes/useDeviceMetadataFields", () => ({ default: () => ({ fields: [] }) }));
vi.mock("../DeviceManageDialog", () => ({ default: () => null, DeleteDeviceDialog: () => null }));
vi.mock("@/generated/edge-administration/hooks/devices/useSearchDevices", () => ({ default: (...args: unknown[]) => mocks.search(...args) }));

const result = (over: object = {}) => ({ data: undefined, error: null, isFetching: false, isPlaceholderData: false, ...over });
// DeviceList resets the store when it mounts, so test state is applied after rendering.
const renderList = (state: object = {}) => {
  render(<MemoryRouter><DeviceList /></MemoryRouter>);
  act(() => useDeviceStore.setState(state));
};
// the desktop table and the mobile cards both render (a CSS container query picks one)
const searchBox = () => screen.getAllByRole("textbox")[0];
const visibleRows = () => screen.queryAllByRole("row").filter((r) => within(r).queryByText(/^(1230|4560|7890)$/));

describe("DeviceList advanced search", () => {
  beforeEach(() => {
    mocks.search.mockReset().mockReturnValue(result());
    useDeviceStore.setState({ searchFilters: [], globalFilter: "", columnFilters: [] });
  });

  it("without chips keeps the in-browser quick search on device id and metadata", async () => {
    renderList();
    expect(visibleRows()).toHaveLength(3);
    await userEvent.type(searchBox(), "pyrj{Enter}");
    expect(visibleRows()).toHaveLength(1);
    expect(visibleRows()[0].textContent).toContain("4560");
    // the API is only called with a selected filter and a term
    expect(mocks.search).toHaveBeenLastCalledWith("", []);
  });

  it("with chips lists only the devices the API matched and expands each to show why", async () => {
    mocks.search.mockReturnValue(
      result({
        data: {
          total: 1,
          items: [{
            device_id: "7890",
            matches: [{ kind: "endpoint", endpoint_id: "e3", endpoint_name: "Other", type_label: "Machine 1", fields: [{ key: "ip", label: "IP Address", value: "3.3.3.3" }] }],
          }],
        },
      }),
    );
    renderList({ searchFilters: ["endpoint"], globalFilter: "3.3.3" });

    expect(mocks.search).toHaveBeenLastCalledWith("3.3.3", ["endpoint"]);
    expect(visibleRows()).toHaveLength(1);
    expect(screen.getAllByText("1 match")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Jump to/ })).toBeNull();

    await userEvent.click(visibleRows()[0]);
    expect(screen.getByText("IP Address:")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Jump to Endpoint page of device 7890" })).toBeTruthy();

    await userEvent.click(visibleRows()[0]);
    expect(screen.queryByRole("button", { name: /Jump to/ })).toBeNull();
  });

  it("shows the empty state when nothing matches", () => {
    mocks.search.mockReturnValue(result({ data: { total: 0, items: [] } }));
    renderList({ searchFilters: ["metadata"], globalFilter: "zzz" });
    expect(visibleRows()).toHaveLength(0);
    expect(screen.getByText("No devices match the current filter.")).toBeTruthy();
  });

  it("shows the API error, e.g. a missing permission, instead of results", () => {
    mocks.search.mockReturnValue(result({ error: Object.assign(new Error("No role grants permission 'device.endpoint.read'"), { statusCode: 403 }) }));
    renderList({ searchFilters: ["endpoint"], globalFilter: "x" });
    expect(visibleRows()).toHaveLength(0);
    expect(screen.getByText(/Search failed: No role grants permission/)).toBeTruthy();
  });

  it("shows a loading state while the first results load", () => {
    mocks.search.mockReturnValue(result({ isFetching: true }));
    renderList({ searchFilters: ["metadata"], globalFilter: "lko" });
    expect(screen.getByText("Searching...")).toBeTruthy();
  });
});
