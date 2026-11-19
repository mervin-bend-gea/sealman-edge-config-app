import type {
  DeviceColumnFilter,
  DeviceSearchFilter,
  DeviceSearchFilterType,
  DeviceSearchMatch,
} from "@/generated/edge-administration/hooks/devices/useSearchDevices";

export const MAX_SEARCH_VALUE_LENGTH = 100;

/** Query param of the Assets page naming the endpoint to scroll to and flash. */
export const ASSETS_HIGHLIGHT_PARAM = "highlight";

/** A search filter chip: "<label>: <value>". A device has to match all chips. */
export interface SearchChip {
  type: DeviceSearchFilterType;
  /** The field, for a chip of type "field" (e.g. "city") or an endpoint / service chip on one field. */
  field?: string;
  /** What the chip shows in front of the value (e.g. "City"). */
  label: string;
  value: string;
}

/** Something a filter can be set on, as offered by "Add Filter". */
export interface SearchParameter {
  id: string;
  type: DeviceSearchFilterType;
  field?: string;
  label: string;
  /** The value has to equal the device's value (ignoring case); otherwise it only has to be
   * contained in one of them. */
  exact: boolean;
  /** Offers to pick one field of the endpoints / services before entering the value. */
  fieldPicker?: "endpoint" | "service";
}

/** Device ID, one entry per metadata field (Country, City, ...), Endpoints and Services. The
 * "metadata" filter type still exists in the API but is not offered. */
export function buildSearchParameters(fields: [string, { label: string }][]): SearchParameter[] {
  return [
    { id: "device_id", type: "device_id", label: "Device ID", exact: true },
    ...fields.map(([key, field]): SearchParameter => ({
      id: `field:${key}`,
      type: "field",
      field: key,
      label: field.label,
      exact: true,
    })),
    { id: "endpoint", type: "endpoint", label: "Endpoints", exact: false, fieldPicker: "endpoint" },
    { id: "service", type: "service", label: "Services", exact: false, fieldPicker: "service" },
  ];
}

export const chipKey = (chip: Pick<SearchChip, "type" | "field" | "value">) =>
  `${chip.type}|${chip.field ?? ""}|${chip.value.toLowerCase()}`;

/** `chips` plus `chip`, unless an equal chip is already there. */
export function addSearchChip(chips: SearchChip[], chip: SearchChip): SearchChip[] {
  const value = chip.value.trim();
  if (value === "") return chips;
  const added = { ...chip, value };
  return chips.some((existing) => chipKey(existing) === chipKey(added)) ? chips : [...chips, added];
}

export function chipsToFilters(chips: SearchChip[]): DeviceSearchFilter[] {
  return chips.map((chip) => ({
    type: chip.type,
    ...(chip.field ? { field: chip.field } : {}),
    value: chip.value,
  }));
}

export function columnFiltersToRequest(columnValueFilters: Record<string, string[]>): DeviceColumnFilter[] {
  return Object.entries(columnValueFilters)
    .filter(([, values]) => values.length > 0)
    .map(([field, values]) => ({ field, values }));
}

/** Every "Jump to Page" action opens Assets. Endpoint/service matches also request a highlight. */
export function getDeviceSearchJumpPath(deviceId: string, match: DeviceSearchMatch): string {
  const params = new URLSearchParams();
  if ((match.kind === "endpoint" || match.kind === "service") && match.endpoint_id) {
    params.set(ASSETS_HIGHLIGHT_PARAM, match.endpoint_id);
  }
  const query = params.toString();
  return `/devices/${deviceId}/assets${query ? `?${query}` : ""}`;
}

/** The endpoint to flash, from a location search string such as "?highlight=abc". */
export function readAssetsHighlight(search: string): string | null {
  return new URLSearchParams(search).get(ASSETS_HIGHLIGHT_PARAM) || null;
}

/** Splits `text` into parts, marking those equal (case-insensitively) to one of `terms`. */
export function splitByTerms(text: string, terms: string[]): { text: string; match: boolean }[] {
  const haystack = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const term of terms) {
    const needle = term.trim().toLowerCase();
    if (needle === "") continue;
    for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
      ranges.push([at, at + needle.length]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }

  const parts: { text: string; match: boolean }[] = [];
  let from = 0;
  for (const [start, end] of merged) {
    if (start > from) parts.push({ text: text.slice(from, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    from = end;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}
