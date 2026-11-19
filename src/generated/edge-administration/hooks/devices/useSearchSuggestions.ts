import { edgeApi } from "@/generated/edge-administration/api";
import type { DeviceSearchFilterType } from "./useSearchDevices";

/** The backend refuses shorter queries. */
export const MIN_SUGGESTION_LENGTH = 3;

/** Values matching `query` for the autocomplete of a filter, limited to what the user may see. */
export default function useSearchSuggestions(type: DeviceSearchFilterType, field: string | undefined, query: string) {
  const trimmed = query.trim();
  return edgeApi.useQuery(
    "get",
    "/devices/search/suggestions",
    { params: { query: { type, field, q: trimmed } } },
    {
      enabled: trimmed.length >= MIN_SUGGESTION_LENGTH,
      staleTime: 30_000,
      retry: false,
    },
  );
}
