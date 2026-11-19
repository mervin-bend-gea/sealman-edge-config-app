import { toast } from "react-toastify";
import PageTitle from "@/components/Typography/PageTitle";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage } from "@/lib/errors";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import { usePlatformFunctions, useUpdatePlatformFunctions } from "@/features/PlatformFunctions/platformFunctionsApi";

export default function PlatformFunctionsSettings() {
  const functionsQuery = usePlatformFunctions();
  const update = useUpdatePlatformFunctions();
  const { hasPermission: canWrite, noPermissionsMessage } = usePermissions({ permissionKey: PERMISSION_KEYS.PLATFORM_CONFIG_WRITE });

  if (functionsQuery.isLoading) return <LoadingState label="Loading platform functions..." />;
  if (functionsQuery.isError || !functionsQuery.data) {
    return (
      <ErrorState
        title="Could not load platform functions"
        message={getErrorMessage(functionsQuery.error)}
        onRetry={() => functionsQuery.refetch()}
      />
    );
  }

  const functions = functionsQuery.data;

  return (
    <div className="space-y-6">
      <PageTitle title="Platform Functions" description="Optional functions that can be switched on or off for the whole platform." />

      <div className="divide-y rounded-lg border bg-background shadow-xs">
        <div className="flex items-center justify-between gap-6 px-6 py-4">
          <div className="space-y-1">
            <Label htmlFor="networkScan" className="cursor-pointer">
              Network Scan
            </Label>
            <p className="text-sm text-muted-foreground">
              Scan the networks behind the devices in the background to detect endpoints and services and show their
              connection state. When disabled, assets are still fully manageable, but no scans are run and no connection
              states are shown.
            </p>
          </div>
          <Switch
            id="networkScan"
            checked={functions.network_scan_enabled}
            disabled={!canWrite || update.isPending}
            title={canWrite ? undefined : noPermissionsMessage}
            onCheckedChange={(checked) =>
              update.mutate(
                { ...functions, network_scan_enabled: checked },
                { onError: (error) => toast.error(`Could not save Network Scan: ${getErrorMessage(error)}`) },
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
