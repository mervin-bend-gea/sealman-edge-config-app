import { keepPreviousData } from "@tanstack/react-query";
import { edgeApi } from "@/generated/edge-administration/api";
import type { components } from "@/generated/edge-administration/types";

export type DeviceSearchRequest = components["schemas"]["DeviceSearchRequest"];
export type DeviceSearchFilter = components["schemas"]["DeviceSearchFilter"];
export type DeviceColumnFilter = components["schemas"]["DeviceColumnFilter"];
export type DeviceSearchResponse = components["schemas"]["DeviceSearchResponse"];
export type DeviceSearchMatch = components["schemas"]["DeviceSearchMatch"];
export type DeviceSearchFilterType = DeviceSearchFilter["type"];

/**
 * Ids of the devices satisfying ALL the filters AND ALL the column filters (the backend applies
 * the user's access rules), each with what matched. Only runs when `enabled` - i.e. when there
 * is at least one filter; the previous result is kept while a changed request loads.
 */
export default function useSearchDevices(body: DeviceSearchRequest, enabled: boolean) {
  return edgeApi.useQuery("post", "/devices/search", { body }, {
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
