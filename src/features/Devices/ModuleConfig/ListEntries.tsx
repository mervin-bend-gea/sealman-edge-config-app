import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineAlert } from "@/components/ui/page-state";
import SearchableSelect from "@/components/Input/SearchableSelect";
import type { DeviceEndpoint, EndpointChoices, Finding, InputList, ServiceChoices, Values } from "@/features/ModuleConfigTemplates/api";
import { InputsSection, needsService } from "./ConfigInputs";

/** One entry of a list as edited in the form. Values, endpoint and service choices are keyed relative to the entry;
 * the `<list key>/<name>/` prefix is added only when sending (so renaming keeps them). */
export interface ListCard {
  id: string;
  name: string;
  blockId?: number;
  values: Values;
  endpoints: EndpointChoices;
  services: ServiceChoices;
}

/** List key -> its cards. */
export type ListCards = Record<string, ListCard[]>;

/** A stored list entry, as in `values.$lists` and the `lists` request field. */
export interface ListEntryRef {
  name: string;
  block_id: number;
}

const NAME = /^[A-Za-z0-9_.-]{1,64}$/;

const newId = () => crypto.randomUUID();

/** What one entry is called: the list's `item_label` ("Slave" -> "slave"), else "Clients" -> "client";
 * labels that don't look plural give "entry". */
function singularOf(list: Pick<InputList, "label" | "item_label">) {
  if (list.item_label) return list.item_label.toLowerCase();
  return /[^s]s$/i.test(list.label) ? list.label.slice(0, -1).toLowerCase() : "entry";
}

function prefixed<T>(prefix: string, map: Record<string, T>) {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [prefix + k, v]));
}

function unprefixed<T>(prefix: string, map: Record<string, T>) {
  return Object.fromEntries(Object.entries(map).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]));
}

/** What the request needs for one list: its entries, and their values, endpoint and service choices under prefixed keys. */
export function entriesToPayload(list: InputList, cards: ListCard[]) {
  const values: Values = {};
  const endpoints: EndpointChoices = {};
  const services: ServiceChoices = {};
  const entries: ListEntryRef[] = [];
  for (const card of cards) {
    if (card.blockId === undefined) continue;
    entries.push({ name: card.name, block_id: card.blockId });
    // Only what the chosen type asks for: values kept from a previously chosen type are not sent.
    const block = list.blocks.find((b) => b.block_id === card.blockId);
    const varKeys = block && new Set(block.inputs.variables.map((v) => v.key));
    const slotKeys = block && new Set(block.inputs.endpoints.map((e) => e.key));
    const prefix = `${list.key}/${card.name}/`;
    for (const [k, v] of Object.entries(card.values)) if (!varKeys || varKeys.has(k)) values[prefix + k] = v;
    for (const [k, v] of Object.entries(card.endpoints)) if (!slotKeys || slotKeys.has(k)) endpoints[prefix + k] = v;
    for (const [k, v] of Object.entries(card.services)) if (!slotKeys || slotKeys.has(k)) services[prefix + k] = v;
  }
  return { lists: { [list.key]: entries }, values, endpoints, services };
}

/** The cards of one list, from a revision's stored values (`$lists`, prefixed values, `$endpoints` and `$services`). */
export function cardsFromRevision(list: Pick<InputList, "key">, stored: Values): ListCard[] {
  const lists = (stored.$lists ?? {}) as Record<string, ListEntryRef[]>;
  const storedEndpoints = (stored.$endpoints ?? {}) as EndpointChoices;
  const storedServices = (stored.$services ?? {}) as ServiceChoices;
  return (lists[list.key] ?? []).map((entry) => {
    const prefix = `${list.key}/${entry.name}/`;
    return { id: newId(), name: entry.name, blockId: entry.block_id, values: unprefixed(prefix, stored),
             endpoints: unprefixed(prefix, storedEndpoints), services: unprefixed(prefix, storedServices) };
  });
}

/** Splits a revision's stored values: the top-level values, endpoint and service choices, and the cards of every list. */
export function splitRevisionValues(stored: Values) {
  const { $endpoints, $services, $lists, ...rest } = stored as Values & {
    $endpoints?: EndpointChoices; $services?: ServiceChoices; $lists?: Record<string, ListEntryRef[]>;
  };
  const cards: ListCards = Object.fromEntries(Object.keys($lists ?? {}).map((key) => [key, cardsFromRevision({ key }, stored)]));
  const prefixes = Object.entries($lists ?? {}).flatMap(([key, entries]) => entries.map((e) => `${key}/${e.name}/`));
  const top = <T,>(map: Record<string, T>) =>
    Object.fromEntries(Object.entries(map).filter(([k]) => !k.startsWith("$") && !prefixes.some((p) => k.startsWith(p))));
  return { values: top(rest), endpoints: top($endpoints ?? {}), services: top($services ?? {}), cards };
}

function nameError(card: ListCard, cards: ListCard[]) {
  if (!NAME.test(card.name)) return "Use 1 to 64 letters, digits, '_', '.' or '-'";
  if (cards.some((c) => c !== card && c.name === card.name)) return "Name already used";
}

