import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import useDeviceStore from "../../deviceStore";
import DeviceSearchBar from "../DeviceSearchBar";
import DeviceMatchList from "../DeviceMatchList";
import type { DeviceSearchMatch } from "@/generated/edge-administration/hooks/devices/useSearchDevices";

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

const matches: DeviceSearchMatch[] = [
  { kind: "device_id", fields: [{ key: "device_id", label: "Device ID", value: "1230" }] },
  { kind: "metadata", fields: [{ key: "city", label: "City", value: "LKO" }] },
  {
    kind: "endpoint",
    endpoint_id: "e1",
    endpoint_name: "My test Machine 1",
    type_label: "Machine 1",
    fields: [{ key: "name", label: "Name", value: "My test Machine 1" }],
  },
  {
    kind: "service",
    endpoint_id: "e1",
    endpoint_name: "My test Machine 1",
    service_id: "s1",
    type_label: "OPC UA",
    fields: [{ label: "Type", value: "OPC UA" }],
  },
];

describe("DeviceMatchList", () => {
  const renderList = () =>
    render(
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes>
          <Route path="*" element={<><DeviceMatchList deviceId="1230" matches={matches} term="machine" /><Where /></>} />
        </Routes>
      </MemoryRouter>,
    );

  it("shows what matched and highlights the term", () => {
    renderList();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByText("Mach", { exact: false }).length).toBeGreaterThan(0);
    expect(document.querySelectorAll("mark").length).toBeGreaterThan(0);
    expect(screen.getByText("OPC UA on My test Machine 1")).toBeTruthy();
  });

  it.each([
    ["Jump to Device ID page of device 1230", "/devices/1230"],
    ["Jump to Metadata page of device 1230", "/devices/1230"],
    ["Jump to Endpoint page of device 1230", "/devices/1230/assets?highlight=e1"],
    ["Jump to Service page of device 1230", "/devices/1230/assets?highlight=e1"],
  ])("%s navigates to %s", async (label, target) => {
    renderList();
    await userEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByTestId("where").textContent).toBe(target);
  });
});

describe("DeviceSearchBar", () => {
  beforeEach(() => {
    useDeviceStore.setState({ searchFilters: [], globalFilter: "" });
  });
  const renderBar = () => render(<DeviceSearchBar />);

  it("is the plain quick search while no filter is selected", () => {
    renderBar();
    expect(screen.getByPlaceholderText("Search device ID or metadata")).toBeTruthy();
    expect(screen.queryByTestId("search-chip-metadata")).toBeNull();
  });

  it("adds a removable chip per selected filter, in a fixed order", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Select search filters" }));
    await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Services" }));
    await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Metadata" }));
    expect(useDeviceStore.getState().searchFilters).toEqual(["metadata", "service"]);
    expect(screen.getByTestId("search-chip-metadata")).toBeTruthy();
    expect(screen.getByTestId("search-chip-service")).toBeTruthy();

    fireEvent.keyDown(document.body, { key: "Escape" });
    await userEvent.click(screen.getByRole("button", { name: "Remove Metadata filter" }));
    expect(useDeviceStore.getState().searchFilters).toEqual(["service"]);
    expect(screen.queryByTestId("search-chip-metadata")).toBeNull();
  });

  it("removes the last chip with Backspace in an empty box", async () => {
    useDeviceStore.setState({ searchFilters: ["metadata", "endpoint"] });
    renderBar();
    await userEvent.type(screen.getByRole("textbox"), "{Backspace}");
    expect(useDeviceStore.getState().searchFilters).toEqual(["metadata"]);
  });

  it("stores the typed text for the search", async () => {
    renderBar();
    await userEvent.type(screen.getByRole("textbox"), "LKO{Enter}");
    expect(useDeviceStore.getState().globalFilter).toBe("LKO");
  });
});
