import { useMemo } from "react";
import useDeviceStore from "../deviceStore";
import useSearchDevices, {
  DeviceSearchFilter,
  DeviceSearchMatch,
} from "@/generated/edge-administration/hooks/devices/useSearchDevices";

export interface DeviceSearchState {
  /** At least one filter chip is selected: the API search replaces the plain quick search. */
  active: boolean;
  /** Active and the user typed something: results are being shown. */
  hasTerm: boolean;
  term: string;
  filters: DeviceSearchFilter[];
  matchesByDevice: Map<string, DeviceSearchMatch[]>;
  isFetching: boolean;
  /** The shown results belong to the previous term/filters while the new ones load. */
  isStale: boolean;
  error: unknown;
}

/** Advanced search state: the filter chips and the search text come from the device store. */
export default function useDeviceSearch(): DeviceSearchState {
  const filters = useDeviceStore.use.searchFilters();
  const globalFilter = useDeviceStore.use.globalFilter();
  const active = filters.length > 0;
  const term = active ? globalFilter.trim() : "";
  const hasTerm = term !== "";
  const query = useSearchDevices(term, filters);

  const matchesByDevice = useMemo(
    () => new Map((hasTerm ? query.data?.items : undefined)?.map((item) => [item.device_id, item.matches]) ?? []),
    [hasTerm, query.data],
  );

  return {
    active,
    hasTerm,
    term,
    filters,
    matchesByDevice,
    isFetching: hasTerm && query.isFetching,
    isStale: hasTerm && query.isPlaceholderData,
    error: hasTerm ? query.error : null,
  };
}
