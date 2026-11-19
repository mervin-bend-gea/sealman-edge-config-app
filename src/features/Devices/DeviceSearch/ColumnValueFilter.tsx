import { useState } from "react";
import { FunnelIcon } from "@heroicons/react/24/outline";
import { FunnelIcon as FunnelSolidIcon } from "@heroicons/react/24/solid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import useColumnValues from "@/generated/edge-administration/hooks/devices/useColumnValues";
import { getErrorMessage } from "@/lib/errors";
import useDeviceStore from "../deviceStore";
import { MAX_SEARCH_VALUE_LENGTH } from "./deviceSearch";
import useDebouncedValue from "./useDebouncedValue";

const NO_VALUES: string[] = [];

/** Filter icon for the header of a metadata column: pick the values the column should have.
 * The values of a column are alternatives (OR); other columns and the chips still have to match. */
export default function ColumnValueFilter({ field, label }: { field: string; label: string }) {
  const selected = useDeviceStore((state) => state.columnValueFilters[field]) ?? NO_VALUES;
  const setColumnValueFilter = useDeviceStore.use.setColumnValueFilter();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const query = useColumnValues(field, debouncedSearch, open);

  const fetched = query.data?.values ?? [];
  // selected values the (capped or narrowed) list doesn't contain stay visible so they can be unticked
  const values = search.trim() === "" ? [...selected.filter((value) => !fetched.includes(value)), ...fetched] : fetched;
  const active = selected.length > 0;

  const toggle = (value: string) =>
    setColumnValueFilter(field, selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={active ? `Filter ${label} (${selected.length} selected)` : `Filter ${label}`}
          data-active={active}
          className={`inline-flex items-center gap-0.5 rounded-sm p-0.5 align-middle transition-colors hover:bg-slate-200 ${
            active ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {active ? <FunnelSolidIcon className="h-3.5 w-3.5" /> : <FunnelIcon className="h-3.5 w-3.5" />}
          {active && <span className="text-[10px] font-semibold leading-none">{selected.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 normal-case tracking-normal">
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium text-muted-foreground">Filter {label}</p>
          <Input
            value={search}
            maxLength={MAX_SEARCH_VALUE_LENGTH}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search values"
            aria-label={`Search ${label} values`}
            className="h-8"
          />
          <div className="max-h-56 overflow-y-auto" role="group" aria-label={`${label} values`}>
            {query.isError ? (
              <p className="px-1 py-2 text-xs text-destructive">Could not load values: {getErrorMessage(query.error)}</p>
            ) : query.isLoading ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">Loading values...</p>
            ) : values.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">No values.</p>
            ) : (
              values.map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-accent">
                  <input type="checkbox" checked={selected.includes(value)} onChange={() => toggle(value)} className="cursor-pointer" />
                  <span className="break-all">{value}</span>
                </label>
              ))
            )}
          </div>
          {query.data?.has_more && (
            <p className="px-1 text-xs text-muted-foreground">More values exist. Search to narrow the list.</p>
          )}
          <div className="flex justify-end border-t pt-2">
            <Button type="button" size="sm" variant="ghost" disabled={!active} onClick={() => setColumnValueFilter(field, [])}>
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
