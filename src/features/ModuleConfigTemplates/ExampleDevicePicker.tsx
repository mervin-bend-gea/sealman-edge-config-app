import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { InlineAlert } from "@/components/ui/page-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useExampleDevices, type ExampleDevice } from "./api";
import { deviceLabel, useDebounced } from "./utils";

/** Searchable choice of an example device of a namespace (readable by the user, within the namespace's scopes). */
export default function ExampleDevicePicker({ id, namespaceId, selected, onSelect }: {
  id?: string;
  namespaceId: number | null;
  selected: ExampleDevice | null;
  onSelect: (device: ExampleDevice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 250);
  const devices = useExampleDevices(namespaceId, q, open || selected === null);

  return (
    <div className="space-y-2">
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={namespaceId === null}
                  className="w-full max-w-xl justify-between px-3 font-normal">
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? deviceLabel(selected) : "Select an example device"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search by id or metadata" value={search} onValueChange={setSearch} />
            <CommandList>
              {devices.isError && <p className="p-3 text-sm text-red-700">{getErrorMessage(devices.error)}</p>}
              <CommandEmpty>{devices.isFetching ? "Searching..." : "No device found."}</CommandEmpty>
              <CommandGroup>
                {(devices.data ?? []).map((device) => (
                  <CommandItem key={device.device_id} value={device.device_id}
                               onSelect={() => { onSelect(device); setOpen(false); setSearch(""); }}>
                    <Check className={cn("mr-2 h-4 w-4", selected?.device_id === device.device_id ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                    <span className="truncate">{deviceLabel(device)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {devices.data?.length === 0 && !q && !selected && (
        <InlineAlert variant="info">
          No device is available for this namespace: none is in your scopes and in the namespace's scopes at the same time.
        </InlineAlert>
      )}
    </div>
  );
}
