import { useState } from "react";
import { edgeConfigApi } from "../../../api/edgeConfig/edgeConfigApi";
import React from "react";
import { Button } from "@/components/ui/button";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage } from "@/lib/errors";
import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import JsonEditor from "../../../components/Input/JsonEditor";
import Box from "@/features/ModuleConfigTemplates/Box";
import { EDITOR_HEIGHT } from "@/features/ModuleConfigTemplates/utils";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { NoPermissionsPanel } from "@/features/authorization/permissions/NoPermissionsPanel";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";

interface LogData {
  payload: [
    {
      id: string;
      payload: string;
    }
  ];
}

export default function ModuleLogs({ moduleName }: { moduleName: string }) {
  const [lineNumber, setLineNumber] = useState(25);
  const { deviceId } = useParams();

  const { data, isPending, isError, error, refetch } = useQuery<
    LogData,
    AxiosError
  >({
    queryKey: ["getModuleLogs", deviceId, moduleName],
    queryFn: () => {
      const payload = {
        methodName: "GetModuleLogs",
        methodPayload: {
          schemaVersion: "1.0",
          items: [
            {
              id: moduleName,
              filter: {
                tail: lineNumber,
              },
            },
          ],
          encoding: "none",
          contentType: "text",
        },
      };
      return edgeConfigApi.invokeDirectMethod(deviceId, "$edgeAgent", payload);
    },
  });

  const handleFormChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = ev.target;
    setLineNumber(Number(value));
  };

  const { hasPermission, noPermissionsMessage } = usePermissions({
    deviceId: deviceId,
    permissionKey: PERMISSION_KEYS.DEVICE_MODULE_EXECUTE_METHOD,
  });

  if (!hasPermission) {
    return <NoPermissionsPanel>{noPermissionsMessage}</NoPermissionsPanel>;
  }

  if (isPending) return <LoadingState label="Loading logs..." />;

  if (isError) return <ErrorState title="Could not load the logs" message={getErrorMessage(error)} />;

  return (
    <Box
      label="Module logs"
      title="Module logs"
      description="The latest lines of the module's log, fetched from the device on request."
      actions={(
        <div className="flex items-center gap-2">
          <Label htmlFor="log-lines" className="text-sm">Lines</Label>
          <Input
            id="log-lines"
            type="number"
            name="lineNumber"
            className="w-24"
            value={lineNumber}
            onChange={handleFormChange}
          />
          <Button onClick={() => refetch()} disabled={isPending}>
            Get Module Logs
          </Button>
        </div>
      )}
    >
      <JsonEditor label="Module logs" value={data.payload[0]?.payload} readOnly={true} className={EDITOR_HEIGHT} />
    </Box>
  );
}
