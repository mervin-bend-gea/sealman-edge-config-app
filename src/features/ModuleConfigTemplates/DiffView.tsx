import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { diffJson, diffStats, foldUnchanged, type DiffLine } from "./diff";

const ROW = {
  add: "bg-green-50 text-green-900",
  del: "bg-red-50 text-red-900",
  same: "",
} as const;
const MARK = { add: "+", del: "-", same: " " } as const;

function Line({ line }: { line: DiffLine }) {
  return (
    <tr className={ROW[line.kind]}>
      <td className="w-16 select-none px-1 text-right text-muted-foreground/70">{line.oldNo ?? ""}</td>
      <td className="w-16 select-none px-1 text-right text-muted-foreground/70">{line.newNo ?? ""}</td>
      <td className="w-4 select-none text-center">{MARK[line.kind]}</td>
      <td className="whitespace-pre pr-2">{line.text}</td>
    </tr>
  );
}

/** Line diff of two JSON values (keys sorted), unchanged stretches folded. The first line-number column counts the
 * lines of the old side, the second those of the new side (empty where a line only exists on the other side). */
export default function DiffView({ before, after, beforeLabel = "Old", afterLabel = "New", className }: {
  before: unknown;
  after: unknown;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  const lines = useMemo(() => diffJson(before, after), [before, after]);
  const stats = useMemo(() => diffStats(lines), [lines]);
  const rows = useMemo(() => foldUnchanged(lines), [lines]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (stats.added === 0 && stats.removed === 0) {
    return <p className="text-sm text-muted-foreground">No differences.</p>;
  }
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs">
        <span className="font-medium text-green-700">+{stats.added}</span>{" "}
        <span className="font-medium text-red-700">-{stats.removed}</span>{" "}
        <span className="text-muted-foreground">lines</span>
      </p>
      <div className="max-h-[60vh] overflow-auto rounded-md border bg-card font-mono text-xs">
        <table className="w-full border-collapse" aria-label="Differences">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th className="w-16 px-1 text-right font-medium" title={`Line number in ${beforeLabel}`}>{beforeLabel}</th>
              <th className="w-16 px-1 text-right font-medium" title={`Line number in ${afterLabel}`}>{afterLabel}</th>
              <th colSpan={2} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.kind !== "skip") return <Line key={i} line={row} />;
              if (expanded.has(i)) return row.lines.map((line, k) => <Line key={`${i}-${k}`} line={line} />);
              return (
                <tr key={i} className="bg-muted/60">
                  <td colSpan={4} className="px-2 py-0.5 text-center">
                    <button type="button" className="text-muted-foreground hover:text-foreground"
                            onClick={() => setExpanded(new Set(expanded).add(i))}>
                      {row.count} unchanged lines (show)
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
