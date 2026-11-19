import { XMarkIcon } from "@heroicons/react/24/outline";
import useDeviceMetadataFields from "@/features/PlatformTypes/useDeviceMetadataFields";
import useDeviceStore from "../deviceStore";
import AddFilterPopover from "./AddFilterPopover";
import { chipKey } from "./deviceSearch";

/** The advanced-search chips ("City: Berlin ×"), "Add Filter" and "Clear All Filters". Meant to sit
 * next to the status pills. */
export default function SearchFilterChips({ className = "contents" }: { className?: string }) {
  const chips = useDeviceStore.use.searchChips();
  const setSearchChips = useDeviceStore.use.setSearchChips();
  const columnValueFilters = useDeviceStore.use.columnValueFilters();
  const setColumnValueFilter = useDeviceStore.use.setColumnValueFilter();
  const { fields: metadataFields } = useDeviceMetadataFields();
  const metadataLabels = new Map(metadataFields.map(([key, field]) => [key, field.label]));
  const clearSearchFilters = useDeviceStore.use.clearSearchFilters();
  const globalFilter = useDeviceStore.use.globalFilter();
  const setGlobalFilter = useDeviceStore.use.setGlobalFilter();
  const hasAdvancedFilters = chips.length > 0 || Object.keys(columnValueFilters).length > 0;
  const hasFilters = hasAdvancedFilters || globalFilter !== "";

  // Not the status filter (Online / Offline): that is its own control.
  const clearAll = () => {
    clearSearchFilters();
    setGlobalFilter("");
  };

  return (
    <div className={className}>
      <AddFilterPopover hasFilters={hasAdvancedFilters} />
      {chips.map((chip) => (
        <span
          key={chipKey(chip)}
          className="inline-flex max-w-xs items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-3 pr-1 text-xs font-medium text-blue-700"
        >
          <span className="truncate">
            {chip.label}: {chip.value}
          </span>
          <button
            type="button"
            aria-label={`Remove filter ${chip.label}: ${chip.value}`}
            onClick={() => setSearchChips(chips.filter((existing) => chipKey(existing) !== chipKey(chip)))}
            className="rounded-full p-0.5 hover:bg-blue-100"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      {Object.entries(columnValueFilters).flatMap(([field, values]) =>
        values.map((value) => (
          <span key={`column:${field}:${value}`} className="inline-flex max-w-xs items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-3 pr-1 text-xs font-medium text-blue-700">
            <span className="truncate">{metadataLabels.get(field) ?? field}: {value}</span>
            <button
              type="button"
              aria-label={`Remove filter ${metadataLabels.get(field) ?? field}: ${value}`}
              onClick={() => setColumnValueFilter(field, values.filter((item) => item !== value))}
              className="rounded-full p-0.5 hover:bg-blue-100"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        )),
      )}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
}
