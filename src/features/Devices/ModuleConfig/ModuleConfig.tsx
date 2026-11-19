import { useState } from "react";
import { WaterLoader } from "@/components/ui/water-loader";
import { Button } from "@/components/ui/button";
import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import { useParams } from "react-router-dom";
import JsonEditor from "../../../components/Input/JsonEditor";
import { edgeConfigApiHooks } from "../../../api/edgeConfig/edgeConfigApiHooks";
import { toast } from "react-toastify";
import { getErrorMessage } from "@/lib/errors";
import { withPermissionRequiredTooltip } from "@/features/authorization/permissions/withPermissionRequiredTooltip";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import Box from "@/features/ModuleConfigTemplates/Box";
import CreateTemplateFromConfigDialog from "@/features/ModuleConfigTemplates/CreateTemplateFromConfigDialog";
import { EDITOR_HEIGHT } from "@/features/ModuleConfigTemplates/utils";

interface ModuleConfigProps {
  moduleName: string;
  moduleStatus: string;
}

const GuardedButton = withPermissionRequiredTooltip(Button);

/** The module's configuration as raw JSON: read from the twin, written as it is. */
export default function ModuleConfig({ moduleName, moduleStatus }: ModuleConfigProps) {
  const { deviceId } = useParams();

  const {
    data: config,
    isPending,
    isError,
    error,
    refetch,
  } = edgeConfigApiHooks.useGetTwinConfig<string>(deviceId, moduleName, {
    select: (data) => JSON.stringify(data, null, 4),
    staleTime: Infinity,
  });

  if (isPending) return <LoadingState />;

  return (
    <>
      {isError && (
        <InlineAlert
          action={<Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>}
        >
          Could not retrieve the twin config: {getErrorMessage(error)}
        </InlineAlert>
      )}
      <JsonForm moduleName={moduleName} moduleStatus={moduleStatus} data={isError ? "" : config} />
    </>
  );
}

function JsonForm({ moduleName, moduleStatus, data }: { moduleName: string; moduleStatus: string; data: string }) {
  const [twinConfigForm, setTwinConfig] = useState(data);
  const [templateSource, setTemplateSource] = useState<unknown>();
  const { deviceId } = useParams();
  if (!deviceId) throw new Error("No deviceId provided");

  const usePostTwinConfig = edgeConfigApiHooks.usePostTwinConfig(deviceId, moduleName);
  const blocked = moduleStatus === "delete_scheduled" || moduleStatus === "deploy_scheduled";

  const onSetTwinConfig = () => {
    usePostTwinConfig.mutate(twinConfigForm, {
      onSuccess: () => {
        toast.success(`Config update scheduled for ${moduleName}`);
      },
      onError: (err) => {
        toast.error(`Could not schedule the config update: ${getErrorMessage(err)}`);
      },
    });
  };

  const onCreateTemplate = () => {
    try {
      setTemplateSource(JSON.parse(twinConfigForm));
    } catch {
      toast.error("The editor content is not valid JSON");
    }
  };

  return (
    <>
      <Box
        label="Raw configuration"
        title="Raw JSON"
        description="Writes the JSON as it is. The write is recorded in the history, but is not tied to a template."
      >
        <JsonEditor label="Raw module configuration" value={twinConfigForm} onChange={setTwinConfig} className={EDITOR_HEIGHT} />
        {blocked ? (
          <InlineAlert variant="warning">Cannot set the twin config in the current module state</InlineAlert>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <GuardedButton
              deviceId={deviceId}
              permissionKey={PERMISSION_KEYS.DEVICE_MODULE_TWIN_CONFIG_WRITE}
              disabled={usePostTwinConfig.isPending}
              onClick={() => onSetTwinConfig()}
            >
              {usePostTwinConfig.isPending && <WaterLoader />}
              Set Twin Config
            </GuardedButton>
            <GuardedButton
              permissionKey={PERMISSION_KEYS.MODULE_CONFIG_TEMPLATE_WRITE}
              variant="outline"
              disabled={!twinConfigForm.trim()}
              onClick={onCreateTemplate}
            >
              Create template from this
            </GuardedButton>
            <span className="text-xs text-muted-foreground">
              Changes may take a few seconds to apply. If you reload right away you might still see the old values.
            </span>
          </div>
        )}
      </Box>
      <CreateTemplateFromConfigDialog
        open={templateSource !== undefined}
        onOpenChange={(open) => { if (!open) setTemplateSource(undefined); }}
        moduleName={moduleName}
        config={templateSource}
      />
    </>
  );
}
