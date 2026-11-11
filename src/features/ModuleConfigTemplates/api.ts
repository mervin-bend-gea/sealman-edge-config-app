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
  default?: Scalar | null;
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

export interface Namespace {
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

export interface NamespacePayload {
  name: string;
  description?: string;
  module_names: string[];
  scope_ids: string[];
}

export interface Template {
  id: number;
  name: string;
  description?: string | null;
  namespace_id: number;
  namespace_name: string;
  module_names: string[];
  scopes: ScopeRef[];
  derived_from_template_id?: number | null;
  derived_from_version?: number | null;
  archived: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  latest_version?: number | null;
  latest_tag?: string | null;
}

export interface TemplateVersionSummary {
  template_id: number;
  /** internal order; people see `tag` */
  version: number;
  tag: string;
  comment?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface TemplateVersion extends TemplateVersionSummary {
  body: Record<string, unknown>;
  variables: VariableDecl[];
  references: { variables: string[]; device: string[] };
}

export interface TemplateContent {
  body: unknown;
  variables: VariableDecl[];
  comment?: string;
  tag?: string;
}

export interface LintResult {
  ok: boolean;
  findings: Finding[];
  references: { variables: string[]; device: string[] };
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
  template_version?: number | null;
  template_version_tag?: string | null;
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
const NAMESPACES = "/module-config-namespaces";

/** Findings of a 422 response (template or rendered config has errors), if any. */
export function findingsOf(error: unknown): Finding[] | undefined {
  if (isAxiosError(error) && error.response?.status === 422) {
    const findings = (error.response.data as { findings?: Finding[] } | undefined)?.findings;
    return Array.isArray(findings) ? findings : undefined;
  }
}

export const moduleConfigApi = {
  listTemplates: async (params: { module?: string; includeArchived?: boolean } = {}) =>
    (await edgeConfigApiInstance.get<Template[]>(BASE, {
      params: { module: params.module, include_archived: params.includeArchived || undefined },
    })).data,
  listVersions: async (id: number) =>
    (await edgeConfigApiInstance.get<TemplateVersionSummary[]>(`${BASE}/${id}/versions`)).data,
  getVersion: async (id: number, version: number | "latest") =>
    (await edgeConfigApiInstance.get<TemplateVersion>(`${BASE}/${id}/versions/${version}`)).data,
  listNamespaces: async (module?: string) =>
    (await edgeConfigApiInstance.get<Namespace[]>(NAMESPACES, { params: { module } })).data,
  createNamespace: async (payload: NamespacePayload) =>
    (await edgeConfigApiInstance.post<Namespace>(NAMESPACES, payload)).data,
  updateNamespace: async (id: number, payload: Partial<NamespacePayload>) =>
    (await edgeConfigApiInstance.patch<Namespace>(`${NAMESPACES}/${id}`, payload)).data,
  deleteNamespace: async (id: number) => {
    await edgeConfigApiInstance.delete(`${NAMESPACES}/${id}`);
  },
  listModuleTemplates: async (deviceId: string, module: string) =>
    (await edgeConfigApiInstance.get<Template[]>(`/${enc(deviceId)}/modules/${enc(module)}/config/templates`)).data,
  createTemplate: async (payload: TemplateContent & { name: string; description?: string; namespace_id: number }) =>
    (await edgeConfigApiInstance.post<Template>(BASE, payload)).data,
  updateTemplate: async (id: number, payload: { name?: string; description?: string; namespace_id?: number; archived?: boolean }) =>
    (await edgeConfigApiInstance.patch<Template>(`${BASE}/${id}`, payload)).data,
  addVersion: async (id: number, payload: TemplateContent) =>
    (await edgeConfigApiInstance.post<TemplateVersion>(`${BASE}/${id}/versions`, payload)).data,
  duplicate: async (id: number, payload: { name: string; version?: number; namespace_id?: number; tag?: string }) =>
    (await edgeConfigApiInstance.post<Template>(`${BASE}/${id}/duplicate`, payload)).data,
  preview: async (payload: {
    body: unknown; variables: VariableDecl[]; values: Values; device?: Values; device_id?: string; namespace_id?: number;
  }) => (await edgeConfigApiInstance.post<RenderResult>(`${BASE}/preview`, payload)).data,
  listExampleDevices: async (namespaceId: number, q?: string) =>
    (await edgeConfigApiInstance.get<ExampleDevice[]>(`${NAMESPACES}/${namespaceId}/example-devices`, {
      params: { q: q || undefined },
    })).data,

  render: async (deviceId: string, module: string, payload: { template_id: number; version?: number; values: Values }) =>
    (await edgeConfigApiInstance.post<RenderResult>(`/${enc(deviceId)}/modules/${enc(module)}/config/render`, payload)).data,
  apply: async (deviceId: string, module: string, payload: { template_id: number; version?: number; values: Values; comment?: string }) =>
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

export const useNamespaces = (module?: string) =>
  useQuery({
    queryKey: [TEMPLATES, "namespaces", module ?? "*"],
    queryFn: () => moduleConfigApi.listNamespaces(module),
  });

/** Devices to preview a namespace's templates with: readable by the user and within the namespace's scopes. */
export const useExampleDevices = (namespaceId: number | null, search: string, enabled = true) =>
  useQuery({
    queryKey: [TEMPLATES, "example-devices", namespaceId, search],
    queryFn: () => moduleConfigApi.listExampleDevices(namespaceId!, search),
    enabled: enabled && namespaceId !== null,
    placeholderData: (previous) => previous,
  });

/** Templates that can be applied to this module on this device (namespace lists the module and its scopes match). */
export const useModuleTemplates = (deviceId: string, module: string) =>
  useQuery({
    queryKey: [TEMPLATES, "device", deviceId, module],
    queryFn: () => moduleConfigApi.listModuleTemplates(deviceId, module),
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
    mutationFn: (payload: { template_id: number; version?: number; values: Values; comment?: string }) =>
      moduleConfigApi.apply(deviceId, module, payload),
    onSuccess: () => invalidateDeviceModuleConfig(deviceId, module),
  });

export const useReapplyRevision = (deviceId: string, module: string) =>
  useMutation({
    mutationFn: ({ id, comment }: { id: number; comment?: string }) => moduleConfigApi.reapply(deviceId, module, id, comment),
    onSuccess: () => invalidateDeviceModuleConfig(deviceId, module),
  });
