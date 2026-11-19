import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { edgeConfigApiInstance } from "@/api/edgeConfig/edgeConfigApi";
import { queryClient } from "@/config/queryConfig";

export type VariableType = "string" | "text" | "number" | "integer" | "boolean" | "enum";
export type Scalar = string | number | boolean;

export interface VariableDecl {
  name: string;
  type: VariableType;
  required?: boolean;
  options?: Scalar[] | null;
  label?: string | null;
  description?: string | null;
}

export interface Finding {
  path: string;
  level: "error" | "warning" | "hint";
  code: string;
  message: string;
}

export interface ScopeRef {
  id: string;
  name: string;
}

export interface TemplateGroup {
  id: number;
  name: string;
  description?: string | null;
  module_names: string[];
  scopes: ScopeRef[];
  template_count: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateGroupPayload {
  name: string;
  description?: string;
  module_names: string[];
  scope_ids: string[];
}

/** template: a module configuration; block: a reusable part referenced from templates and blocks. */
export type TemplateKind = "template" | "block";

export interface Template {
  id: number;
  kind: TemplateKind;
  name: string;
  description?: string | null;
  group_id: number;
  group_name: string;
  module_names: string[];
  scopes: ScopeRef[];
  derived_from_template_id?: number | null;
  derived_from_version?: number | null;
  archived: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  latest_version?: number | null;
}

export interface TemplateVersionSummary {
  template_id: number;
  /** the number people see (`#<n>`) */
  version: number;
  comment?: string | null;
  created_by?: string | null;
  created_at: string;
}

/** Placeholders a body uses. `endpoints` are the endpoint slots (one endpoint is chosen per slot). */
export interface References {
  variables: string[];
  device: string[];
  endpoints?: string[];
  endpoint_fields?: string[];
}

/** An endpoint of a device that can fill a template's endpoint slot. */
export interface DeviceEndpoint {
  endpoint_id: string;
  type_id: string;
  type_label: string;
  name?: string | null;
  ip?: string | null;
  fields: Record<string, unknown>;
}

/** Endpoint slot -> chosen endpoint_id. */
export type EndpointChoices = Record<string, string>;

/** A service of a device endpoint that can fill a slot's `${service[slot].*}` placeholders. */
export interface DeviceService {
  service_id: string;
  type_id: string;
  type_label: string;
  name?: string | null;
  port?: unknown;
  fields: Record<string, unknown>;
}

/** Endpoint slot -> chosen service_id (keyed like `EndpointChoices`). */
export type ServiceChoices = Record<string, string>;

/** One use of a block in a body. `key` names the copy (nested copies join with `/`), `label` is how people see it
 * (`separatorA · items`), `path` the JSON pointer of its `$ref` object. */
export interface Copy {
  key: string;
  label: string;
  block_id: number;
  name?: string | null;
  /** key of the copy it sits in; null at the top */
  parent?: string | null;
  path: string;
}

/** A variable declaration as an input: `key` is `<copy>/<name>` inside copies, the name at the top. */
export interface InputVariable extends VariableDecl {
  key: string;
  copy?: string | null;
}

export interface InputEndpoint {
  key: string;
  copy?: string | null;
  slot: string;
  fields: string[];
  /** fields read from the slot's chosen service (`${service[slot].field}`); empty if no service is used */
  service_fields?: string[];
}

/** Everything a rendering needs, the body's own and every block copy's. */
export interface Inputs {
  variables: InputVariable[];
  endpoints: InputEndpoint[];
  device: string[];
  copies: Copy[];
  /** `{ "$list": [...] }` entries: the blocks the device user may add as entries, each with its own inputs (keys relative to the entry) */
  lists?: InputList[];
}

export interface InputList {
  key: string;
  label: string;
  /** the `$label` of the list: what one entry is called ("Slave"), if the template names it */
  item_label?: string | null;
  path: string;
  blocks: { block_id: number; name?: string | null; inputs: Inputs }[];
}

/** List key -> its entries, as sent on render/apply and stored under `values.$lists`. */
export type ListsPayload = Record<string, { name: string; block_id: number }[]>;

export interface TemplateVersion extends TemplateVersionSummary {
  body: Record<string, unknown> | unknown[];
  variables: VariableDecl[];
  references: References;
  inputs?: Inputs;
}

export interface TemplateContent {
  body: unknown;
  variables: VariableDecl[];
  comment?: string;
}

export interface LintResult {
  ok: boolean;
  findings: Finding[];
  references: References;
  inputs?: Inputs;
}

export interface RenderResult {
  ok: boolean;
  template_id?: number;
  version?: number;
  config?: Record<string, unknown> | null;
  findings: Finding[];
}

export interface ExampleDevice {
  device_id: string;
  device_data: Record<string, unknown>;
}

export interface Revision {
  id: number;
  device_id: string;
  module_name: string;
  config_id: string;
  blob_name: string;
  parent_revision_id?: number | null;
  source: string;
  template_id?: number | null;
  template_name?: string | null;
  values?: Record<string, unknown> | null;
  content_hash?: string | null;
  actor?: string | null;
  comment?: string | null;
  reapplied_from_id?: number | null;
  created_at: string;
  current?: boolean;
}

export interface RevisionDetail extends Revision {
  content?: unknown;
  content_available: boolean;
}

export interface ApplyResult {
  configId: string;
  revision?: Revision | null;
  findings: Finding[];
}

export type Values = Record<string, unknown>;

const enc = encodeURIComponent;
const BASE = "/module-config-templates";
const GROUPS = "/module-config-template-groups";

/** Findings of a 422 response (template or rendered config has errors), if any. */
export function findingsOf(error: unknown): Finding[] | undefined {
  if (isAxiosError(error) && error.response?.status === 422) {
    const findings = (error.response.data as { findings?: Finding[] } | undefined)?.findings;
    return Array.isArray(findings) ? findings : undefined;
  }
}

export const moduleConfigApi = {
  listTemplates: async (params: { module?: string; includeArchived?: boolean; kind?: TemplateKind; groupId?: number } = {}) =>
    (await edgeConfigApiInstance.get<Template[]>(BASE, {
      params: {
        module: params.module, include_archived: params.includeArchived || undefined, kind: params.kind, group_id: params.groupId,
      },
    })).data,
  listVersions: async (id: number) =>
    (await edgeConfigApiInstance.get<TemplateVersionSummary[]>(`${BASE}/${id}/versions`)).data,
  getVersion: async (id: number, version: number | "latest") =>
    (await edgeConfigApiInstance.get<TemplateVersion>(`${BASE}/${id}/versions/${version}`)).data,
  listGroups: async (module?: string) =>
    (await edgeConfigApiInstance.get<TemplateGroup[]>(GROUPS, { params: { module } })).data,
  createGroup: async (payload: TemplateGroupPayload) =>
    (await edgeConfigApiInstance.post<TemplateGroup>(GROUPS, payload)).data,
  updateGroup: async (id: number, payload: Partial<TemplateGroupPayload>) =>
    (await edgeConfigApiInstance.patch<TemplateGroup>(`${GROUPS}/${id}`, payload)).data,
  deleteGroup: async (id: number) => {
    await edgeConfigApiInstance.delete(`${GROUPS}/${id}`);
  },
  listModuleTemplates: async (deviceId: string, module: string) =>
    (await edgeConfigApiInstance.get<Template[]>(`/${enc(deviceId)}/modules/${enc(module)}/config/templates`)).data,
  createTemplate: async (payload: TemplateContent & { name: string; description?: string; group_id: number; kind?: TemplateKind }) =>
    (await edgeConfigApiInstance.post<Template>(BASE, payload)).data,
  updateTemplate: async (id: number, payload: { name?: string; description?: string; group_id?: number; archived?: boolean }) =>
    (await edgeConfigApiInstance.patch<Template>(`${BASE}/${id}`, payload)).data,
  addVersion: async (id: number, payload: TemplateContent) =>
    (await edgeConfigApiInstance.post<TemplateVersion>(`${BASE}/${id}/versions`, payload)).data,
  duplicate: async (id: number, payload: { name: string; version?: number; group_id?: number }) =>
    (await edgeConfigApiInstance.post<Template>(`${BASE}/${id}/duplicate`, payload)).data,
  preview: async (payload: {
    body: unknown; variables: VariableDecl[]; values: Values; device?: Values; device_id?: string; group_id?: number; kind?: TemplateKind;
    endpoints?: EndpointChoices; services?: ServiceChoices; lists?: ListsPayload;
  }) => (await edgeConfigApiInstance.post<RenderResult>(`${BASE}/preview`, payload)).data,
  lint: async (payload: { body: unknown; variables: VariableDecl[]; kind: TemplateKind; group_id?: number }) =>
    (await edgeConfigApiInstance.post<LintResult>(`${BASE}/lint`, payload)).data,
  listExampleDevices: async (groupId: number, q?: string) =>
    (await edgeConfigApiInstance.get<ExampleDevice[]>(`${GROUPS}/${groupId}/example-devices`, {
      params: { q: q || undefined },
    })).data,

  listDeviceEndpoints: async (deviceId: string) =>
    (await edgeConfigApiInstance.get<DeviceEndpoint[]>(`/${enc(deviceId)}/config/endpoints`)).data,
  listEndpointServices: async (deviceId: string, endpointId: string) =>
    (await edgeConfigApiInstance.get<DeviceService[]>(`/${enc(deviceId)}/config/endpoints/${enc(endpointId)}/services`)).data,
  render: async (deviceId: string, module: string, payload: {
    template_id: number; values: Values; endpoints?: EndpointChoices; services?: ServiceChoices; lists?: ListsPayload;
  }) =>
    (await edgeConfigApiInstance.post<RenderResult>(`/${enc(deviceId)}/modules/${enc(module)}/config/render`, payload)).data,
  apply: async (deviceId: string, module: string, payload: {
    template_id: number; values: Values; endpoints?: EndpointChoices; services?: ServiceChoices; lists?: ListsPayload; comment?: string;
  }) =>
    (await edgeConfigApiInstance.post<ApplyResult>(`/${enc(deviceId)}/modules/${enc(module)}/config/apply`, payload)).data,
  getReported: async (deviceId: string, module: string) =>
    (await edgeConfigApiInstance.get<Record<string, unknown> | null>(`/${enc(deviceId)}/twin/reported/${enc(module)}`)).data,
  listRevisions: async (deviceId: string, module: string) =>
    (await edgeConfigApiInstance.get<{ current_config_id?: string | null; revisions: Revision[] }>(
      `/${enc(deviceId)}/modules/${enc(module)}/config/revisions`)).data,
  getRevision: async (deviceId: string, module: string, id: number) =>
    (await edgeConfigApiInstance.get<RevisionDetail>(`/${enc(deviceId)}/modules/${enc(module)}/config/revisions/${id}`)).data,
  reapply: async (deviceId: string, module: string, id: number, comment?: string) =>
    (await edgeConfigApiInstance.post<ApplyResult>(
      `/${enc(deviceId)}/modules/${enc(module)}/config/revisions/${id}/reapply`, { comment })).data,
};

const TEMPLATES = "moduleConfigTemplates";
const REVISIONS = "moduleConfigRevisions";

export const useTemplates = (module?: string, includeArchived?: boolean) =>
  useQuery({
    queryKey: [TEMPLATES, "list", module ?? "*", !!includeArchived],
    queryFn: () => moduleConfigApi.listTemplates({ module, includeArchived }),
  });

/** The (unarchived) blocks of a template group: what a template or block of the group can reference. */
export const useBlocks = (groupId: number | null | undefined) =>
  useQuery({
    queryKey: [TEMPLATES, "blocks", groupId],
    queryFn: () => moduleConfigApi.listTemplates({ kind: "block", groupId: groupId! }),
    enabled: groupId != null,
  });

export const useTemplateGroups = (module?: string) =>
  useQuery({
    queryKey: [TEMPLATES, "groups", module ?? "*"],
    queryFn: () => moduleConfigApi.listGroups(module),
  });

/** Devices to preview a template group's templates with: readable by the user and within the template group's scopes. */
export const useExampleDevices = (groupId: number | null, search: string, enabled = true) =>
  useQuery({
    queryKey: [TEMPLATES, "example-devices", groupId, search],
    queryFn: () => moduleConfigApi.listExampleDevices(groupId!, search),
    enabled: enabled && groupId !== null,
    placeholderData: (previous) => previous,
  });

/** Templates that can be applied to this module on this device (template group lists the module and its scopes match). */
export const useModuleTemplates = (deviceId: string, module: string) =>
  useQuery({
    queryKey: [TEMPLATES, "device", deviceId, module],
    queryFn: () => moduleConfigApi.listModuleTemplates(deviceId, module),
  });

export const useDeviceEndpoints = (deviceId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["moduleConfigEndpoints", deviceId],
    queryFn: () => moduleConfigApi.listDeviceEndpoints(deviceId),
    enabled,
  });

