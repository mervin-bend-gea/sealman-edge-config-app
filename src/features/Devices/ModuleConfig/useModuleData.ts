import { useQuery, useQueryClient } from "@tanstack/react-query";
import { edgeConfigApi } from "@/api/edgeConfig/edgeConfigApi";
import type { ModuleData } from "@/api/edgeConfig/edgeConfigApiHooks";
import { isForbidden, isTerminalConfigStatusError } from "@/lib/errors";

export function modulePath(deviceId: string, moduleId: string): string {
  return `/devices/${encodeURIComponent(deviceId)}/applications/${encodeURIComponent(moduleId)}`;
}

/**
 * The device's modules merged with their config status. Shared by the module list and the
 * module page, so both show the same polling state and stop polling on the same denials.
 */
export function useModuleData(deviceId: string | undefined, identity: string) {
  const queryClient = useQueryClient();
  const modulesQuery = useQuery<ModuleData[]>({
    queryKey: ["getModules", deviceId, identity],
    queryFn: ({ signal }) => edgeConfigApi.getModules(deviceId, signal),
    enabled: (query) => Boolean(deviceId) && !isForbidden(query.state.error),
    refetchInterval: (query) => (isForbidden(query.state.error) ? false : 8000),
    gcTime: 0,
  });
  const modules = modulesQuery.data;
  const moduleNames = modules?.map((module) => module.moduleId);

  const statusQuery = useQuery({
    queryKey: ["getConfigStatus", deviceId, identity, moduleNames],
    queryFn: async ({ signal }) => {
      const configStatus = await edgeConfigApi.getConfigStatus(deviceId, { modules: moduleNames }, signal);
      return (modules ?? []).map((module) => ({
        ...module,
        appMessage: configStatus[module.moduleId]?.appMessage || undefined,
        appStatus: configStatus[module.moduleId]?.appStatus || undefined,
        confStatus: configStatus[module.moduleId]?.confStatus || undefined,
        desiredConfId: configStatus[module.moduleId]?.desiredConfId || undefined,
        reportedConfId: configStatus[module.moduleId]?.reportedConfId || undefined,
      }));
    },
    enabled: (query) =>
      Boolean(deviceId && modules) && !modulesQuery.error && !isTerminalConfigStatusError(query.state.error),
    refetchInterval: (query) => (isTerminalConfigStatusError(query.state.error) ? false : 5000),
    gcTime: 0,
  });

  const refresh = () => {
    void modulesQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ["getConfigStatus", deviceId] });
  };

  return { modulesQuery, statusQuery, refresh };
}
