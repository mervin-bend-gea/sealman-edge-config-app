import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import JsonEditor from "@/components/Input/JsonEditor";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useReported } from "@/features/ModuleConfigTemplates/api";
import Box from "@/features/ModuleConfigTemplates/Box";
import { EDITOR_HEIGHT, formatDate } from "@/features/ModuleConfigTemplates/utils";

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
    <Box
      label="Reported properties"
      title="Reported properties"
      description={`Reported by the module${lastUpdated ? `, last updated ${lastUpdated}` : ""}. Read-only, refreshes every 10 s.`}
      actions={(
        <Button variant="outline" size="sm" disabled={reported.isFetching} onClick={() => void reported.refetch()}>
          <RefreshCw className={cn("mr-1 h-4 w-4", reported.isFetching && "animate-spin")} /> Refresh
        </Button>
      )}
    >
      {reported.data ? (
        <JsonEditor label="Reported properties" value={text} readOnly className={EDITOR_HEIGHT} />
      ) : (
        <InlineAlert variant="info">This module has not reported any properties yet.</InlineAlert>
      )}
    </Box>
  );
}
