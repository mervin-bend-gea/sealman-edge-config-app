import { useMutation, useQuery } from "@tanstack/react-query";
import { edgeConfigApiInstance } from "@/api/edgeConfig/edgeConfigApi";
import { queryClient } from "@/config/queryConfig";

export interface PlatformFunctions {
  network_scan_enabled: boolean;
}

export const PLATFORM_FUNCTIONS_QUERY_KEY = ["platformFunctions"] as const;

export function usePlatformFunctions() {
  return useQuery({
    queryKey: PLATFORM_FUNCTIONS_QUERY_KEY,
    queryFn: async () => (await edgeConfigApiInstance.get<PlatformFunctions>("/platform/functions")).data,
  });
}

/**
 * `undefined` while unknown (loading). If the setting can't be read, the scan is treated as
 * disabled - the UI then simply works without scanning instead of probing a possibly blocked API.
 */
export function useNetworkScanEnabled(): boolean | undefined {
  const { data, isError } = usePlatformFunctions();
  if (isError) return false;
  return data?.network_scan_enabled;
}

export function useUpdatePlatformFunctions() {
  return useMutation({
    mutationFn: async (functions: PlatformFunctions) =>
      (await edgeConfigApiInstance.put<PlatformFunctions>("/platform/functions", functions)).data,
    onSuccess: (functions) => queryClient.setQueryData(PLATFORM_FUNCTIONS_QUERY_KEY, functions),
  });
}
