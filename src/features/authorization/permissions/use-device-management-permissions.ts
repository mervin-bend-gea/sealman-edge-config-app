import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth";
import { edgeConfigApi } from "@/api/edgeConfig/edgeConfigApi";

export function useDeviceManagementPermissions(enabled: boolean) {
  const auth = useAuth();
  const { data, isError } = useQuery({
    queryKey: ["permissions", "device-management", auth.user?.iss, auth.user?.sub],
    queryFn: ({ signal }) => edgeConfigApi.getDeviceManagementPermissions(signal),
    enabled: auth.isAuthenticated && enabled,
    gcTime: 0,
  });

  return isError || !auth.isAuthenticated || !enabled ? undefined : data;
}