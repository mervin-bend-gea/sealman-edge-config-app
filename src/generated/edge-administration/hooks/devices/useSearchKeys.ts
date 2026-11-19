import { keepPreviousData } from "@tanstack/react-query";
import { edgeApi } from "@/generated/edge-administration/api";

/** The most used fields of the endpoints / services (those matching `query`, when given); the
 * backend caps the list and says whether more exist. */
export default function useSearchKeys(type: "endpoint" | "service", query: string) {
  const trimmed = query.trim();
  return edgeApi.useQuery(
    "get",
    "/devices/search/keys",
    { params: { query: { type, q: trimmed || undefined } } },
    { staleTime: 30_000, retry: false, placeholderData: keepPreviousData },
  );
}
