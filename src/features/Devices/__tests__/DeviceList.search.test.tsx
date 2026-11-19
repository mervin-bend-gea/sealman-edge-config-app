import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import DeviceList from "../DeviceList";
import useDeviceStore from "../deviceStore";

const device = (deviceId: string, city: string, country: string, connected: boolean) => ({
  deviceId,
  typeId: "default",
  deviceMetadata: {
    city: { value: city, source: "device" },
    country_code: { value: country, source: "device" },
  },
  deviceStatus: connected ? "Connected" : "Disconnected",
  iotEdgeRuntime: connected ? "Connected" : "Disconnected",
  iotHub: "",
  sems: "",
  vpn: "",
});
const DEVICES = [
  device("1230", "LKO", "IND", true),
  device("4560", "PYRJ", "CHN", false),
  device("7890", "BLR", "DE", true),
];

const searchDevices = vi.hoisted(() => vi.fn());
vi.mock("@/generated/edge-administration/hooks/devices/useSearchDevices", () => ({ default: searchDevices }));
vi.mock("@/generated/edge-administration/hooks/devices/useSearchSuggestions", () => ({
  default: () => ({ data: undefined, isFetching: false, isError: false, error: null }),
  MIN_SUGGESTION_LENGTH: 3,
}));
vi.mock("@/generated/edge-administration/hooks/devices/useColumnValues", () => ({
  default: () => ({ data: { values: ["IND", "CHN"], has_more: false }, isLoading: false, isError: false, error: null }),
}));
vi.mock("@/generated/edge-administration/hooks/useGetDevices/useGetDevices", () => ({
  default: () => ({ isLoading: false, isError: false, isSuccess: true, data: DEVICES, error: null }),
}));
vi.mock("@/features/PlatformTypes/useDeviceMetadataFields", () => ({
  default: () => ({
    fields: [
      ["city", { label: "City", required: true }],
      ["country_code", { label: "Country Code", required: true }],
    ],
    isLoading: false,
  }),
}));
vi.mock("@/features/PlatformTypes/FieldValueInput", () => ({
  formatMetadataValue: (value: unknown) => (value == null ? "" : String(value)),
}));
vi.mock("@/features/PlatformTypes/deviceTableColumnsStore", () => ({
  default: (selector: (state: { overrides: object }) => unknown) => selector({ overrides: {} }),
  defaultFieldVisible: () => true,
}));
vi.mock("../DeviceManageDialog", () => ({ default: () => null, DeleteDeviceDialog: () => null }));

const idle = { data: undefined, isFetching: false, isPlaceholderData: false, error: null };
const found = (...ids: string[]) => ({
  ...idle,
  data: {
    total: ids.length,
    items: ids.map((id) => ({
      device_id: id,
      matches: [{ kind: "metadata", fields: [{ key: "city", label: "City", value: `city-of-${id}` }] }],
    })),
  },
});

function Location() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

type StoreState = Partial<ReturnType<typeof useDeviceStore.getState>>;

/** The list resets its filters when it mounts, so `state` is applied once it is on screen. */
function renderList(state?: StoreState) {
  render(
    <MemoryRouter initialEntries={["/devices"]}>
      <DeviceList />
      <Location />
    </MemoryRouter>,
  );
  if (state) act(() => useDeviceStore.setState(state));
  // the desktop table; the mobile cards render too and are hidden by CSS
  return within(screen.getByRole("table"));
}

const enabledFlags = () => searchDevices.mock.calls.map(([, enabled]) => enabled);
const enabledRequestBodies = () => searchDevices.mock.calls.filter(([, enabled]) => enabled).map(([body]) => body);
const rowIds = (table: ReturnType<typeof within>) =>
  table.queryAllByRole("row").slice(1).map((row: HTMLElement) => within(row).queryByText(/^(1230|4560|7890)$/)?.textContent);

beforeEach(() => {
  useDeviceStore.setState({ searchChips: [], columnValueFilters: {}, globalFilter: "", columnFilters: [] });
  searchDevices.mockReset();
  searchDevices.mockReturnValue(idle);
});