/** Whether the cards can be applied: valid unique names, a type the list still offers, and a service for each slot that reads one. */
export function cardsValid(list: InputList, cards: ListCard[]) {
  return cards.every((c) => {
    const block = list.blocks.find((b) => b.block_id === c.blockId);
    return !nameError(c, cards) && block && block.inputs.endpoints.every((e) => !needsService(e) || c.services[e.key]);
  });
}

/** One list of the template: a card per entry (name, type, the type's endpoints and inputs), added and removed freely. */
export function ListEntries({ deviceId, list, cards, onChange, activeBlockIds, findings, blocked, deviceEndpoints, endpointsLoading, endpointsError }: {
  deviceId: string;
  list: InputList;
  cards: ListCard[];
  /** gets an updater, so several changes in one tick all apply */
  onChange: (update: (cards: ListCard[]) => ListCard[]) => void;
  /** ids of the group's non-archived blocks (undefined while loading: all are offered) */
  activeBlockIds?: Set<number>;
  findings: Finding[];
  blocked: boolean;
  deviceEndpoints?: DeviceEndpoint[];
  endpointsLoading: boolean;
  endpointsError?: string;
}) {
  const singular = singularOf(list);
  const baseName = singular.replace(/[^A-Za-z0-9_.-]+/g, "-");
  const title = list.item_label ? `${list.item_label}s` : list.label;
  const update = (card: ListCard, change: Partial<ListCard>) =>
    onChange((all) => all.map((c) => (c.id === card.id ? { ...c, ...change } : c)));
  const add = () => {
    onChange((all) => {
      const taken = new Set(all.map((c) => c.name));
      let n = all.length + 1;
      while (taken.has(`${baseName}${n}`)) n++;
      return [...all, { id: newId(), name: `${baseName}${n}`, values: {}, endpoints: {}, services: {} }];
    });
  };
  // Server findings on entries point at their index among the sent ones (those with a type).
  const sent = cards.filter((c) => c.blockId !== undefined);

  return (
    <section aria-label={title} className="space-y-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {cards.map((card, i) => {
        const block = list.blocks.find((b) => b.block_id === card.blockId);
        const options = list.blocks
          .filter((b) => !activeBlockIds || activeBlockIds.has(b.block_id) || b.block_id === card.blockId)
          .map((b) => ({ value: String(b.block_id), label: b.name ?? `#${b.block_id}` }));
        const prefix = `${list.key}/${card.name}/`;
        const index = sent.indexOf(card);
        const serverErrors = findings.filter((f) => index >= 0 && f.path.startsWith(`/lists/${list.key}/${index}/`) && f.level === "error");
        const error = nameError(card, cards);
        return (
          <fieldset key={card.id} aria-label={`${singular} ${i + 1}`} className="space-y-3 rounded-md border p-3">
            <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor={`cfg-list-${card.id}-name`}>Name</Label>
                <Input id={`cfg-list-${card.id}-name`} value={card.name} disabled={blocked} aria-invalid={!!error}
                       onChange={(e) => update(card, { name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`cfg-list-${card.id}-type`}>Type</Label>
                <SearchableSelect
                  id={`cfg-list-${card.id}-type`}
                  disabled={blocked}
                  value={block ? String(block.block_id) : null}
                  options={options}
                  placeholder="Select a type"
                  searchPlaceholder="Search types"
                  emptyText="No type found."
                  onChange={(v) => update(card, { blockId: Number(v) })}
                />
              </div>
              <Button variant="outline" size="sm" disabled={blocked} onClick={() => onChange((all) => all.filter((c) => c.id !== card.id))}>Remove</Button>
            </div>
            {error && <p className="text-xs text-red-700">{error}</p>}
            {card.blockId === undefined && <p className="text-xs text-red-700">Choose a type</p>}
            {card.blockId !== undefined && !block && (
              <InlineAlert variant="warning">This {singular} type is no longer offered: choose another or remove it</InlineAlert>
            )}
            {serverErrors.map((f) => <p key={f.path + f.code} className="text-xs text-red-700">{f.message}</p>)}
            {block && (
              <InputsSection
                deviceId={deviceId}
                variables={block.inputs.variables.map((v) => ({ ...v, key: prefix + v.key }))}
                slots={block.inputs.endpoints.map((e) => ({ ...e, key: prefix + e.key }))}
                emptyText=""
                values={prefixed(prefix, card.values)}
                setValues={(next) => update(card, { values: unprefixed(prefix, next) })}
                endpoints={prefixed(prefix, card.endpoints)}
                setEndpoints={(next, services) => update(card, { endpoints: unprefixed(prefix, next), services: unprefixed(prefix, services) })}
                services={prefixed(prefix, card.services)}
                setServices={(next) => update(card, { services: unprefixed(prefix, next) })}
                findings={findings}
                blocked={blocked}
                deviceEndpoints={deviceEndpoints}
                endpointsLoading={endpointsLoading}
                endpointsError={endpointsError}
              />
            )}
          </fieldset>
        );
      })}
      {!blocked && (
        <Button variant="outline" size="sm" onClick={add}>+ Add {singular}</Button>
      )}
    </section>
  );
}
