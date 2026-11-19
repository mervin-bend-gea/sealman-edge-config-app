import type {
  DeviceSearchFilter,
  DeviceSearchMatch,
} from "@/generated/edge-administration/hooks/devices/useSearchDevices";

export const DEVICE_SEARCH_FILTERS: { key: DeviceSearchFilter; label: string }[] = [
  { key: "device_id", label: "Device ID" },
  { key: "metadata", label: "Metadata" },
  { key: "endpoint", label: "Endpoints" },
  { key: "service", label: "Services" },
];

export const MAX_SEARCH_TERM_LENGTH = 100;

/** Query param of the Assets page naming the endpoint to scroll to and flash. */
export const ASSETS_HIGHLIGHT_PARAM = "highlight";

/** Where "Jump to Page" goes: ids and metadata live on the device's Info page, endpoints and
 * services on its Assets page (a service is shown inside its endpoint, so that one is flashed). */
export function getDeviceSearchJumpPath(deviceId: string, match: DeviceSearchMatch): string {
  const base = `/devices/${deviceId}`;
  if (match.kind === "endpoint" || match.kind === "service") {
    const params = new URLSearchParams();
    if (match.endpoint_id) params.set(ASSETS_HIGHLIGHT_PARAM, match.endpoint_id);
    const query = params.toString();
    return `${base}/assets${query ? `?${query}` : ""}`;
  }
  return base;
}

/** The endpoint to flash, from a location search string such as "?highlight=abc". */
export function readAssetsHighlight(search: string): string | null {
  return new URLSearchParams(search).get(ASSETS_HIGHLIGHT_PARAM) || null;
}

/** Splits `text` into parts, marking those equal (case-insensitively) to `term`. */
export function splitByTerm(text: string, term: string): { text: string; match: boolean }[] {
  const needle = term.trim().toLowerCase();
  if (needle === "") return [{ text, match: false }];
  const haystack = text.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let from = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}