describe("device list without search filters", () => {
  it("lists everything, runs no search, and keeps the quick search as it was", () => {
    const table = renderList();
    expect(rowIds(table)).toEqual(["1230", "4560", "7890"]);
    expect(enabledFlags().every((enabled) => enabled === false)).toBe(true);
    expect(screen.getByPlaceholderText("Search devices, endpoints, services")).toBeInTheDocument();
  });

  it("puts 'Add Filter' next to the status pills", () => {
    renderList();
    const pills = screen.getByRole("button", { name: /Offline/ }).parentElement!;
    expect(within(pills).getByRole("button", { name: "Add Filter" })).toBeInTheDocument();
  });

  it("puts a filter icon on the metadata columns only", () => {
    const table = renderList();
    expect(table.getByRole("button", { name: "Filter City" })).toBeInTheDocument();
    expect(table.getByRole("button", { name: "Filter Country Code" })).toBeInTheDocument();
    expect(table.getAllByRole("button", { name: /^Filter / })).toHaveLength(2);
  });

  it("still opens a device on row click", async () => {
    const user = userEvent.setup();
    const table = renderList();
    await user.click(table.getByText("4560"));
    expect(screen.getByTestId("location")).toHaveTextContent("/devices/4560");
  });
});

describe("device list with search filters", () => {
  it("sends the chips and the column filters as ONE request - the API combines them with AND", () => {
    const state: StoreState = {
      searchChips: [
        { type: "field", field: "country_code", label: "Country Code", value: "IND" },
        { type: "device_id", label: "Device ID", value: "12" },
      ],
      columnValueFilters: { city: ["LKO", "BLR"] },
    };
    searchDevices.mockReturnValue(found("1230"));
    renderList(state);
    expect(enabledRequestBodies()).toHaveLength(1);
    expect(enabledRequestBodies()[0]).toEqual({
      filters: [
        { type: "field", field: "country_code", value: "IND" },
        { type: "device_id", value: "12" },
      ],
      column_filters: [{ field: "city", values: ["LKO", "BLR"] }],
    });
    expect(enabledFlags().filter(Boolean)).toHaveLength(1);
  });

  it("lists only the devices the API matched", () => {
    const state: StoreState = { searchChips: [{ type: "field", field: "city", label: "City", value: "LKO" }] };
    searchDevices.mockReturnValue(found("1230"));
    const table = renderList(state);
    expect(rowIds(table)).toEqual(["1230"]);
  });

  it("combines the matched devices with the status filter (AND)", () => {
    const state: StoreState = {
      searchChips: [{ type: "metadata", label: "Metadata", value: "x" }],
      columnFilters: [{ id: "iotEdgeRuntime", value: "Connected" }],
    };
    searchDevices.mockReturnValue(found("1230", "4560"));
    const table = renderList(state);
    expect(rowIds(table)).toEqual(["1230"]); // 4560 matched, but is offline
  });

  it("runs a plain quick search across Device ID, Metadata, Endpoints and Services", () => {
    const state: StoreState = { globalFilter: "pump" };
    searchDevices.mockImplementation((body, enabled) => {
      if (!enabled) return idle;
      return body.filters.at(-1)?.type === "endpoint" ? found("1230") : found();
    });
    const table = renderList(state);
    expect(enabledRequestBodies().map((body) => body.filters.at(-1)?.type)).toEqual([
      "device_id", "metadata", "endpoint", "service",
    ]);
    expect(rowIds(table)).toEqual(["1230"]);
  });

  it("combines advanced chips with a broad quick search across all four categories", () => {
    const state: StoreState = {
      searchChips: [{ type: "metadata", label: "Metadata", value: "x" }],
      globalFilter: "PYRJ",
    };
    searchDevices.mockImplementation((body, enabled) => {
      if (!enabled) return idle;
      const quickType = body.filters.at(-1)?.type;
      return quickType === "metadata" ? found("4560") : found();
    });
    const table = renderList(state);
    expect(rowIds(table)).toEqual(["4560"]);
    expect(enabledFlags().filter(Boolean)).toHaveLength(4);
  });

  it("shows the empty state when nothing matches all filters", () => {
    const state: StoreState = { searchChips: [{ type: "field", field: "city", label: "City", value: "x" }] };
    searchDevices.mockReturnValue(found());
    const table = renderList(state);
    expect(table.getByText("No devices match the current filter.")).toBeInTheDocument();
  });

  it("shows the searching and the error state instead of the devices", () => {
    const state: StoreState = { searchChips: [{ type: "field", field: "city", label: "City", value: "x" }] };
    searchDevices.mockReturnValue({ ...idle, isFetching: true });
    const { unmount } = render(<MemoryRouter><DeviceList /></MemoryRouter>);
    act(() => useDeviceStore.setState(state));
    expect(within(screen.getByRole("table")).getByText("Searching...")).toBeInTheDocument();
    unmount();

    searchDevices.mockReturnValue({ ...idle, isError: true, error: new Error("boom") });
    render(<MemoryRouter><DeviceList /></MemoryRouter>);
    act(() => useDeviceStore.setState(state));
    expect(within(screen.getByRole("table")).getByText(/Search failed/)).toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByText("1230")).not.toBeInTheDocument();
  });

  it("expands a row on click to show what matched, with 'Jump to Page'", async () => {
    const user = userEvent.setup();
    const state: StoreState = { searchChips: [{ type: "metadata", label: "Metadata", value: "city" }] };
    searchDevices.mockReturnValue(found("1230"));
    const table = renderList(state);

    expect(table.queryByText("City:")).not.toBeInTheDocument();
    await user.click(table.getByText("1230"));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/devices$/); // expanded, not opened
    expect(table.getByText("City:")).toBeInTheDocument();

    await user.click(table.getByRole("button", { name: /Jump to Metadata page of device 1230/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/devices/1230/assets");
  });

  it("jumps to the Assets page, naming the endpoint to flash", async () => {
    const user = userEvent.setup();
    const state: StoreState = { searchChips: [{ type: "endpoint", label: "Endpoints", value: "press" }] };
    searchDevices.mockReturnValue({
      ...idle,
      data: {
        total: 1,
        items: [
          {
            device_id: "1230",
            matches: [
              {
                kind: "endpoint",
                endpoint_id: "e1",
                endpoint_name: "Press",
                type_label: "Machine 1",
                fields: [{ key: "name", label: "Name", value: "Press" }],
              },
            ],
          },
        ],
      },
    });
    const table = renderList(state);
    await user.click(table.getByText("1230"));
    await user.click(table.getByRole("button", { name: /Jump to Endpoint page/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/devices/1230/assets?highlight=e1");
  });

  it("with only column filters, rows still open the device on click", async () => {
    const user = userEvent.setup();
    const state: StoreState = { columnValueFilters: { city: ["LKO"] } };
    searchDevices.mockReturnValue({ ...idle, data: { total: 1, items: [{ device_id: "1230", matches: [] }] } });
    const table = renderList(state);
    expect(rowIds(table)).toEqual(["1230"]);
    await user.click(table.getByText("1230"));
    expect(screen.getByTestId("location")).toHaveTextContent("/devices/1230");
  });

  it("'Clear All Filters' restores the full list", async () => {
    const user = userEvent.setup();
    const state: StoreState = { searchChips: [{ type: "field", field: "city", label: "City", value: "LKO" }] };
    searchDevices.mockImplementation((_body, enabled) => (enabled ? found("1230") : idle));
    const table = renderList(state);
    expect(rowIds(table)).toEqual(["1230"]);

    await user.click(screen.getAllByRole("button", { name: "Clear All Filters" })[0]);
    expect(rowIds(table)).toEqual(["1230", "4560", "7890"]);
  });

  it("adding a chip, a column filter or a status filter never resets the others", async () => {
    const user = userEvent.setup();
    searchDevices.mockImplementation((_body, enabled) => (enabled ? found("1230", "4560") : idle));
    const table = renderList();

    await user.click(table.getByRole("button", { name: "Filter Country Code" }));
    await user.click(screen.getByRole("checkbox", { name: "IND" }));
    await user.click(screen.getAllByRole("button", { name: /Add Filter/ })[0]);
    await user.click(screen.getByRole("menuitem", { name: "City" }));
    await user.type(screen.getByRole("combobox", { name: "City value" }), "LKO{Enter}");
    await user.click(screen.getByRole("button", { name: /Offline/ }));

    const state = useDeviceStore.getState();
    expect(state.columnValueFilters).toEqual({ country_code: ["IND"] });
    expect(state.searchChips).toHaveLength(1);
    expect(state.columnFilters).toEqual([{ id: "iotEdgeRuntime", value: "Disconnected" }]);
    expect(rowIds(table)).toEqual(["4560"]);
  });
});
