import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { ModuleBadge } from "./badges";
import { MODULE_NAME_PATTERN } from "./utils";

/** Module names are typed, never picked: Enter (or comma) turns the text into a removable badge. */
export default function ModuleNameInput({ id, modules, onChange, disabled }: {
  id: string;
  modules: string[];
  onChange: (modules: string[]) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();

  const commit = () => {
    const name = text.trim();
    if (!name) return true;
    if (!MODULE_NAME_PATTERN.test(name)) {
      setError("Use the exact module name: letters, digits, . _ - (no wildcards)");
      return false;
    }
    if (!modules.includes(name)) onChange([...modules, name]);
    setText("");
    setError(undefined);
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && text === "" && modules.length > 0) {
      onChange(modules.slice(0, -1));
    }
  };

  return (
    <div className="space-y-1">
      <div className={cn("flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5", disabled && "bg-muted/40")}>
        {modules.map((m) => (
          <ModuleBadge key={m} name={m} onRemove={disabled ? undefined : () => onChange(modules.filter((x) => x !== m))} />
        ))}
        {!disabled && (
          <input
            id={id}
            value={text}
            onChange={(e) => { setText(e.target.value); setError(undefined); }}
            onKeyDown={onKeyDown}
            onBlur={commit}
            placeholder={modules.length ? "Add another module" : "Type a module name and press Enter, e.g. seal-opcua-client"}
            aria-label="Module name"
            aria-invalid={error ? true : undefined}
            className="min-w-48 flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none ring-0 placeholder:text-muted-foreground"
          />
        )}
        {disabled && modules.length === 0 && <span className="text-sm text-muted-foreground">No module</span>}
      </div>
      {error ? (
        <p className="text-xs text-red-700">{error}</p>
      ) : !disabled && (
        <p className="text-xs text-muted-foreground">The exact module name, e.g. <code>seal-opcua-client</code>. Press Enter to add it.</p>
      )}
    </div>
  );
}
