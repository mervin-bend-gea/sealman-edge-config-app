import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ColumnValueFilter from "../ColumnValueFilter";
import useDeviceStore from "../../deviceStore";

const columnValues = vi.hoisted(() => vi.fn());
vi.mock("@/generated/edge-administration/hooks/devices/useColumnValues", () => ({ default: columnValues }));

const result = (values: string[], has_more = false) => ({
  data: { values, has_more },
  isLoading: false,
  isError: false,
  error: null,
});

beforeEach(() => {
  useDeviceStore.setState({ searchChips: [], columnValueFilters: {}, globalFilter: "", columnFilters: [] });
  columnValues.mockReset();
  columnValues.mockReturnValue(result(["Berlin", "LKO", "PYRJ"]));
});

const open = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Filter City" }));

describe("ColumnValueFilter", () => {
  it("does not load anything until it is opened", () => {
    render(<ColumnValueFilter field="city" label="City" />);
    expect(columnValues).toHaveBeenLastCalledWith("city", "", false);
  });

  it("lists the column's values with checkboxes", async () => {
    const user = userEvent.setup();
    render(<ColumnValueFilter field="city" label="City" />);
    await open(user);
    expect(columnValues).toHaveBeenLastCalledWith("city", "", true);
    expect(screen.getAllByRole("checkbox").map((c) => c.parentElement?.textContent)).toEqual(["Berlin", "LKO", "PYRJ"]);
  });

  it("selects several values of the column, which marks the column as filtered", async () => {
    const user = userEvent.setup();
    render(<ColumnValueFilter field="city" label="City" />);
    await open(user);
    await user.click(screen.getByRole("checkbox", { name: "Berlin" }));
    await user.click(screen.getByRole("checkbox", { name: "LKO" }));

    expect(useDeviceStore.getState().columnValueFilters).toEqual({ city: ["Berlin", "LKO"] });
    const trigger = screen.getByRole("button", { name: "Filter City (2 selected)" });
    expect(trigger).toHaveAttribute("data-active", "true");
  });

  it("deselects a value, and removes the column filter with the last one", async () => {
    const user = userEvent.setup();
    useDeviceStore.setState({ columnValueFilters: { city: ["Berlin"] } });
    render(<ColumnValueFilter field="city" label="City" />);
    await user.click(screen.getByRole("button", { name: "Filter City (1 selected)" }));
    await user.click(screen.getByRole("checkbox", { name: "Berlin" }));
    expect(useDeviceStore.getState().columnValueFilters).toEqual({});
  });

  it("does not touch the filters of other columns or the chips", async () => {
    const user = userEvent.setup();
    useDeviceStore.setState({
      columnValueFilters: { country_code: ["IND"] },
      searchChips: [{ type: "device_id", label: "Device ID", value: "1" }],
    });
    render(<ColumnValueFilter field="city" label="City" />);
    await open(user);
    await user.click(screen.getByRole("checkbox", { name: "LKO" }));
    expect(useDeviceStore.getState().columnValueFilters).toEqual({ country_code: ["IND"], city: ["LKO"] });
    expect(useDeviceStore.getState().searchChips).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(useDeviceStore.getState().columnValueFilters).toEqual({ country_code: ["IND"] });
  });

  it("keeps selected values visible even when the list no longer contains them", async () => {
    const user = userEvent.setup();
    useDeviceStore.setState({ columnValueFilters: { city: ["Hamburg"] } });
    render(<ColumnValueFilter field="city" label="City" />);
    await user.click(screen.getByRole("button", { name: "Filter City (1 selected)" }));
    expect(screen.getByRole("checkbox", { name: "Hamburg" })).toBeChecked();
  });

  it("searches the values (debounced)", async () => {
    const user = userEvent.setup();
    render(<ColumnValueFilter field="city" label="City" />);
    await open(user);
    await user.type(screen.getByRole("textbox", { name: "Search City values" }), "ber");
    await vi.waitFor(() => expect(columnValues).toHaveBeenLastCalledWith("city", "ber", true));
  });

  it("shows the loading, empty, error and 'more values' states", async () => {
    const user = userEvent.setup();
    render(<ColumnValueFilter field="city" label="City" />);

    columnValues.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null });
    await open(user);
    expect(screen.getByText("Loading values...")).toBeInTheDocument();

    columnValues.mockReturnValue(result([]));
    await user.type(screen.getByRole("textbox", { name: "Search City values" }), "x");
    expect(await screen.findByText("No values.")).toBeInTheDocument();

    columnValues.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error("boom") });
    await user.type(screen.getByRole("textbox", { name: "Search City values" }), "y");
    expect(await screen.findByText(/Could not load values/)).toBeInTheDocument();

    columnValues.mockReturnValue(result(["Berlin"], true));
    await user.type(screen.getByRole("textbox", { name: "Search City values" }), "z");
    expect(await screen.findByText("More values exist. Search to narrow the list.")).toBeInTheDocument();
  });
});
