import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Template, VariableDecl } from "./api";

interface Props {
  /** declared variables, offered as `${name}` */
  variables: VariableDecl[];
  /** blocks of the template group that can be inserted */
  blocks: Template[];
  /** whether lists may be inserted (templates only) */
  allowLists: boolean;
  /** writes `${reference}` at the cursor */
  onPlaceholder: (reference: string) => void;
  onBlock: (name: string) => void;
  onList: (names: string[], label?: string) => void;
}

type View = "menu" | "variable" | "device" | "endpoint" | "list";

const Hint = ({ children }: { children: string }) => (
  <code className="ml-auto shrink-0 pl-3 text-xs text-muted-foreground">{children}</code>
);

/** Editor toolbar menu: inserts any placeholder, block reference or list at the cursor, so nobody needs to remember the syntax. */
export default function InsertMenu({ variables, blocks, allowLists, onPlaceholder, onBlock, onList }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const names = variables.map((v) => v.name.trim()).filter(Boolean);
  const usable = blocks.filter((b) => b.latest_version != null && !b.archived);
  const done = (action: () => void) => { action(); setOpen(false); };
  const go = (next: View) => { setText(""); setPicked([]); setView(next); };
  const toggle = (name: string) => setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));

  const named = (title: string, placeholder: string, example: string, insert: (value: string) => void) => {
    const value = text.trim();
    const valid = /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) || (view === "device" && /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(value));
    return (
      <form className="space-y-2 p-3" onSubmit={(e) => { e.preventDefault(); if (valid) done(() => insert(value)); }}>
        <label className="block space-y-1 text-sm">
          <span>{title}</span>
          <Input autoFocus value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
        </label>
        <p className="text-xs text-muted-foreground">{example}</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setView("menu")}>Back</Button>
          <Button type="submit" size="sm" disabled={!valid}>Insert</Button>
        </div>
      </form>
    );
  };

  return (
    <Popover modal open={open} onOpenChange={(o) => { setOpen(o); if (o) go("menu"); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" title="Insert a placeholder, block or list at the cursor">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Insert <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        {view === "menu" && (
          <Command>
            <CommandInput placeholder="Search" />
            <CommandList className="max-h-96">
              <CommandEmpty>Nothing matches.</CommandEmpty>
              <CommandGroup heading="Value typed in when applying">
                {names.map((n) => (
                  <CommandItem key={`v-${n}`} value={`variable ${n}`} onSelect={() => done(() => onPlaceholder(n))}>
                    {n}<Hint>{`\${${n}}`}</Hint>
                  </CommandItem>
                ))}
                <CommandItem value="variable new" onSelect={() => go("variable")}>
                  New variable…<Hint>{"${speed}"}</Hint>
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="From the device">
                <CommandItem value="device field metadata" onSelect={() => go("device")}>
                  Device field…<Hint>{"${device.name}"}</Hint>
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="From a machine (endpoint) on the device">
                <CommandItem value="endpoint ip" onSelect={() => done(() => onPlaceholder("endpoint.ip"))}>
                  Endpoint IP<Hint>{"${endpoint.ip}"}</Hint>
                </CommandItem>
                <CommandItem value="endpoint name" onSelect={() => done(() => onPlaceholder("endpoint.name"))}>
                  Endpoint name<Hint>{"${endpoint.name}"}</Hint>
                </CommandItem>
                <CommandItem value="service port" onSelect={() => done(() => onPlaceholder("service.port"))}>
                  Service port<Hint>{"${service.port}"}</Hint>
                </CommandItem>
                <CommandItem value="named endpoint second more than one" onSelect={() => go("endpoint")}>
                  Another endpoint (named)…<Hint>{"${endpoint[plc].ip}"}</Hint>
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Reusable parts">
                {usable.map((b) => (
                  <CommandItem key={`b-${b.id}`} value={`block ${b.name} ${b.description ?? ""}`} onSelect={() => done(() => onBlock(b.name))}>
                    <span className="min-w-0 truncate">Block: {b.name}</span><Hint>{"{\"$ref\": …}"}</Hint>
                  </CommandItem>
                ))}
                {usable.length === 0 && (
                  <CommandItem value="block none" disabled>
                    <span className="text-xs text-muted-foreground">No block in this template group</span>
                  </CommandItem>
                )}
                {allowLists && usable.length > 0 && (
                  <CommandItem value="list of blocks entries" onSelect={() => go("list")}>
                    List of blocks…<Hint>{"{\"$list\": …}"}</Hint>
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
        {view === "variable" && named("Variable name", "e.g. speed", "Added to Variables automatically; set its type and label there.",
                                      (n) => onPlaceholder(n))}
        {view === "device" && named("Device field", "e.g. name, city", "Taken from the device's metadata; nothing is asked when applying.",
                                    (f) => onPlaceholder(`device.${f}`))}
        {view === "endpoint" && named("Endpoint name", "e.g. plc", "Use a name when the template needs more than one endpoint: each name gets its own dropdown. Inserts its IP; write .name or a service with ${service[plc].port}.",
                                      (n) => onPlaceholder(`endpoint[${n}].ip`))}
        {view === "list" && (
          <div className="space-y-2 p-3">
            <p className="text-sm">Blocks the user can choose for each entry</p>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {usable.map((b) => (
                <li key={b.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={picked.includes(b.name)} onChange={() => toggle(b.name)} />
                    <span className="truncate">{b.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <label className="block space-y-1 text-sm">
              <span>Item label (optional)</span>
              <Input value={text} maxLength={64} placeholder="e.g. Slave" onChange={(e) => setText(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setView("menu")}>Back</Button>
              <Button type="button" size="sm" disabled={picked.length === 0}
                      onClick={() => done(() => onList(picked, text.trim() || undefined))}>
                Insert
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
