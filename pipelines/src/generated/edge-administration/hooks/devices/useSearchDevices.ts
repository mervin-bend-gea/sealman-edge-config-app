import { keepPreviousData } from "@tanstack/react-query";
import { edgeApi } from "@/generated/edge-administration/api";
import type { components } from "@/generated/edge-administration/types";

export type DeviceSearchFilter = "device_id" | "metadata" | "endpoint" | "service";
export type DeviceSearchResponse = components["schemas"]["DeviceSearchResponse"];
export type DeviceSearchMatch = components["schemas"]["DeviceSearchMatch"];

/** Devices matching `term` in ANY of the selected `filters`, with what matched. Only the devices
 * the caller is authorized for are searched (enforced by the API). Disabled until there is a term. */
export default function useSearchDevices(term: string, filters: DeviceSearchFilter[]) {
  const trimmed = term.trim();
  const query: Partial<Record<DeviceSearchFilter, string[]>> = {};
  for (const filter of filters) query[filter] = [trimmed];

  return edgeApi.useQuery(
    "get",
    "/devices/search",
    { params: { query } },
    {
      enabled: trimmed !== "" && filters.length > 0,
      // Keep showing the previous results while a changed term/filter set loads.
      placeholderData: keepPreviousData,
    },
  );
}
