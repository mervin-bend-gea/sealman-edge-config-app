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
import CreateTemplateFromConfigDialog from "@/features/ModuleConfigTemplates/CreateTemplateFromConfigDialog";

interface ModuleConfigProps {
  moduleName: string;
  appMessage?: string;
  moduleStatus: string;
}

const GuardedButton = withPermissionRequiredTooltip(Button);

export default function ModuleConfig({
  moduleName,
  appMessage,
  moduleStatus,
}: ModuleConfigProps) {
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

  if (isError) {
    return (
      <>
        <InlineAlert
          className="my-2"
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Could not retrieve the twin config: {getErrorMessage(error)}
        </InlineAlert>
        <JsonForm
          moduleName={moduleName}
          appMessage={appMessage}
          moduleStatus={moduleStatus}
          data={""}
        />
      </>
    );
  }

  return (
    <JsonForm
      moduleName={moduleName}
      appMessage={appMessage}
      moduleStatus={moduleStatus}
      data={config}
    />
  );
}

interface JsonFormProps {
  moduleName: string;
  appMessage?: string;
  moduleStatus: string;
  data: string;
}
function JsonForm({
  moduleName,
  appMessage,
  moduleStatus,
  data,
}: JsonFormProps) {
  const [twinConfigForm, setTwinConfig] = useState(data);
  const [templateSource, setTemplateSource] = useState<unknown>();
  const { deviceId } = useParams();
  if (!deviceId) throw new Error("No deviceId provided");

  const usePostTwinConfig = edgeConfigApiHooks.usePostTwinConfig(deviceId, moduleName);

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

  const handleFormChange = (newValue: string) => {
    setTwinConfig(newValue);
  };

  return (
    <>
      <div className="h-[calc(100%-8rem)] md:h-[calc(100%-5rem)]">
        <JsonEditor value={twinConfigForm} onChange={handleFormChange} />
      </div>
      {appMessage &&
        appMessage !== "configuration successfull" &&
        appMessage !== "configuration successful" && (
          <InlineAlert className="mt-2 max-h-36 overflow-y-auto">{appMessage}</InlineAlert>
        )}
      {moduleStatus === "delete_scheduled" ||
      moduleStatus === "deploy_scheduled" ? (
        <InlineAlert variant="warning" className="mt-2">
          Cannot set the twin config in the current module state
        </InlineAlert>
      ) : (
        <div className="flex items-center">
          <GuardedButton
              deviceId={deviceId}
              permissionKey={PERMISSION_KEYS.DEVICE_MODULE_TWIN_CONFIG_WRITE}
              disabled={usePostTwinConfig.isPending}
              className="mt-2"
              onClick={() => onSetTwinConfig()}
            >
              {usePostTwinConfig.isPending && <WaterLoader />}
              Set Twin Config
          </GuardedButton>

          <GuardedButton
              permissionKey={PERMISSION_KEYS.MODULE_CONFIG_TEMPLATE_WRITE}
              variant="outline"
              className="mt-2 ml-2"
              disabled={!twinConfigForm.trim()}
              onClick={onCreateTemplate}
            >
              Create template from this
          </GuardedButton>

          <span className="ml-2">
            ⚠️ Changes may take a few seconds to apply. If you reload this page
            immediately, you might still see the old values. Please wait a
            moment and try again.
          </span>
        </div>
      )}
      <CreateTemplateFromConfigDialog
        open={templateSource !== undefined}
        onOpenChange={(open) => { if (!open) setTemplateSource(undefined); }}
        moduleName={moduleName}
        config={templateSource}
      />
    </>
  );
}
