import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssignEndpointDialog from "../AssignEndpointDialog";

const mocks = vi.hoisted(() => ({
  types: [
    { type_id: "with-ip", label: "With IP", description: null, fields: { addr: { type: "string", ui: "input", required: false, changeable: true, show_in_list: true, default: null, label: "Address" } }, mapping: { addr: "ip" } },
    {
      type_id: "no-ip",
      label: "No IP",
      description: null,
      fields: {
        serial: { type: "string", ui: "input", required: false, changeable: true, show_in_list: true, default: "UNKNOWN", label: "Serial" },
        location: { type: "string", ui: "input", required: false, changeable: true, show_in_list: true, default: null, label: "Location" },
      },
      mapping: {},
    },
  ] as unknown[],
  postEndpoint: vi.fn(),
  updateEndpoint: vi.fn(),
  deleteEndpoint: vi.fn(),
}));

vi.mock("@/generated/edge-administration/hooks/endpoint_types/useGetEndpointTypes", () => ({
  default: () => ({ data: mocks.types }),
}));
vi.mock("@/generated/edge-administration/hooks/endpoints/usePostEndpoint", () => ({ usePostEndpoint: () => ({ postEndpoint: mocks.postEndpoint, isPending: false }) }));
vi.mock("@/generated/edge-administration/hooks/endpoints/useUpdateEndpoint", () => ({ useUpdateEndpoint: () => ({ updateEndpoint: mocks.updateEndpoint, isPending: false }) }));
vi.mock("@/generated/edge-administration/hooks/endpoints/useDeleteEndpoint", () => ({ useDeleteEndpoint: () => ({ deleteEndpoint: mocks.deleteEndpoint, isPending: false }) }));

describe("AssignEndpointDialog", () => {
  async function selectType(label: string) {
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: label }));
  }

  beforeEach(() => {
    mocks.postEndpoint.mockReset().mockResolvedValue(undefined);
    mocks.updateEndpoint.mockReset().mockResolvedValue(undefined);
    mocks.deleteEndpoint.mockReset().mockResolvedValue(undefined);
  });

  it("pre-fills the scanned IP into the ip-role field", () => {
    render(<AssignEndpointDialog open onOpenChange={() => {}} deviceId="d" ip="10.0.0.9" defaultTypeId="with-ip" onCreated={() => {}} />);
    expect(screen.getByDisplayValue("10.0.0.9")).toBeInTheDocument();
  });

  it("does not pre-fill the scanned IP when the type has no ip role", () => {
    render(<AssignEndpointDialog open onOpenChange={() => {}} deviceId="d" ip="10.0.0.9" defaultTypeId="no-ip" onCreated={() => {}} />);
    expect(screen.queryByDisplayValue("10.0.0.9")).not.toBeInTheDocument();
  });

  const STRING = { type: "string", ui: "input", required: false, changeable: true, show_in_list: true, default: null } as const;
  const EXISTING = {
    endpoint_id: "e1",
    type_id: "with-ip",
    endpoint_data: {
      addr: { value: "10.0.0.9", field: { ...STRING, label: "Address" } },
      serial: { value: "S-1", field: null },
    },
  };

  it("retypes with PATCH instead of deleting and recreating", async () => {
    render(<AssignEndpointDialog open onOpenChange={() => {}} deviceId="d" existingEndpoint={EXISTING} onCreated={() => {}} />);
    await selectType("No IP");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(mocks.deleteEndpoint).not.toHaveBeenCalled();
    expect(mocks.postEndpoint).not.toHaveBeenCalled();
    expect(mocks.updateEndpoint).toHaveBeenCalledWith({
      endpointId: "e1",
      body: { type_id: "no-ip", endpoint_data: { serial: "S-1" } },
    });
  });

  it("keeps the stored value instead of the new type's default when retyping", async () => {
    render(<AssignEndpointDialog open onOpenChange={() => {}} deviceId="d" existingEndpoint={EXISTING} onCreated={() => {}} />);
    await selectType("No IP");
    expect(screen.getByDisplayValue("S-1")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("UNKNOWN")).not.toBeInTheDocument();
  });

  it("still sends the full data (including cleared fields) when the type is unchanged", async () => {
    render(<AssignEndpointDialog open onOpenChange={() => {}} deviceId="d" existingEndpoint={EXISTING} onCreated={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(mocks.updateEndpoint).toHaveBeenCalledWith({
      endpointId: "e1",
      body: { endpoint_data: { addr: "10.0.0.9" } },
    });
  });

  it("same-type edit sends an emptied text field as an empty string", async () => {
    render(<AssignEndpointDialog open onOpenChange={() => {}} deviceId="d" existingEndpoint={EXISTING} onCreated={() => {}} />);
    await userEvent.clear(screen.getByDisplayValue("10.0.0.9"));
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    const body = mocks.updateEndpoint.mock.calls[0][0].body;
    expect(body.type_id).toBeUndefined();
    expect(body.endpoint_data.addr).toBe("");
  });
});
