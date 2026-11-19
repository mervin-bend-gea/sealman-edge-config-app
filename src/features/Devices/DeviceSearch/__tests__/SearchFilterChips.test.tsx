import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchFilterChips from "../SearchFilterChips";
import useDeviceStore from "../../deviceStore";

const suggestions = vi.hoisted(() => vi.fn());
vi.mock("@/generated/edge-administration/hooks/devices/useSearchSuggestions", () => ({
  default: suggestions,
  MIN_SUGGESTION_LENGTH: 3,
}));
vi.mock("@/generated/edge-administration/hooks/devices/useSearchKeys", () => ({
  default: (_type: string, query: string) => ({
    data: {
      keys: [
        { key: "serial", label: "Serial Number" },
        { key: "ip", label: "ip" },
      ].filter((item) => item.key.includes(query) || item.label.toLowerCase().includes(query.toLowerCase())),
      has_more: query === "capped",
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));
vi.mock("@/features/PlatformTypes/useDeviceMetadataFields", () => ({
  default: () => ({
    fields: [
      ["country_code", { label: "Country Code", required: true }],
      ["city", { label: "City", required: true }],
    ],
    isLoading: false,
  }),
}));

const result = (values: string[]) => ({ data: { values, has_more: false }, isFetching: false, isError: false, error: null });

beforeEach(() => {
  useDeviceStore.setState({ searchChips: [], columnValueFilters: {}, globalFilter: "", columnFilters: [] });
  suggestions.mockReset();
  suggestions.mockReturnValue(result(["Berlin", "Bergen"]));
});

async function openValueStep(user: ReturnType<typeof userEvent.setup>, parameter: string) {
  await user.click(screen.getByRole("button", { name: /apply filters|add filter/i }));
  await user.click(screen.getByRole("menuitem", { name: parameter }));
  return screen.getByRole("combobox", { name: `${parameter} value` });
}

describe("Add Filter", () => {
  it("lists what can be filtered on", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Device ID",
      "Country Code",
      "City",
      "Endpoints",
      "Services",
    ]);
  });

  it("marks Endpoints and Services as opening more options", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(screen.getByRole("menuitem", { name: "Endpoints" })).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.getByRole("menuitem", { name: "Services" })).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.getByRole("menuitem", { name: "City" })).not.toHaveAttribute("aria-haspopup");
  });

  it("narrows the field list down by typing and says when it is capped", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    await user.click(screen.getByRole("menuitem", { name: "Endpoints" }));
    await user.type(screen.getByRole("textbox", { name: "Find a Endpoints field" }), "numb");
    await waitFor(() => expect(screen.getAllByRole("menuitem")).toHaveLength(2));
    expect(screen.getByRole("menuitem", { name: /Serial Number/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "ip" })).not.toBeInTheDocument();

    await user.clear(screen.getByRole("textbox", { name: "Find a Endpoints field" }));
    await user.type(screen.getByRole("textbox", { name: "Find a Endpoints field" }), "capped");
    expect(await screen.findByText(/most used fields - type to narrow down/)).toBeInTheDocument();
  });

  it("asks for a value and hints at the 3 character minimum - no suggestions before that", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    const input = await openValueStep(user, "City");
    expect(screen.getByText("Type at least 3 characters to see matching suggestions.")).toBeInTheDocument();

    await user.type(input, "be");
    expect(screen.getByText("Type at least 3 characters to see matching suggestions.")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.type(input, "r");
    expect(await screen.findByRole("listbox", { name: "Suggestions" })).toBeInTheDocument();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Berlin", "Bergen"]);
    expect(screen.queryByText(/Type at least 3 characters/)).not.toBeInTheDocument();
  });

  it("asks for suggestions of the chosen field, with the debounced text", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    const input = await openValueStep(user, "City");
    await user.type(input, "ber");
    await screen.findByRole("listbox");
    expect(suggestions).toHaveBeenLastCalledWith("field", "city", "ber");
    // while typing, the text it has not settled on yet is never requested
    expect(suggestions.mock.calls.some(([, , query]) => query === "b" || query === "be")).toBe(false);
  });

  it("turns a chosen suggestion into a chip, closes, and then offers '+ Add Filter'", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    const input = await openValueStep(user, "City");
    await user.type(input, "ber");
    await user.click(await screen.findByRole("option", { name: "Berlin" }));

    expect(screen.getByText("City: Berlin")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Filter" })).toBeInTheDocument();
    expect(useDeviceStore.getState().searchChips).toEqual([
      { type: "field", field: "city", label: "City", value: "Berlin" },
    ]);
  });

  it("accepts a custom value with Enter, also with fewer than 3 characters", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    const input = await openValueStep(user, "Country Code");
    await user.type(input, "DE{Enter}");
    expect(screen.getByText("Country Code: DE")).toBeInTheDocument();
  });

  it("picks a suggestion with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    const input = await openValueStep(user, "City");
    await user.type(input, "ber");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(screen.getByText("City: Bergen")).toBeInTheDocument();
  });

  it("shows the empty and the error state of the suggestions", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    suggestions.mockReturnValue(result([]));
    const input = await openValueStep(user, "City");
    await user.type(input, "zzz");
    expect(await screen.findByText("No matching suggestions.")).toBeInTheDocument();

    suggestions.mockReturnValue({ data: undefined, isFetching: false, isError: true, error: new Error("boom") });
    await user.type(input, "z");
    expect(await screen.findByText(/Could not load suggestions/)).toBeInTheDocument();
  });

  it("says how the value is matched", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    await openValueStep(user, "City");
    expect(screen.getByText("Matches the whole value, ignoring case.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to filter list" }));
    await user.click(screen.getByRole("menuitem", { name: "Endpoints" }));
    await user.click(screen.getByRole("menuitem", { name: "Any field" }));
    expect(screen.getByText("Matches values containing the text.")).toBeInTheDocument();
  });

  it("lets you pick a field of the endpoints and searches that field only", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    await user.click(screen.getByRole("menuitem", { name: "Endpoints" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Any field",
      "Serial Numberserial",
      "ip",
    ]);
    await user.click(screen.getByRole("menuitem", { name: /Serial Number/ }));

    const input = screen.getByRole("combobox", { name: "Endpoints \u203a Serial Number value" });
    await user.type(input, "123456{Enter}");
    expect(suggestions).toHaveBeenCalledWith("endpoint", "serial", expect.any(String));
    expect(screen.getByText("Endpoints \u203a Serial Number: 123456")).toBeInTheDocument();
    expect(useDeviceStore.getState().searchChips).toEqual([
      { type: "endpoint", field: "serial", label: "Endpoints \u203a Serial Number", value: "123456" },
    ]);
  });

  it("goes back from the value to the field list", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    await user.click(screen.getByRole("menuitem", { name: "Services" }));
    await user.click(screen.getByRole("menuitem", { name: "Any field" }));
    await user.click(screen.getByRole("button", { name: "Back to filter list" }));
    expect(screen.getByRole("menuitem", { name: "Any field" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to filter list" }));
    expect(screen.getByRole("menuitem", { name: "Device ID" })).toBeInTheDocument();
  });

  it("does not add the same filter twice", async () => {
    const user = userEvent.setup();
    render(<SearchFilterChips />);
    for (const value of ["Berlin", "berlin"]) {
      const input = await openValueStep(user, "City");
      await user.type(input, `${value}{Enter}`);
    }
    expect(useDeviceStore.getState().searchChips).toHaveLength(1);
  });
});