/** The services of one of the device's endpoints (none fetched until an endpoint is chosen). */
export const useEndpointServices = (deviceId: string, endpointId?: string) =>
  useQuery({
    queryKey: ["moduleConfigEndpoints", deviceId, endpointId, "services"],
    queryFn: () => moduleConfigApi.listEndpointServices(deviceId, endpointId!),
    enabled: !!endpointId,
  });

export const useTemplateVersions = (id: number | undefined) =>
  useQuery({
    queryKey: [TEMPLATES, id, "versions"],
    queryFn: () => moduleConfigApi.listVersions(id!),
    enabled: id != null,
  });

export const useTemplateVersion = (id: number | undefined, version: number | "latest") =>
  useQuery({
    queryKey: [TEMPLATES, id, "version", version],
    queryFn: () => moduleConfigApi.getVersion(id!, version),
    enabled: id != null,
    staleTime: version === "latest" ? 0 : Infinity,
  });

export const useReported = (deviceId: string, module: string) =>
  useQuery({
    queryKey: ["moduleReportedTwin", deviceId, module],
    queryFn: () => moduleConfigApi.getReported(deviceId, module),
    refetchInterval: 10_000,
  });

export const useRevisions = (deviceId: string, module: string) =>
  useQuery({
    queryKey: [REVISIONS, deviceId, module],
    queryFn: () => moduleConfigApi.listRevisions(deviceId, module),
  });

