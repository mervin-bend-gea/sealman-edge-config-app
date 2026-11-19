import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import SearchableSelect from "@/components/Input/SearchableSelect";
import { getErrorMessage } from "@/lib/errors";
import {
  useEndpointServices, type DeviceEndpoint, type EndpointChoices, type Finding, type InputEndpoint, type InputVariable, type ServiceChoices, type Values,
} from "@/features/ModuleConfigTemplates/api";
import { VariableForm } from "@/features/ModuleConfigTemplates/components";

/** Whether a slot reads fields of a chosen service (and so needs one). */
export const needsService = (slot: InputEndpoint) => (slot.service_fields?.length ?? 0) > 0;

/** Endpoint dropdowns, then the variable inputs, of the top level or of one copy group. */
export function InputsSection({ deviceId, variables, slots, emptyText, values, setValues, endpoints, setEndpoints, services, setServices, findings, blocked, deviceEndpoints, endpointsLoading, endpointsError }: {
  deviceId: string;
  variables: InputVariable[];
  slots: InputEndpoint[];
  /** shown when there is nothing to fill in */
  emptyText?: string;
  values: Values;
  setValues: (v: Values) => void;
  endpoints: EndpointChoices;
  services: ServiceChoices;
  /** gets the endpoint and service choices together: changing an endpoint clears its service */
  setEndpoints: (endpoints: EndpointChoices, services: ServiceChoices) => void;
  setServices: (v: ServiceChoices) => void;
  findings: Finding[];
  blocked: boolean;
  deviceEndpoints?: DeviceEndpoint[];
  endpointsLoading: boolean;
  endpointsError?: string;
}) {
  return (
    <>
      {slots.length > 0 && (
        <EndpointSlots deviceId={deviceId} slots={slots} endpoints={deviceEndpoints} loading={endpointsLoading}
                       error={endpointsError} value={endpoints} onChange={setEndpoints} services={services} onServicesChange={setServices}
                       disabled={blocked} />
      )}
      <VariableForm variables={variables} values={values} onChange={setValues} findings={findings} disabled={blocked}
                    keyOf={(d) => (d as InputVariable).key ?? d.name} emptyText={slots.length > 0 ? "" : (emptyText ?? "This template has no variables.")} />
    </>
  );
}

/** One dropdown per endpoint slot: the endpoint of this device that fills its `${endpoint[slot].*}` placeholders;
 * under it, for slots that read a service, one of that endpoint's services. */
export function EndpointSlots({ deviceId, slots, endpoints, loading, error, value, onChange, services, onServicesChange, disabled }: {
  deviceId: string;
  slots: InputEndpoint[];
  endpoints?: DeviceEndpoint[];
  loading: boolean;
  error?: string;
  value: EndpointChoices;
  onChange: (endpoints: EndpointChoices, services: ServiceChoices) => void;
  services: ServiceChoices;
  onServicesChange: (next: ServiceChoices) => void;
  disabled: boolean;
}) {
  if (loading) return <LoadingState label="Loading the device's endpoints..." className="p-2" />;
  if (error) return <InlineAlert>Could not load the device's endpoints: {error}</InlineAlert>;
  if (endpoints && endpoints.length === 0) {
    return <InlineAlert variant="warning">This template uses endpoints, but the device has none. Add them on the device's Assets tab.</InlineAlert>;
  }
  const options = (endpoints ?? []).map((e) => ({
    value: e.endpoint_id,
    label: e.ip ? `${e.name ?? e.type_label} (${e.ip})` : (e.name ?? e.type_label),
    hint: e.type_label,
  }));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {slots.map((s) => (
        <div key={s.key} className="space-y-1">
          <Label htmlFor={`cfg-endpoint-${s.key}`}>Endpoint: {s.slot}</Label>
          <SearchableSelect
            id={`cfg-endpoint-${s.key}`}
            disabled={disabled}
            value={value[s.key] ?? null}
            options={options}
            placeholder="Select an endpoint"
            searchPlaceholder="Search endpoints"
            emptyText="No endpoint found."
            onChange={(v) => {
              if (v === value[s.key]) return;
              // The chosen service belongs to the previous endpoint.
              onChange({ ...value, [s.key]: v }, Object.fromEntries(Object.entries(services).filter(([k]) => k !== s.key)));
            }}
          />
          {s.fields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Fills {s.fields.map((f) => <code key={f} className="mr-1 rounded bg-muted px-1">{f}</code>)}
            </p>
          )}
          {needsService(s) && (
            <ServiceSelect deviceId={deviceId} slot={s} endpointId={value[s.key]} value={services[s.key]}
                           onChange={(v) => onServicesChange({ ...services, [s.key]: v })} disabled={disabled} />
          )}
        </div>
      ))}
    </div>
  );
}

/** The service of the chosen endpoint that fills a slot's `${service[slot].*}` placeholders; never preselected. */
function ServiceSelect({ deviceId, slot, endpointId, value, onChange, disabled }: {
  deviceId: string;
  slot: InputEndpoint;
  endpointId?: string;
  value?: string;
  onChange: (serviceId: string) => void;
  disabled: boolean;
}) {
  const services = useEndpointServices(deviceId, endpointId);
  const options = (services.data ?? []).map((s) => {
    const name = s.name ?? s.type_label;
    return { value: s.service_id, label: s.port != null && s.port !== "" ? `${name} (${String(s.port)})` : name, hint: s.type_label };
  });
  // a stored service that no longer exists (deleted since the revision) is cleared
  const stale = !!value && !!services.data && !options.some((o) => o.value === value);
  useEffect(() => {
    if (stale) onChange("");
  }, [stale]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-1 pt-1">
      <Label htmlFor={`cfg-service-${slot.key}`}>Service: {slot.slot}</Label>
      <SearchableSelect
        id={`cfg-service-${slot.key}`}
        disabled={disabled || !endpointId}
        value={stale ? null : value ?? null}
        options={options}
        placeholder={endpointId ? "Select a service" : "Select an endpoint first"}
        searchPlaceholder="Search services"
        emptyText="No service found."
        onChange={onChange}
      />
      {services.isError && <p className="text-xs text-red-700">Could not load the endpoint's services: {getErrorMessage(services.error)}</p>}
      {services.data?.length === 0 && <p className="text-xs text-red-700">This endpoint has no services: add one on the device's Assets tab.</p>}
      {(!value || stale) && <p className="text-xs text-red-700">Choose a service</p>}
      <p className="text-xs text-muted-foreground">
        Fills {slot.service_fields!.map((f) => <code key={f} className="mr-1 rounded bg-muted px-1">{f}</code>)}
      </p>
    </div>
  );
}
