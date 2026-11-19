import { FunnelIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import DebouncedInput from "@/components/Input/DebouncedInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DeviceSearchFilter } from "@/generated/edge-administration/hooks/devices/useSearchDevices";
import useDeviceStore from "../deviceStore";
import { DEVICE_SEARCH_FILTERS, MAX_SEARCH_TERM_LENGTH } from "./deviceSearch";

/**
 * Device search bar. Without filter chips it is the plain quick search (device ID and metadata,
 * in the browser). Selecting filters adds removable chips; the text is then searched on the
 * server in the selected places only.
 */
export default function DeviceSearchBar({ className }: { className?: string }) {
  const filters = useDeviceStore.use.searchFilters();
  const setSearchFilters = useDeviceStore.use.setSearchFilters();
  const globalFilter = useDeviceStore.use.globalFilter();
  const setGlobalFilter = useDeviceStore.use.setGlobalFilter();

  const setFilter = (key: DeviceSearchFilter, selected: boolean) =>
    setSearchFilters(
      DEVICE_SEARCH_FILTERS.filter((f) => (f.key === key ? selected : filters.includes(f.key))).map((f) => f.key),
    );

  return (
    <div
      className={`flex min-w-72 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 shadow-xs focus-within:ring-1 focus-within:ring-ring ${className ?? ""}`}
    >
      <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      {DEVICE_SEARCH_FILTERS.filter((f) => filters.includes(f.key)).map((f) => (
        <Badge key={f.key} variant="secondary" className="gap-1 py-0.5 pr-1" data-testid={`search-chip-${f.key}`}>
          {f.label}
          <button
            type="button"
            aria-label={`Remove ${f.label} filter`}
            onClick={() => setFilter(f.key, false)}
            className="rounded-sm p-0.5 hover:bg-black/10 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            <XMarkIcon className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <div className="min-w-24 flex-1">
        <DebouncedInput
          type="text"
          name="filter"
          value={globalFilter}
          onChange={(value) => setGlobalFilter(value as string)}
          onKeyDown={(ev) => {
            // Backspace in an empty box removes the last chip.
            if (ev.key === "Backspace" && ev.currentTarget.value === "" && filters.length > 0) {
              setFilter(filters[filters.length - 1], false);
            }
          }}
          placeholder={filters.length > 0 ? "Search in the selected filters" : "Search device ID or metadata"}
          maxLength={MAX_SEARCH_TERM_LENGTH}
          className="h-7 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" aria-label="Select search filters">
            <FunnelIcon className="h-4 w-4" />
            Filters
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Search in</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {DEVICE_SEARCH_FILTERS.map((f) => (
            <DropdownMenuCheckboxItem
              key={f.key}
              checked={filters.includes(f.key)}
              onCheckedChange={(checked) => setFilter(f.key, checked === true)}
              // keep the menu open so several filters can be picked in one go
              onSelect={(ev) => ev.preventDefault()}
            >
              {f.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
