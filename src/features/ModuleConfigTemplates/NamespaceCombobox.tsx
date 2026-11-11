import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Namespace } from "./api";

/** Single choice of a namespace with a search field (there can be many). */
export default function NamespaceCombobox({ id, namespaces, value, onChange, disabled }: {
  id?: string;
  namespaces: Namespace[];
  value: number | null;
  onChange: (namespaceId: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = namespaces.find((n) => n.id === value);
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
                className="w-full justify-between px-3 font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.name ?? "Select a namespace"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search namespaces" />
          <CommandList>
            <CommandEmpty>No namespace found.</CommandEmpty>
            <CommandGroup>
              {namespaces.map((n) => (
                <CommandItem key={n.id} value={`${n.name} ${n.module_names.join(" ")}`}
                             onSelect={() => { onChange(n.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", n.id === value ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                  <span className="truncate">{n.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
