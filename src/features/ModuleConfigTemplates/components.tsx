import { useState } from "react";
import { AlertCircle, AlertTriangle, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Finding, Scalar, VariableDecl, VariableType, Values } from "./api";
import { VARIABLE_TYPES, VARIABLE_TYPE_LABELS, variableProblems } from "./utils";

const UNSET = "__unset__";

const LEVEL = {
  error: { Icon: AlertCircle, className: "text-red-700" },
  warning: { Icon: AlertTriangle, className: "text-amber-700" },
  hint: { Icon: Info, className: "text-blue-700" },
} as const;

/** Findings of the template engine: level, JSON pointer and message. */
export function FindingsList({ findings, className }: { findings: Finding[]; className?: string }) {
  if (findings.length === 0) return null;
  return (
    <ul className={cn("space-y-1 text-sm", className)} aria-label="Findings">
      {findings.map((f, i) => {
        const { Icon, className: color } = LEVEL[f.level] ?? LEVEL.hint;
        return (
          <li key={`${f.path}-${f.code}-${i}`} className={cn("flex items-start gap-2", color)}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {f.path && <code className="mr-1 rounded bg-muted px-1 text-xs text-foreground">{f.path}</code>}
              {f.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function fieldLabel(decl: VariableDecl) {
  return `${decl.label || decl.name}${decl.required === false ? "" : " *"}`;
}

/** Input form generated from a template's variable declarations. */
export function VariableForm({
  variables,
  values,
  onChange,
  findings = [],
  disabled,
}: {
  variables: VariableDecl[];
  values: Values;
  onChange: (values: Values) => void;
  findings?: Finding[];
  disabled?: boolean;
}) {
  if (variables.length === 0) {
    return <p className="text-sm text-muted-foreground">This template has no variables.</p>;
  }
  const set = (name: string, value: unknown) => {
    const next = { ...values };
    if (value === undefined || value === "") delete next[name];
    else next[name] = value;
    onChange(next);
  };
  return (
    <div className="grid max-w-3xl gap-4">
      {variables.map((decl) => {
        const id = `var-${decl.name}`;
        const error = findings.find((f) => f.path === `/values/${decl.name}` && f.level === "error");
        const current = values[decl.name];
        const placeholder = decl.required === false ? "optional" : "";
        const choices: Scalar[] | null = decl.type === "boolean" ? [true, false] : decl.type === "enum" ? decl.options ?? [] : null;
        return (
          <div key={decl.name} className="space-y-1">
            <Label htmlFor={id}>{fieldLabel(decl)}</Label>
            {choices ? (
              <Select
                disabled={disabled}
                value={current === undefined ? UNSET : String(current)}
                onValueChange={(v) => set(decl.name, v === UNSET ? undefined : choices.find((c) => String(c) === v))}
              >
                <SelectTrigger id={id} aria-invalid={!!error}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>{placeholder || "(not set)"}</SelectItem>
                  {choices.map((c) => (
                    <SelectItem key={String(c)} value={String(c)}>{String(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : decl.type === "text" ? (
              <Textarea
                id={id}
                disabled={disabled}
                rows={4}
                placeholder={placeholder}
                aria-invalid={!!error}
                value={current === undefined ? "" : String(current)}
                onChange={(e) => set(decl.name, e.target.value)}
              />
            ) : (
              <Input
                id={id}
                disabled={disabled}
                inputMode={decl.type === "string" ? undefined : "decimal"}
                placeholder={placeholder}
                aria-invalid={!!error}
                value={current === undefined ? "" : String(current)}
                onChange={(e) => set(decl.name, e.target.value)}
              />
            )}
            {decl.description && <p className="text-xs text-muted-foreground">{decl.description}</p>}
            {error && <p className="text-xs text-red-700">{error.message}</p>}
          </div>
        );
      })}
    </div>
  );
}

function parseScalar(text: string, type: VariableType): Scalar | null {
  const t = text.trim();
  if (t === "") return null;
  if (type === "number" || type === "integer") return Number.isNaN(Number(t)) ? t : Number(t);
  if (type === "boolean") return t === "true" ? true : t === "false" ? false : t;
  if (type === "enum") return Number.isNaN(Number(t)) ? t : Number(t);
  return text;
}

const COLUMNS = "md:grid-cols-[minmax(8rem,1.2fr)_7.5rem_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(10rem,1.6fr)_5.5rem_2.25rem]";

const COLUMN_HELP = {
  name: "How the body refers to the variable: ${name}. Letters, digits and _, not starting with a digit.",
  type: "How the value is entered and checked. String: one line. Text: several lines. Number, Integer, Boolean. Enum: one of the options.",
  label: "Caption above the input when the template is applied. The name is used if empty.",
  options: "Enum only: the allowed values, separated by commas.",
  description: "Help text shown under the input.",
  required: "Checked: a value is needed to apply the template. Unchecked: without a value the key is left out of the configuration.",
} as const;

function ColumnHeader({ label, help, className }: { label: string; help: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("w-fit cursor-help underline decoration-dotted underline-offset-4", className)}>{label}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{help}</TooltipContent>
    </Tooltip>
  );
}

/** The options of an enum as typed: keeps what is being typed (a trailing comma) while the parsed list is passed on. */
function OptionsInput({ options, disabled, invalid, onChange }: {
  options: Scalar[] | null | undefined;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (options: Scalar[] | null) => void;
}) {
  const [text, setText] = useState((options ?? []).join(", "));
  return (
    <Input
      aria-label="Variable options"
      aria-invalid={invalid || undefined}
      className={cn(invalid && "border-red-500")}
      disabled={disabled}
      placeholder={disabled ? "-" : "a, b, c"}
      value={disabled ? "" : text}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = e.target.value.split(",").map((o) => parseScalar(o, "enum")).filter((o): o is Scalar => o !== null);
        onChange(parsed.length ? parsed : null);
      }}
    />
  );
}

/** Table editor for a template's variable declarations. */
export function VariablesEditor({
  variables,
  onChange,
  disabled,
}: {
  variables: VariableDecl[];
  onChange: (variables: VariableDecl[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<VariableDecl>) =>
    onChange(variables.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  const problems = variableProblems(variables);
  const invalid = (index: number, field: "name" | "options") => problems.some((p) => p.index === index && p.field === field);
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        {variables.length > 0 && (
          <div className={cn("hidden gap-2 text-xs font-medium text-muted-foreground md:grid", COLUMNS)}>
            <ColumnHeader label="Name" help={COLUMN_HELP.name} />
            <ColumnHeader label="Type" help={COLUMN_HELP.type} />
            <ColumnHeader label="Label" help={COLUMN_HELP.label} />
            <ColumnHeader label="Options" help={COLUMN_HELP.options} />
            <ColumnHeader label="Description" help={COLUMN_HELP.description} />
            <ColumnHeader label="Required" help={COLUMN_HELP.required} className="justify-self-center" />
            <span />
          </div>
        )}
        {variables.map((v, i) => (
          <div key={i} className={cn("grid grid-cols-2 items-center gap-2", COLUMNS)}>
            <Input aria-label="Variable name" disabled={disabled} value={v.name} placeholder="name"
                   aria-invalid={invalid(i, "name") || undefined} className={cn(invalid(i, "name") && "border-red-500")}
                   onChange={(e) => update(i, { name: e.target.value })} />
            <Select disabled={disabled} value={v.type} onValueChange={(t) => update(i, { type: t as VariableType })}>
              <SelectTrigger aria-label="Variable type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VARIABLE_TYPES.map((t) => <SelectItem key={t} value={t}>{VARIABLE_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input aria-label="Variable label" disabled={disabled} value={v.label ?? ""} placeholder="label"
                   onChange={(e) => update(i, { label: e.target.value || null })} />
            <OptionsInput key={v.type === "enum" ? "enum" : "other"} options={v.options} disabled={disabled || v.type !== "enum"}
                          invalid={invalid(i, "options")} onChange={(options) => update(i, { options })} />
            <Input aria-label="Variable description" disabled={disabled} value={v.description ?? ""} placeholder="description"
                   onChange={(e) => update(i, { description: e.target.value || null })} />
            <label className="flex items-center justify-center gap-2 text-sm">
              <input type="checkbox" disabled={disabled} checked={v.required !== false}
                     aria-label={`Variable ${v.name || i + 1} required`}
                     onChange={(e) => update(i, { required: e.target.checked })} />
              <span className="md:sr-only">Required</span>
            </label>
            <Button variant="ghost" size="icon" aria-label={`Remove variable ${v.name}`} disabled={disabled}
                    onClick={() => onChange(variables.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {problems.length > 0 && (
          <ul className="space-y-0.5 text-xs text-red-700" aria-label="Variable problems">
            {problems.map((p, k) => <li key={k}>Variable {p.index + 1}: {p.message}</li>)}
          </ul>
        )}
        <Button variant="outline" size="sm" disabled={disabled}
                onClick={() => onChange([...variables, { name: "", type: "string", required: true }])}>
          <Plus className="mr-1 h-4 w-4" /> Add variable
        </Button>
      </div>
    </TooltipProvider>
  );
}
