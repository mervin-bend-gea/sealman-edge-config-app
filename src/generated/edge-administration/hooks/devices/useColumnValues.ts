import { keepPreviousData } from "@tanstack/react-query";
import { edgeApi } from "@/generated/edge-administration/api";

/** The distinct values of a metadata field (optionally narrowed by `query`) the user may see,
 * for the filter popup of a table column. Capped by the backend: `has_more` says so. */
export default function useColumnValues(field: string, query: string, enabled: boolean) {
  const trimmed = query.trim();
  return edgeApi.useQuery(
    "get",
    "/devices/search/column-values",
    { params: { query: { field, q: trimmed || undefined } } },
    {
      enabled,
      placeholderData: keepPreviousData,
      staleTime: 30_000,
      retry: false,
    },
  );
}
