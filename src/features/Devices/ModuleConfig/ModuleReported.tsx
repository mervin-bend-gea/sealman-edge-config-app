import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import JsonEditor from "@/components/Input/JsonEditor";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useReported } from "@/features/ModuleConfigTemplates/api";
import { formatDate } from "@/features/ModuleConfigTemplates/utils";

/** The module twin's reported properties, refreshed every few seconds. */
export default function ModuleReported({ deviceId, moduleName }: { deviceId: string; moduleName: string }) {
  const reported = useReported(deviceId, moduleName);
  const text = reported.data ? JSON.stringify(reported.data, null, 2) : "";
  const lastUpdated = typeof reported.data?.lastUpdated === "string" ? formatDate(reported.data.lastUpdated) : undefined;

  if (reported.isLoading) return <LoadingState label="Loading reported properties..." />;
  if (reported.isError) {
    return (
      <InlineAlert action={<Button size="sm" variant="outline" onClick={() => void reported.refetch()}>Retry</Button>}>
        Could not load the reported properties: {getErrorMessage(reported.error)}
      </InlineAlert>
    );
  }
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Reported by the module{lastUpdated ? `, last updated ${lastUpdated}` : ""}. Read-only, refreshes every 10 s.</span>
        <Button variant="outline" size="sm" className="ml-auto" disabled={reported.isFetching} onClick={() => void reported.refetch()}>
          <RefreshCw className={cn("mr-1 h-4 w-4", reported.isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>
      {reported.data ? (
        <div className="min-h-0 flex-1" style={{ minHeight: "20rem" }}>
          <JsonEditor label="Reported properties" value={text} readOnly />
        </div>
      ) : (
        <InlineAlert variant="info">This module has not reported any properties yet.</InlineAlert>
      )}
    </div>
  );
}
