import { Outlet } from "react-router-dom";
import { useAuth } from "@/auth";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { getErrorMessage, isForbidden } from "@/lib/errors";

export default function AssetConfigurationAccess() {
  const auth = useAuth();
  const permissionKey = PERMISSION_KEYS.PLATFORM_ASSET_CONFIG_READ;
  const { hasPermission, isLoading, isError, error } = usePermissions({ permissionKey });

  if (!auth.isAuthenticated || isLoading) return <LoadingState label="Checking asset configuration permissions..." />;
  if (isError && !isForbidden(error)) {
    return <ErrorState title="Could not check asset configuration permissions" message={getErrorMessage(error)} />;
  }
  if (!hasPermission) return <ErrorState title="Not permitted" message={`Requires ${permissionKey}.`} />;
  return <Outlet key={JSON.stringify([auth.user?.iss, auth.user?.sub])} />;
}