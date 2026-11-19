import { useMemo } from "react";
import useDeviceStore from "../deviceStore";
import useSearchDevices, { type DeviceSearchMatch, type DeviceSearchRequest } from "@/generated/edge-administration/hooks/devices/useSearchDevices";
import { chipsToFilters, columnFiltersToRequest } from "./deviceSearch";

export interface DeviceSearchState {
  /** A quick search, chip filter or column filter is active. */
  active: boolean;
  /** Chips or a quick search can expand rows to show the matching fields. */
  expandable: boolean;
  /** Values highlighted in the match details. */
  terms: string[];
  matchesByDevice: Map<string, DeviceSearchMatch[]>;
  isFetching: boolean;
  isStale: boolean;
  error: unknown;
}

/**
 * Advanced chips are ANDed together. A free-text search is ORed across the four searchable
 * categories by issuing one request per category and merging the matching devices. When chips
 * are also active, each category request includes those chips, preserving their AND semantics.
 */
export default function useDeviceSearch(): DeviceSearchState {
  const chips = useDeviceStore.use.searchChips();
  const columnValueFilters = useDeviceStore.use.columnValueFilters();
  const globalFilter = useDeviceStore.use.globalFilter();
  const quickTerm = globalFilter.trim();

  const commonFilters = useMemo(() => chipsToFilters(chips), [chips]);
  const columnFilters = useMemo(() => columnFiltersToRequest(columnValueFilters), [columnValueFilters]);
  const baseBody = useMemo<DeviceSearchRequest>(
    () => ({ filters: commonFilters, column_filters: columnFilters }),
    [commonFilters, columnFilters],
  );
  const baseActive = commonFilters.length > 0 || columnFilters.length > 0;

  // Only one of these modes is enabled at a time. The four quick-search requests are separate
  // because the endpoint applies AND between filters, while a single search box needs OR.
  const filteredQuery = useSearchDevices(baseBody, baseActive && quickTerm.length === 0);
  const deviceIdQuery = useSearchDevices(
    { filters: [...commonFilters, { type: "device_id", value: quickTerm }], column_filters: columnFilters },
    quickTerm.length > 0,
  );
  const metadataQuery = useSearchDevices(
    { filters: [...commonFilters, { type: "metadata", value: quickTerm }], column_filters: columnFilters },
    quickTerm.length > 0,
  );
  const endpointQuery = useSearchDevices(
    { filters: [...commonFilters, { type: "endpoint", value: quickTerm }], column_filters: columnFilters },
    quickTerm.length > 0,
  );
  const serviceQuery = useSearchDevices(
    { filters: [...commonFilters, { type: "service", value: quickTerm }], column_filters: columnFilters },
    quickTerm.length > 0,
  );

  const active = baseActive || quickTerm.length > 0;
  const activeQueries = quickTerm.length > 0
    ? [deviceIdQuery, metadataQuery, endpointQuery, serviceQuery]
    : [filteredQuery];

  const matchesByDevice = useMemo(() => {
    const merged = new Map<string, DeviceSearchMatch[]>();
    for (const query of activeQueries) {
      for (const item of query.data?.items ?? []) {
        const existing = merged.get(item.device_id) ?? [];
        const seen = new Set(existing.map((match) => `${match.kind}:${match.endpoint_id ?? ""}:${match.service_id ?? ""}:${match.fields.map((field) => `${field.key ?? ""}=${field.value}`).join("|")}`));
        for (const match of item.matches) {
          const key = `${match.kind}:${match.endpoint_id ?? ""}:${match.service_id ?? ""}:${match.fields.map((field) => `${field.key ?? ""}=${field.value}`).join("|")}`;
          if (!seen.has(key)) {
            existing.push(match);
            seen.add(key);
          }
        }
        merged.set(item.device_id, existing);
      }
    }
    return merged;
  }, [
    quickTerm,
    filteredQuery.data,
    deviceIdQuery.data,
    metadataQuery.data,
    endpointQuery.data,
    serviceQuery.data,
  ]);

  const terms = useMemo(
    () => [...chips.map((chip) => chip.value), ...(quickTerm ? [quickTerm] : [])],
    [chips, quickTerm],
  );
  const allQueriesFailed = activeQueries.length > 0 && activeQueries.every((query) => query.isError);

  return {
    active,
    expandable: active,
    terms,
    matchesByDevice,
    isFetching: active && activeQueries.some((query) => query.isFetching),
    isStale: active && activeQueries.some((query) => query.isPlaceholderData),
    error: allQueriesFailed ? activeQueries.find((query) => query.error)?.error : null,
  };
}
