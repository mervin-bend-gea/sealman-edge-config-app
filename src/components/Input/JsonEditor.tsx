import { useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import _AceEditor from "react-ace";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/ext-searchbox";
import { AlertCircle, CheckCircle2, Maximize2, Minimize2, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { jsonProblem } from "./jsonProblem";

type AceProps = ComponentProps<typeof _AceEditor>;
export type JsonEditorMarker = AceProps["markers"] extends (infer M)[] | undefined ? M : never;
export type JsonEditorAnnotation = AceProps["annotations"] extends (infer A)[] | undefined ? A : never;

// Vite 8 pre-bundles react-ace as CJS and exports module.exports as default,
// which is { __esModule: true, default: AceEditorClass, split, diff }.
// Unwrap the actual component here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AceEditor: typeof _AceEditor = (_AceEditor as any).default ?? _AceEditor;

interface AceEditorInstance {
  resize(force?: boolean): void;
  focus(): void;
  gotoLine(line: number, column?: number, animate?: boolean): void;
}

interface JsonEditorProps {
  value: string;
  readOnly?: boolean;
  onChange?: (newValue: string) => void;
  /** Extra highlights, e.g. the placeholders of a template. */
  markers?: JsonEditorMarker[];
  /** Extra gutter annotations next to the editor's own syntax error. */
  annotations?: JsonEditorAnnotation[];
  /** Sizes the editor (by default it fills its parent); ignored while the editor is fullscreen. */
  className?: string;
  label?: string;
  /** Off where the editor sits in a transformed container such as a dialog, which would trap the fullscreen box. */
  allowFullscreen?: boolean;
  /** Where the cursor is (0-based row and column), e.g. to insert text there. */
  onCursorChange?: (cursor: { row: number; column: number }) => void;
  /** extra buttons shown in the toolbar, before Format */
  toolbar?: ReactNode;
  /** Text of a tooltip shown while the mouse rests on (row, column), or null for none. */
  hoverHelp?: (at: { row: number; column: number }) => string | null;
}

interface AceMouseEvent {
  getDocumentPosition(): { row: number; column: number };
  domEvent: MouseEvent;
}

/**
 * The platform's JSON editor: highlighting, a syntax check that says where the problem is (click to jump there),
 * Format and a fullscreen mode. Editable by default, `readOnly` for viewing.
 */
export default function JsonEditor({ value, onChange, readOnly, markers, annotations, className, label = "JSON editor", allowFullscreen = true, onCursorChange, toolbar, hoverHelp }: JsonEditorProps) {
  const id = useId();
  const ace = useRef<{ editor: AceEditorInstance } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const help = useRef(hoverHelp);
  help.current = hoverHelp;
  const text = value ?? "";
  const blank = text.trim() === "";
  const problem = useMemo(() => (readOnly || blank ? null : jsonProblem(text)), [readOnly, blank, text]);
  const lines = text === "" ? 0 : text.split("\n").length;

  // the editor does not notice by itself that its box changed
  useEffect(() => {
    const timer = setTimeout(() => ace.current?.editor.resize(true), 0);
    return () => clearTimeout(timer);
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const allAnnotations = useMemo<JsonEditorAnnotation[]>(
    () => [
      ...(problem ? [{ row: problem.line - 1, column: problem.column - 1, type: "error", text: problem.message }] : []),
      ...(annotations ?? []),
    ],
    [problem, annotations],
  );

  const jumpToProblem = () => {
    if (!problem || !ace.current) return;
    ace.current.editor.focus();
    ace.current.editor.gotoLine(problem.line, problem.column - 1, true);
  };

  const format = () => {
    if (problem || readOnly || blank) return;
    onChange?.(JSON.stringify(JSON.parse(text), null, 2));
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-md border bg-background",
        fullscreen ? "fixed inset-0 z-50 h-auto rounded-none border-0" : className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs">
        {!readOnly && (
          problem ? (
            <button
              type="button"
              onClick={jumpToProblem}
              title="Jump to the error"
              className="flex min-w-0 items-center gap-1.5 text-left text-red-700 hover:underline"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Line {problem.line}, column {problem.column}: {problem.message}</span>
            </button>
          ) : blank ? (
            <span className="text-muted-foreground">Empty</span>
          ) : (
            <span className="flex items-center gap-1.5 text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Valid JSON
              <span className="text-muted-foreground">· {lines} lines</span>
            </span>
          )
        )}
        <span className="ml-auto flex shrink-0 gap-1">
          {toolbar}
          {!readOnly && (
            <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs"
                    disabled={!!problem || blank} onClick={format}>
              <WrapText className="h-3.5 w-3.5" aria-hidden="true" /> Format
            </Button>
          )}
          {allowFullscreen && (
            <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs"
                    aria-pressed={fullscreen} onClick={() => setFullscreen((f) => !f)}>
              {fullscreen
                ? <><Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> Exit fullscreen</>
                : <><Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Fullscreen</>}
            </Button>
          )}
        </span>
      </div>
      <div className="min-h-0 flex-1" onMouseLeave={() => setTip(null)}>
        <AceEditor
          onLoad={hoverHelp && ((editor: { on(event: "mousemove", listener: (e: AceMouseEvent) => void): void }) => {
            editor.on("mousemove", (e) => {
              const text = help.current?.(e.getDocumentPosition()) ?? null;
              setTip(text ? { text, x: e.domEvent.clientX, y: e.domEvent.clientY } : null);
            });
          })}
          ref={ace as never}
          mode="json"
          name={`json-editor-${id.replace(/:/g, "")}`}
          onChange={onChange}
          onCursorChange={onCursorChange && ((selection: { getCursor(): { row: number; column: number } }) => onCursorChange(selection.getCursor()))}
          fontSize={16}
          height="100%"
          width="100%"
          readOnly={readOnly}
          markers={markers}
          annotations={allAnnotations}
          highlightActiveLine={true}
          value={text}
          setOptions={{
            showLineNumbers: true,
            tabSize: 2,
            useWorker: false,
            useSoftTabs: true,
          }}
        />
      </div>
      {tip && (
        <div role="tooltip" style={{ left: tip.x + 12, top: tip.y + 16 }}
             className="pointer-events-none fixed z-[60] max-w-xs rounded-md bg-slate-900 px-2.5 py-1.5 text-xs leading-snug text-slate-50 shadow-lg">
          {tip.text}
        </div>
      )}
    </div>
  );
}
