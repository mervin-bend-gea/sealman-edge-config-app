import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FieldsEditor, { FieldDefinition, FieldRow, buildMappingPayload, rowsFromFields } from "../FieldsEditor";
import { ENDPOINT_ROLE_OPTIONS, SERVICE_ROLE_OPTIONS } from "../typeRoles";

function stringField(label: string): FieldDefinition {
  return { type: "string", label, required: false, ui: "input", default: null, changeable: true, show_in_list: true };
}

describe("rowsFromFields", () => {
  it("takes each row's role from the mapping", () => {
    const rows = rowsFromFields({ addr: stringField("Address"), note: stringField("Note") }, { addr: "ip" });
    expect(rows.map((r) => [r.key, r.role])).toEqual([["addr", "ip"], ["note", null]]);
  });

  it("leaves roles empty without a mapping", () => {
    expect(rowsFromFields({ addr: stringField("Address") })[0].role).toBeNull();
  });
});

describe("buildMappingPayload", () => {
  it("maps the current, trimmed key of a renamed row", () => {
    const rows = rowsFromFields({ addr: stringField("Address"), title: stringField("Title") }, { addr: "ip", title: "name" });
    rows[0] = { ...rows[0], key: " host " };
    expect(buildMappingPayload(rows)).toEqual({ host: "ip", title: "name" });
  });

  it("skips rows without a role or without a key", () => {
    const rows = rowsFromFields({ a: stringField("A"), b: stringField("B") }, { a: "ip" });
    rows[0] = { ...rows[0], key: "  " };
    expect(buildMappingPayload(rows)).toEqual({});
  });
});

describe("FieldsEditor role selector", () => {
  it("is not rendered without roleOptions", () => {
    render(<FieldsEditor rows={rowsFromFields({ addr: stringField("A") })} onChange={() => {}} />);
    expect(screen.queryByLabelText("Role of field addr")).not.toBeInTheDocument();
  });

  it("disables a role another field already has", () => {
    const rows = rowsFromFields({ addr: stringField("A"), title: stringField("T") }, { addr: "ip" });
    render(<FieldsEditor rows={rows} onChange={() => {}} roleOptions={ENDPOINT_ROLE_OPTIONS} />);
    const titleRole = screen.getByLabelText("Role of field title");
    expect(within(titleRole).getByRole("option", { name: "IP" })).toBeDisabled();
    expect(within(titleRole).getByRole("option", { name: "Name" })).not.toBeDisabled();
    expect(within(screen.getByLabelText("Role of field addr")).getByRole("option", { name: "IP" })).not.toBeDisabled();
  });

  it("sets the row's role on change", async () => {
    const onChange = vi.fn();
    render(<FieldsEditor rows={rowsFromFields({ title: stringField("T") })} onChange={onChange} roleOptions={ENDPOINT_ROLE_OPTIONS} />);
    await userEvent.selectOptions(screen.getByLabelText("Role of field title"), "name");
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: "title", role: "name" })]);
  });

  it("clears the role when None is chosen", async () => {
    const onChange = vi.fn();
    render(<FieldsEditor rows={rowsFromFields({ addr: stringField("A") }, { addr: "ip" })} onChange={onChange} roleOptions={ENDPOINT_ROLE_OPTIONS} />);
    await userEvent.selectOptions(screen.getByLabelText("Role of field addr"), "");
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: "addr", role: null })]);
  });

  it("disables roles whose field type differs from the row's type", () => {
    const rows = rowsFromFields({ count: { ...stringField("C"), type: "integer", ui: "number" }, addr: stringField("A") });
    const { rerender } = render(<FieldsEditor rows={rows} onChange={() => {}} roleOptions={ENDPOINT_ROLE_OPTIONS} />);
    const intRole = screen.getByLabelText("Role of field count");
    expect(within(intRole).getByRole("option", { name: "IP" })).toBeDisabled();
    expect(within(intRole).getByRole("option", { name: "Name" })).toBeDisabled();
    rerender(<FieldsEditor rows={rows} onChange={() => {}} roleOptions={SERVICE_ROLE_OPTIONS} />);
    expect(within(screen.getByLabelText("Role of field addr")).getByRole("option", { name: "Port" })).toBeDisabled();
    expect(within(screen.getByLabelText("Role of field count")).getByRole("option", { name: "Port" })).not.toBeDisabled();
  });

  it("disables the selector while the key is empty", () => {
    const rows = rowsFromFields({ a: stringField("A") });
    rows[0] = { ...rows[0], key: "  " };
    render(<FieldsEditor rows={rows} onChange={() => {}} roleOptions={ENDPOINT_ROLE_OPTIONS} />);
    expect(screen.getByLabelText("Role of field")).toBeDisabled();
  });

  it("clears the role when the field type changes to one that does not fit", async () => {
    // jsdom lacks these; Radix Select needs them to open
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
    const onChange = vi.fn();
    render(<FieldsEditor rows={rowsFromFields({ addr: stringField("A") }, { addr: "ip" })} onChange={onChange} roleOptions={ENDPOINT_ROLE_OPTIONS} />);
    const typeTrigger = screen.getAllByRole("combobox").find((el) => el.tagName === "BUTTON")!;
    await userEvent.click(typeTrigger);
    await userEvent.click(await screen.findByRole("option", { name: /integer/i }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: "addr", role: null })]);
  });

  it("carries the role to a key renamed through the key input", async () => {
    const latest: { rows: FieldRow[] } = { rows: [] };
    function Harness() {
      const [rows, setRows] = useState(() => rowsFromFields({ addr: stringField("A") }, { addr: "ip" }));
      return (
        <FieldsEditor
          rows={rows}
          onChange={(next) => {
            latest.rows = next;
            setRows(next);
          }}
          roleOptions={ENDPOINT_ROLE_OPTIONS}
        />
      );
    }
    render(<Harness />);
    const keyInput = screen.getByPlaceholderText("field_key");
    await userEvent.clear(keyInput);
    await userEvent.type(keyInput, "host");
    expect(buildMappingPayload(latest.rows)).toEqual({ host: "ip" });
  });
});

describe("FieldsEditor list visibility", () => {
  it("updates show_in_list when the toggle changes", async () => {
    const onChange = vi.fn();
    render(
      <FieldsEditor
        rows={rowsFromFields({ serial: stringField("Serial") })}
        onChange={onChange}
        showListVisibility
      />,
    );

    await userEvent.click(screen.getAllByRole("switch")[2]);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        key: "serial",
        definition: expect.objectContaining({ show_in_list: false }),
      }),
    ]);
  });
});
