export type DiffKind = "same" | "add" | "del";

export interface DiffLine {
  kind: DiffKind;
  text: string;
  /** 1-based line numbers in the old / new text (undefined where the line does not exist). */
  oldNo?: number;
  newNo?: number;
}

export type DiffRow = DiffLine | { kind: "skip"; count: number; lines: DiffLine[] };

/** Pretty JSON with sorted keys, so a pure reordering of keys is not a change. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, sort(x)]));
    }
    return v;
  };
  return JSON.stringify(sort(value), null, 2) ?? "";
}

/** Line diff (longest common subsequence) with common prefix and suffix trimmed first. */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endB = before.length;
  let endA = after.length;
  while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) {
    endB--;
    endA--;
  }

  const a = before.slice(start, endB);
  const b = after.slice(start, endA);
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let oldNo = 1;
  let newNo = 1;
  const push = (kind: DiffKind, text: string) => {
    out.push({ kind, text, oldNo: kind === "add" ? undefined : oldNo, newNo: kind === "del" ? undefined : newNo });
    if (kind !== "add") oldNo++;
    if (kind !== "del") newNo++;
  };

  for (let i = 0; i < start; i++) push("same", before[i]);
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (i < a.length && (j === b.length || table[i + 1][j] >= table[i][j + 1])) {
      push("del", a[i++]);
    } else {
      push("add", b[j++]);
    }
  }
  for (let k = endB; k < before.length; k++) push("same", before[k]);
  return out;
}

export function diffStats(lines: DiffLine[]) {
  return {
    added: lines.filter((l) => l.kind === "add").length,
    removed: lines.filter((l) => l.kind === "del").length,
  };
}

/** Folds runs of unchanged lines longer than `2 * context` into a single `skip` row. */
export function foldUnchanged(lines: DiffLine[], context = 3): DiffRow[] {
  const rows: DiffRow[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].kind !== "same") {
      rows.push(lines[i++]);
      continue;
    }
    let j = i;
    while (j < lines.length && lines[j].kind === "same") j++;
    const run = lines.slice(i, j);
    const leading = i === 0 ? 0 : context;
    const trailing = j === lines.length ? 0 : context;
    if (run.length > leading + trailing + 1) {
      rows.push(...run.slice(0, leading));
      const hidden = run.slice(leading, run.length - trailing);
      rows.push({ kind: "skip", count: hidden.length, lines: hidden });
      rows.push(...run.slice(run.length - trailing));
    } else {
      rows.push(...run);
    }
    i = j;
  }
  return rows;
}

export function diffJson(before: unknown, after: unknown): DiffLine[] {
  return diffLines(canonicalJson(before).split("\n"), canonicalJson(after).split("\n"));
}
