export interface JsonProblem {
  message: string;
  /** 1-based */
  line: number;
  /** 1-based */
  column: number;
}

function lineColumn(text: string, position: number): { line: number; column: number } {
  const before = text.slice(0, position);
  const line = before.split("\n").length;
  return { line, column: position - (before.lastIndexOf("\n") + 1) + 1 };
}

/** Position of the first character that cannot be part of valid JSON, for engines whose message does not give it. */
function locateByPrefix(text: string): number {
  if (text.length > 200_000) return text.length;
  for (let n = 1; n <= text.length; n++) {
    try {
      JSON.parse(text.slice(0, n));
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      const at = /position (\d+)/.exec(message);
      const unfinished = /Unexpected end|Unterminated/i.test(message) || (at !== null && Number(at[1]) >= n);
      if (!unfinished) return n - 1;
    }
  }
  return text.length;
}

function indexOfLineColumn(text: string, line: number, column: number): number {
  const lines = text.split("\n");
  let index = 0;
  for (let i = 0; i < Math.min(line - 1, lines.length); i++) index += lines[i].length + 1;
  return Math.min(index + column - 1, text.length);
}

/** Where and what is wrong with `text`, or null if it is valid JSON. Works with V8 and Firefox error messages. */
export function jsonProblem(text: string): JsonProblem | null {
  try {
    JSON.parse(text);
    return null;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const explicit = /line (\d+) column (\d+)/.exec(raw);
    const offset = /position (\d+)/.exec(raw);
    let position = offset ? Math.min(Number(offset[1]), text.length)
      : explicit ? indexOfLineColumn(text, Number(explicit[1]), Number(explicit[2]))
      : locateByPrefix(text);

    let message = raw
      .replace(/^JSON\.parse: /, "")
      .replace(/\s*\(line \d+ column \d+\)/, "")
      .replace(/\s*(in JSON )?at position \d+/, "")
      .replace(/\s*at line \d+ column \d+ of the JSON data/, "")
      .trim();
    message = message.charAt(0).toUpperCase() + message.slice(1);

    const previous = text.slice(0, position).trimEnd().slice(-1);
    if (previous === "," && /^Unexpected token ['"]?[}\]]|double-quoted property name|expected double-quoted/i.test(message)) {
      message += " (trailing comma?)";
    }
    // a missing comma belongs at the end of the previous value, not where the next token begins
    if (/^Expected ',' or/i.test(message)) {
      let start = position;
      while (start > 0 && !/[\s,:{}[\]]/.test(text[start - 1])) start--;
      position = text.slice(0, start).trimEnd().length;
    }
    return { message, ...lineColumn(text, position) };
  }
}
