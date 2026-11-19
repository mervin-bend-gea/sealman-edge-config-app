import { forwardRef, useImperativeHandle } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import JsonEditor from "../JsonEditor";

const editor = vi.hoisted(() => ({ resize: vi.fn(), focus: vi.fn(), gotoLine: vi.fn() }));
vi.mock("react-ace", () => ({
  default: forwardRef<unknown, { value: string; readOnly?: boolean; annotations?: unknown[] }>(function FakeAce({ value, readOnly, annotations }, ref) {
    useImperativeHandle(ref, () => ({ editor }));
    return <pre data-testid="ace" data-readonly={String(!!readOnly)} data-annotations={JSON.stringify(annotations)}>{value}</pre>;
  }),
}));
vi.mock("ace-builds/src-noconflict/theme-github", () => ({}));
vi.mock("ace-builds/src-noconflict/mode-json", () => ({}));
vi.mock("ace-builds/src-noconflict/ext-searchbox", () => ({}));

describe("JsonEditor", () => {
  it("reports valid JSON and formats it", () => {
    const onChange = vi.fn();
    render(<JsonEditor value='{"a":1,"b":[2]}' onChange={onChange} />);
    expect(screen.getByText("Valid JSON")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect(onChange).toHaveBeenCalledWith('{\n  "a": 1,\n  "b": [\n    2\n  ]\n}');
  });

  it("says where the syntax error is, marks it in the gutter and jumps there", () => {
    render(<JsonEditor value={'{\n  "a": 1\n  "b": 2\n}'} onChange={vi.fn()} annotations={[{ row: 0, column: 0, type: "warning", text: "extra" }]} />);
    const status = screen.getByRole("button", { name: /Line 2, column 9/ });
    expect(screen.getByRole("button", { name: "Format" })).toBeDisabled();
    expect(JSON.parse(screen.getByTestId("ace").dataset.annotations!)).toEqual([
      expect.objectContaining({ row: 1, column: 8, type: "error" }),
      expect.objectContaining({ type: "warning", text: "extra" }),
    ]);
    fireEvent.click(status);
    expect(editor.gotoLine).toHaveBeenCalledWith(2, 8, true);
  });

  it("goes fullscreen and leaves it with the button or Escape", () => {
    render(<JsonEditor value="{}" onChange={vi.fn()} className="h-96" />);
    const box = screen.getByRole("group", { name: "JSON editor" });
    expect(box).toHaveClass("h-96");
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(box).toHaveClass("fixed", "inset-0");
    expect(box).not.toHaveClass("h-96");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(box).not.toHaveClass("fixed");
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(box).not.toHaveClass("fixed");
  });

  it("read-only shows neither status nor format, but still fullscreen", () => {
    render(<JsonEditor value="not json at all" readOnly />);
    expect(screen.queryByText("Valid JSON")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Line/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Format" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fullscreen" })).toBeInTheDocument();
    expect(screen.getByTestId("ace")).toHaveAttribute("data-readonly", "true");
  });
});
