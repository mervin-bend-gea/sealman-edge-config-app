import type { ReactNode } from "react";
import { Container, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScopeRef } from "./api";

function RemoveButton({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      onClick={onRemove}
      className="-mr-0.5 rounded-sm opacity-70 hover:opacity-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

const BASE = "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium";

/** A module: light blue with a container icon. */
export function ModuleBadge({ name, onRemove, className }: { name: string; onRemove?: () => void; className?: string }) {
  return (
    <span className={cn(BASE, "border-sky-200 bg-sky-100 text-sky-900", className)}>
      <Container className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{name}</span>
      {onRemove && <RemoveButton name={name} onRemove={onRemove} />}
    </span>
  );
}

/** A scope: safety yellow with dark text. */
export function ScopeBadge({ name, onRemove, className }: { name: string; onRemove?: () => void; className?: string }) {
  return (
    <span className={cn(BASE, "border-yellow-500 bg-yellow-300 text-neutral-900", className)}>
      <span className="truncate">{name}</span>
      {onRemove && <RemoveButton name={name} onRemove={onRemove} />}
    </span>
  );
}

/** What a namespace is tied to: its modules and scopes (or the note that it is open to every device). */
export function NamespaceBadges({ modules, scopes, className }: { modules: string[]; scopes: ScopeRef[]; className?: string }): ReactNode {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {modules.map((m) => <ModuleBadge key={m} name={m} />)}
      {scopes.length > 0
        ? scopes.map((s) => <ScopeBadge key={s.id} name={s.name} />)
        : <span className="text-xs text-muted-foreground">No scope: accessible for everyone</span>}
    </div>
  );
}
