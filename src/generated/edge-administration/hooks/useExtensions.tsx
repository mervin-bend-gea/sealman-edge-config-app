import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth";
import { isForbidden } from "@/lib/errors";
import { client, edgeApi } from "../api";

export function useListExtensions() {
    const { user, isAuthenticated } = useAuth();
    return useQuery({
        queryKey: ["get", "/extensions", user?.iss, user?.sub],
        queryFn: async ({ signal }) => {
            const { data } = await client.GET("/extensions", { signal });
            return data;
        },
        enabled: query => isAuthenticated && !isForbidden(query.state.error),
        gcTime: 0,
    });
}

export function useGetExtension(name: string) {
    const { user, isAuthenticated } = useAuth();
    return useQuery({
        queryKey: ["get", "/extensions/{name}", { params: { path: { name } } }, user?.iss, user?.sub],
        queryFn: async ({ signal }) => {
            const { data } = await client.GET("/extensions/{name}", { params: { path: { name } }, signal });
            return data;
        },
        enabled: query => isAuthenticated && Boolean(name) && !isForbidden(query.state.error),
        gcTime: 0,
    });
}

export function useGetExtensionSchema() {
    return edgeApi.useQuery("get", "/extensions/schema")
}

export function useRegisterExtension() {
    return edgeApi.useMutation("post", "/extensions", { gcTime: 0 })
}

export function useReplaceExtension() {
    return edgeApi.useMutation("put", "/extensions/{name}")
}

export function useDeleteExtension() {
    return edgeApi.useMutation("delete", "/extensions/{name}")
}

export function useEnableExtension() {
    return edgeApi.useMutation("post", "/extensions/{name}/enable")
}

export function useDisableExtension() {
    return edgeApi.useMutation("post", "/extensions/{name}/disable")
}

export function useCheckExtensionHealth() {
    // A health check has no bearing on the rest of the app's data - opt out of the
    // blanket invalidateQueries() in queryConfig.ts so it doesn't force-refetch every
    // other query (including the extensions list itself) on every successful check.
    return edgeApi.useMutation("post", "/extensions/{name}/health-check", {
        meta: { skipGlobalInvalidate: true },
    })
}

export function useRotateExtensionInternalKey() {
    return edgeApi.useMutation("post", "/extensions/{name}/internal-key/rotate", { gcTime: 0 })
}

export function useListExtensionDeviceKeys(name: string, enabled: boolean) {
    const { user, isAuthenticated } = useAuth();
    return useQuery({
        queryKey: ["get", "/extensions/{name}/device-keys", name, user?.iss, user?.sub],
        queryFn: async ({ signal }) => {
            const { data } = await client.GET("/extensions/{name}/device-keys", { params: { path: { name } }, signal });
            return data;
        },
        enabled: query => isAuthenticated && enabled && Boolean(name) && !isForbidden(query.state.error),
        gcTime: 0,
    });
}

export function useIssueExtensionDeviceKey() {
    return edgeApi.useMutation("post", "/extensions/{name}/device-keys", { gcTime: 0 });
}

export function useRevokeExtensionDeviceKey() {
    return edgeApi.useMutation("delete", "/extensions/{name}/device-keys/by-id/{key_id}");
}
