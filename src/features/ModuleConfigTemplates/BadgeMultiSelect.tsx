import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

/**
 * A select that adds what you pick as removable badges. `emptyText` is shown while nothing is selected.
 */
export default function BadgeMultiSelect({
  id,
  selected,
  onChange,
  options,
  renderBadge,
  emptyText,
  addLabel,
  searchPlaceholder,
  disabled,
  className,
}: {
  id: string;
  selected: string[];
  onChange: (selected: string[]) => void;
  options: MultiSelectOption[];
  /** Renders one selected value as a badge; `label` is the option's label (the value if it is not an option). */
  renderBadge: (value: string, label: string, onRemove?: () => void) => ReactNode;
  emptyText: string;
  addLabel: string;
  searchPlaceholder: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const labelOf = (value: string) => options.find((o) => o.value === value)?.label ?? value;
  const remaining = options.filter((o) => !selected.includes(o.value));

  const add = (value: string) => {
    onChange([...selected, value]);
    setSearch("");
    setOpen(false);
  };

  return (
    <div id={id} className={cn("flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5", className)}>
      {selected.length === 0 && <span className="text-sm text-muted-foreground">{emptyText}</span>}
      {selected.map((value) => renderBadge(value, labelOf(value), disabled ? undefined : () => onChange(selected.filter((v) => v !== value))))}
      {!disabled && (
        <Popover modal open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="ml-auto h-6 gap-1 px-2 text-xs" aria-label={addLabel}>
              <Plus className="h-3 w-3" aria-hidden="true" /> Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <Command>
              <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>Nothing left to add.</CommandEmpty>
                <CommandGroup>
                  {remaining.map((option) => (
                    <CommandItem key={option.value} value={`${option.label} ${option.value}`} onSelect={() => add(option.value)}>
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
