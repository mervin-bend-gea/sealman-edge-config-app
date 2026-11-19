import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReassignEndpointDialog from "../ReassignEndpointDialog";

const mocks = vi.hoisted(() => {
  const STRING = { type: "string", ui: "input", required: false, changeable: true, show_in_list: true, default: null };
  return {
    STRING,
    // Stable reference: building a new array per mock call causes an infinite render loop.
    types: [
      { type_id: "plc", label: "PLC", description: null, fields: { addr: { ...STRING, label: "Address" }, serial: { ...STRING, label: "Serial" } }, mapping: { addr: "ip" } },
      {
        type_id: "sensor",
        label: "Sensor",
        description: null,
        fields: { serial: { ...STRING, label: "Serial", required: true, default: "UNKNOWN" }, location: { ...STRING, label: "Location" } },
        mapping: {},
      },
    ] as unknown[],
    updateEndpoint: vi.fn(),
  };
});

vi.mock("@/generated/edge-administration/hooks/endpoint_types/useGetEndpointTypes", () => ({
  default: () => ({ data: mocks.types }),
}));
vi.mock("@/generated/edge-administration/hooks/endpoints/useUpdateEndpoint", () => ({
  useUpdateEndpoint: () => ({ updateEndpoint: mocks.updateEndpoint, isPending: false }),
}));

const CURRENT_DATA = {
  addr: { value: "10.0.0.1", field: { ...mocks.STRING, label: "Address" } },
  serial: { value: "S-1", field: { ...mocks.STRING, label: "Serial" } },
  note: { value: "keep me", field: null },
} as never;

function renderDialog() {
  const onReassigned = vi.fn();
  render(
    <ReassignEndpointDialog
      open
      onOpenChange={() => {}}
      endpointId="e1"
      currentTypeId="plc"
      currentData={CURRENT_DATA}
      onReassigned={onReassigned}
    />
  );
  return onReassigned;
}

describe("ReassignEndpointDialog", () => {
  async function selectType(label: string) {
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: label }));
  }

  beforeEach(() => {
    mocks.updateEndpoint.mockReset().mockResolvedValue(undefined);
  });

  it("keeps the stored value instead of the new type's default", async () => {
    renderDialog();
    await selectType("Sensor");
    expect(screen.getByDisplayValue("S-1")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("UNKNOWN")).not.toBeInTheDocument();
  });

  it("sends type_id and only non-empty values, so nothing stored is deleted", async () => {
    const onReassigned = renderDialog();
    await selectType("Sensor");
    await userEvent.click(screen.getByRole("button", { name: "Reassign" }));
    expect(mocks.updateEndpoint).toHaveBeenCalledWith({
      endpointId: "e1",
      body: { type_id: "sensor", endpoint_data: { serial: "S-1" } },
    });
    expect(onReassigned).toHaveBeenCalled();
  });

  it("sends a value the user typed for an empty field", async () => {
    renderDialog();
    await selectType("Sensor");
    const inputs = screen.getAllByRole("textbox");
    await userEvent.type(inputs[inputs.length - 1], "hall");
    await userEvent.click(screen.getByRole("button", { name: "Reassign" }));
    expect(mocks.updateEndpoint.mock.calls[0][0].body.endpoint_data).toEqual({ serial: "S-1", location: "hall" });
  });
});
