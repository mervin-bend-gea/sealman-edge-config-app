import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { VariableDecl } from "./api";
import { VariablesEditor } from "./components";
import { variableProblems } from "./utils";

function Harness({ initial }: { initial: VariableDecl[] }) {
  const [variables, setVariables] = useState(initial);
  return (
    <>
      <VariablesEditor variables={variables} onChange={setVariables} />
      <output data-testid="state">{JSON.stringify(variables)}</output>
    </>
  );
}

const state = () => JSON.parse(screen.getByTestId("state").textContent!) as VariableDecl[];

describe("VariablesEditor", () => {
  it("capitalizes the types and centers the Required column", () => {
    render(<Harness initial={[{ name: "line", type: "enum", options: ["a"], required: true }]} />);
    expect(screen.getByRole("combobox", { name: "Variable type" })).toHaveTextContent("Enum");
    expect(screen.getByText("Required", { selector: "span.cursor-help" })).toHaveClass("justify-self-center");
    expect(screen.getByLabelText("Variable line required").closest("label")).toHaveClass("justify-center");
  });

  it("explains every column in a tooltip", async () => {
    render(<Harness initial={[{ name: "a", type: "string", required: true }]} />);
    for (const [header, help] of [
      ["Name", /How the body refers to the variable/],
      ["Type", /How the value is entered and checked/],
      ["Required", /a value is needed/],
      ["Options", /Enum only/],
    ] as const) {
      fireEvent.focus(screen.getByText(header, { selector: "span.cursor-help" }));
      expect((await screen.findAllByText(help)).length).toBeGreaterThan(0);
      fireEvent.blur(screen.getByText(header, { selector: "span.cursor-help" }));
    }
  });

  it("edits the description and keeps a trailing comma while options are typed", () => {
    render(<Harness initial={[{ name: "line", type: "enum", options: ["a"], required: true }]} />);
    fireEvent.change(screen.getByLabelText("Variable description"), { target: { value: "Which line" } });
    const options = screen.getByLabelText("Variable options");
    fireEvent.change(options, { target: { value: "a, b," } });
    expect(options).toHaveValue("a, b,");
    fireEvent.change(options, { target: { value: "a, b, 3" } });
    expect(state()[0]).toMatchObject({ description: "Which line", options: ["a", "b", 3] });
  });

  it("marks empty, duplicate and option-less variables", () => {
    expect(variableProblems([
      { name: "", type: "string" },
      { name: "x", type: "string" },
      { name: "x", type: "enum" },
      { name: "device", type: "string" },
      { name: "1bad", type: "string" },
    ]).map((p) => `${p.index}:${p.field}`)).toEqual(["0:name", "2:name", "2:options", "3:name", "4:name"]);
    render(<Harness initial={[{ name: "x", type: "string" }, { name: "x", type: "string" }]} />);
    expect(screen.getByRole("list", { name: "Variable problems" })).toHaveTextContent("Variable 2: 'x' is declared twice");
    expect(screen.getByLabelText("Variable name", { selector: "input[aria-invalid=true]" })).toBeInTheDocument();
  });
});