describe("filter chips", () => {
  const chips = [
    { type: "field", field: "country_code", label: "Country Code", value: "IND" },
    { type: "field", field: "city", label: "City", value: "Berlin" },
    { type: "device_id", label: "Device ID", value: "ABC123" },
  ] as const;

  it("shows each chip with its parameter and value, and removes them independently", async () => {
    const user = userEvent.setup();
    useDeviceStore.setState({ searchChips: [...chips] });
    render(<SearchFilterChips />);
    expect(screen.getByText("Country Code: IND")).toBeInTheDocument();
    expect(screen.getByText("City: Berlin")).toBeInTheDocument();
    expect(screen.getByText("Device ID: ABC123")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove filter City: Berlin" }));
    expect(screen.queryByText("City: Berlin")).not.toBeInTheDocument();
    expect(screen.getByText("Country Code: IND")).toBeInTheDocument();
    expect(screen.getByText("Device ID: ABC123")).toBeInTheDocument();
  });

  it("offers 'Add Filter' with none and '+ Add Filter' once any filter is applied - also a column filter", () => {
    const { unmount } = render(<SearchFilterChips />);
    expect(screen.getByRole("button", { name: "Apply Filters" })).toBeInTheDocument();
    unmount();

    useDeviceStore.setState({ columnValueFilters: { city: ["Berlin"] } });
    render(<SearchFilterChips />);
    expect(screen.getByRole("button", { name: "Add Filter" })).toBeInTheDocument();
  });

  it("shows 'Clear All Filters' only when there is something to clear", () => {
    const { unmount } = render(<SearchFilterChips />);
    expect(screen.queryByRole("button", { name: "Clear All Filters" })).not.toBeInTheDocument();
    unmount();

    useDeviceStore.setState({ globalFilter: "abc" });
    render(<SearchFilterChips />);
    expect(screen.getByRole("button", { name: "Clear All Filters" })).toBeInTheDocument();
  });

  it("'Clear All Filters' removes chips, column filters and the quick search - but not the status filter", async () => {
    const user = userEvent.setup();
    useDeviceStore.setState({
      searchChips: [...chips],
      columnValueFilters: { city: ["Berlin"] },
      globalFilter: "abc",
      columnFilters: [{ id: "iotEdgeRuntime", value: "Disconnected" }],
    });
    render(<SearchFilterChips />);
    await user.click(screen.getByRole("button", { name: "Clear All Filters" }));

    const state = useDeviceStore.getState();
    expect(state.searchChips).toEqual([]);
    expect(state.columnValueFilters).toEqual({});
    expect(state.globalFilter).toBe("");
    expect(state.columnFilters).toEqual([{ id: "iotEdgeRuntime", value: "Disconnected" }]);
    expect(within(document.body).queryByText("City: Berlin")).not.toBeInTheDocument();
  });
});