export const useRevision = (deviceId: string, module: string, id: number | undefined) =>
  useQuery({
    queryKey: [REVISIONS, deviceId, module, id],
    queryFn: () => moduleConfigApi.getRevision(deviceId, module, id!),
    enabled: id != null,
    staleTime: Infinity,
  });

export const invalidateTemplates = () => queryClient.invalidateQueries({ queryKey: [TEMPLATES] });

export const invalidateDeviceModuleConfig = (deviceId: string, module: string) => {
  void queryClient.invalidateQueries({ queryKey: [REVISIONS, deviceId, module] });
  void queryClient.invalidateQueries({ queryKey: ["getTwinConfig", deviceId, module] });
  void queryClient.invalidateQueries({ queryKey: ["getConfigStatus", deviceId] });
};

export const useApplyTemplate = (deviceId: string, module: string) =>
  useMutation({
    mutationFn: (payload: {
      template_id: number; values: Values; endpoints?: EndpointChoices; services?: ServiceChoices; lists?: ListsPayload; comment?: string;
    }) =>
      moduleConfigApi.apply(deviceId, module, payload),
    onSuccess: () => invalidateDeviceModuleConfig(deviceId, module),
  });

export const useReapplyRevision = (deviceId: string, module: string) =>
  useMutation({
    mutationFn: ({ id, comment }: { id: number; comment?: string }) => moduleConfigApi.reapply(deviceId, module, id, comment),
    onSuccess: () => invalidateDeviceModuleConfig(deviceId, module),
  });
