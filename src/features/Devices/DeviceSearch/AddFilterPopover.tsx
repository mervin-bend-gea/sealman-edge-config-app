import { useId, useMemo, useState } from "react";
import { ArrowLeftIcon, ChevronRightIcon, FunnelIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import useDeviceMetadataFields from "@/features/PlatformTypes/useDeviceMetadataFields";
import useSearchKeys from "@/generated/edge-administration/hooks/devices/useSearchKeys";
import useSearchSuggestions, { MIN_SUGGESTION_LENGTH } from "@/generated/edge-administration/hooks/devices/useSearchSuggestions";
import { getErrorMessage } from "@/lib/errors";
import useDeviceStore from "../deviceStore";
import { addSearchChip, buildSearchParameters, MAX_SEARCH_VALUE_LENGTH, SearchParameter } from "./deviceSearch";
import useDebouncedValue from "./useDebouncedValue";

/** "Add Filter": pick what to filter on, enter the value (with suggestions), and it becomes a chip. */
export default function AddFilterPopover({ hasFilters }: { hasFilters: boolean }) {
  const { fields } = useDeviceMetadataFields();
  const parameters = useMemo(() => buildSearchParameters(fields), [fields]);
  const chips = useDeviceStore.use.searchChips();
  const setSearchChips = useDeviceStore.use.setSearchChips();

  const [open, setOpen] = useState(false);
  const [parameter, setParameter] = useState<SearchParameter | null>(null);
  // The field picked for endpoints / services; `field` is undefined for "Any field".
  const [pickedField, setPickedField] = useState<{ field?: string; label: string } | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setParameter(null);
      setPickedField(null);
    }
  };

  const addFilter = (value: string) => {
    if (!parameter) return;
    setSearchChips(
      addSearchChip(chips, {
        type: parameter.type,
        field: pickedField?.field ?? parameter.field,
        label: pickedField?.field ? `${parameter.label} › ${pickedField.label}` : parameter.label,
        value,
      }),
    );
    handleOpenChange(false);
  };

  const needsFieldPick = parameter?.fieldPicker !== undefined && pickedField === null;
  const goBack = () => {
    if (parameter?.fieldPicker && pickedField) setPickedField(null);
    else setParameter(null);
  };
  const valueParameter =
    parameter && pickedField?.field
      ? { ...parameter, field: pickedField.field, label: `${parameter.label} › ${pickedField.label}` }
      : parameter;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <FunnelIcon className="h-3.5 w-3.5" />
          {hasFilters ? "Add Filter" : "Apply Filters"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        {parameter && needsFieldPick && parameter.fieldPicker ? (
          <FieldStep parameter={parameter} kind={parameter.fieldPicker} onBack={goBack} onPick={setPickedField} />
        ) : valueParameter ? (
          <ValueStep parameter={valueParameter} onBack={goBack} onSubmit={addFilter} />
        ) : (
          <div role="menu" aria-label="Filter by" className="max-h-72 overflow-y-auto p-1">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Filter by</p>
            {parameters.map((item) =>
              item.fieldPicker ? (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  onClick={() => setParameter(item)}
                  className="mt-1 flex w-full items-center justify-between rounded-sm border border-blue-100 bg-blue-50/60 px-2 py-1.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-100 focus-visible:bg-blue-100 focus-visible:outline-hidden"
                >
                  {item.label}
                  <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => setParameter(item)}
                  className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-hidden"
                >
                  {item.label}
                </button>
              ),
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Second step for endpoints / services: which field to search (or any of them). */
function FieldStep({
  parameter,
  kind,
  onBack,
  onPick,
}: {
  parameter: SearchParameter;
  kind: "endpoint" | "service";
  onBack: () => void;
  onPick: (picked: { field?: string; label: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 250);
  const keys = useSearchKeys(kind, debounced);
  const items = keys.data?.keys ?? [];
  const itemClass =
    "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-hidden";

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onBack} aria-label="Back to filter list">
          <ArrowLeftIcon />
        </Button>
        <span className="text-sm font-medium">{parameter.label}</span>
      </div>
      <Input
        autoFocus
        value={search}
        maxLength={MAX_SEARCH_VALUE_LENGTH}
        placeholder="Find a field"
        aria-label={`Find a ${parameter.label} field`}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (items[0]) onPick({ field: items[0].key, label: items[0].label });
        }}
      />
      <div role="menu" aria-label={`${parameter.label} field`} className="max-h-60 overflow-y-auto">
        <button type="button" role="menuitem" className={itemClass} onClick={() => onPick({ label: "Any field" })}>
          Any field
        </button>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => onPick({ field: item.key, label: item.label })}
          >
            <span className="truncate">{item.label}</span>
            {item.label !== item.key && <span className="truncate text-xs text-muted-foreground">{item.key}</span>}
          </button>
        ))}
      </div>
      <div className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
        {keys.isLoading && "Loading fields..."}
        {keys.isError && <span className="text-destructive">Could not load fields: {getErrorMessage(keys.error)}</span>}
        {keys.data && items.length === 0 && "No matching fields."}
        {keys.data?.has_more && `Showing the ${items.length} most used fields - type to narrow down.`}
      </div>
    </div>
  );
}

function ValueStep({
  parameter,
  onBack,
  onSubmit,
}: {
  parameter: SearchParameter;
  onBack: () => void;
  onSubmit: (value: string) => void;
}) {
  const listId = useId();
  const [value, setValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounced = useDebouncedValue(value, 300);
  const suggestions = useSearchSuggestions(parameter.type, parameter.field, debounced);

  const trimmed = value.trim();
  const canSuggest = trimmed.length >= MIN_SUGGESTION_LENGTH;
  // the request is for what was typed a moment ago while the user keeps typing
  const waiting = canSuggest && (debounced.trim() !== trimmed || suggestions.isFetching);
  const items = canSuggest && !waiting && !suggestions.isError ? (suggestions.data?.values ?? []) : [];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && items.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp" && items.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? items.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) onSubmit(items[activeIndex]);
      else if (trimmed !== "") onSubmit(trimmed);
    }
  };

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onBack} aria-label="Back to filter list">
          <ArrowLeftIcon />
        </Button>
        <span className="text-sm font-medium">{parameter.label}</span>
      </div>

      <Input
        autoFocus
        value={value}
        maxLength={MAX_SEARCH_VALUE_LENGTH}
        placeholder={`${parameter.label} value`}
        aria-label={`${parameter.label} value`}
        role="combobox"
        aria-expanded={items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
      />

      <div className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
        {!canSuggest && `Type at least ${MIN_SUGGESTION_LENGTH} characters to see matching suggestions.`}
        {waiting && "Searching..."}
        {canSuggest && !waiting && suggestions.isError && (
          <span className="text-destructive">Could not load suggestions: {getErrorMessage(suggestions.error)}</span>
        )}
        {canSuggest && !waiting && !suggestions.isError && items.length === 0 && "No matching suggestions."}
      </div>

      {items.length > 0 && (
        <ul id={listId} role="listbox" aria-label="Suggestions" className="max-h-48 overflow-y-auto rounded-md border p-1">
          {items.map((item, index) => (
            <li
              key={item}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onSubmit(item)}
              className={`cursor-pointer break-all rounded-sm px-2 py-1.5 text-sm ${index === activeIndex ? "bg-accent" : "hover:bg-accent"}`}
            >
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground">
          {parameter.exact ? "Matches the whole value, ignoring case." : "Matches values containing the text."}
        </p>
        <Button type="button" size="sm" disabled={trimmed === ""} onClick={() => onSubmit(trimmed)}>
          Add
        </Button>
      </div>
    </div>
  );
}
