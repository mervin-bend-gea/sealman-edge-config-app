import { useEffect, useId, useMemo, useRef, useState, type ComponentProps } from "react";
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
}

/**
 * The platform's JSON editor: highlighting, a syntax check that says where the problem is (click to jump there),
 * Format and a fullscreen mode. Editable by default, `readOnly` for viewing.
 */
export default function JsonEditor({ value, onChange, readOnly, markers, annotations, className, label = "JSON editor", allowFullscreen = true }: JsonEditorProps) {
  const id = useId();
  const ace = useRef<{ editor: AceEditorInstance } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
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
      <div className="min-h-0 flex-1">
        <AceEditor
          ref={ace as never}
          mode="json"
          name={`json-editor-${id.replace(/:/g, "")}`}
          onChange={onChange}
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
    </div>
  );
}
