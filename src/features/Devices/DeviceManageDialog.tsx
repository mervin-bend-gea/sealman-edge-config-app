import { useEffect, useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { WaterLoader } from "@/components/ui/water-loader";
import { edgeConfigApi } from "@/api/edgeConfig/edgeConfigApi";
import { useQueryClient } from "@tanstack/react-query";
import useGetDeviceTypes from "@/generated/edge-administration/hooks/device_types/useGetDeviceTypes";
import FieldValueInput, { validateFields } from "@/features/PlatformTypes/FieldValueInput";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/page-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function Message({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  return <InlineAlert variant={kind}>{children}</InlineAlert>;
}

// ─── Create Device Dialog ─────────────────────────────────────────────────────
export default function DeviceManageDialog({ canCreate }: { canCreate: boolean }) {
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [authType, setAuthType] = useState("sas");
  const [registrationId, setRegistrationId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const deviceTypesQuery = useGetDeviceTypes();

  useEffect(() => {
    if (open) deviceTypesQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const deviceTypes = deviceTypesQuery.data ?? [];
  const selectedType = deviceTypes.find((t) => t.type_id === typeId);
  const defaultType = deviceTypes.find((t) => t.type_id === "default");
  // The default type's required fields apply to every device type (see
  // db/sqlalchemy/device.py:_effective_fields_for), so the form must surface and validate them
  // even when a non-default type is selected; the selected type's own definitions win on collision.
  const effectiveFields = { ...(defaultType?.fields ?? {}), ...(selectedType?.fields ?? {}) };

  const openDialog = () => {
    setOpen(true); setDeviceId(""); setAuthType("sas"); setRegistrationId("");
    setTypeId(""); setFieldValues({});
    setError(null); setSuccess(null);
  };
  const closeDialog = () => { setOpen(false); setError(null); setSuccess(null); };

  const handleTypeChange = (newTypeId: string) => {
    setTypeId(newTypeId);
    const type = deviceTypes.find((t) => t.type_id === newTypeId);
    const fields = { ...(defaultType?.fields ?? {}), ...(type?.fields ?? {}) };
    const defaults: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
      defaults[key] = field.default ?? null;
    }
    setFieldValues(defaults);
  };

  const handleCreate = async () => {
    if (!deviceId.trim()) { setError("Device ID is required"); return; }
    if (!typeId) { setError("Device type is required"); return; }
    const validationError = validateFields(fieldValues, effectiveFields);
    if (validationError) { setError(validationError); return; }
    setLoading(true); setError(null);
    try {
      const meta: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fieldValues)) {
        if (value !== null && value !== undefined && value !== "") meta[key] = value;
      }
      await edgeConfigApi.createDevice(
        deviceId.trim(), authType, typeId,
        Object.keys(meta).length > 0 ? meta : undefined,
        registrationId.trim() || undefined,
      );
      setSuccess(`Device "${deviceId}" created successfully.`);
      queryClient.invalidateQueries({ queryKey: ["get", "/devices", "withCountryData"] });
      queryClient.invalidateQueries({ queryKey: ["permissions", "device-management"] });
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e as Error).message,
      );
    } finally { setLoading(false); }
  };

  if (!canCreate) return null;

  return (
    <>
      <Button onClick={openDialog} disabled>Add Device</Button>

      <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Device</DialogTitle>
            <DialogDescription className="sr-only">Register a new device</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label>Device ID <span className="text-red-500">*</span></Label>
              <Input type="text" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
                placeholder="e.g. 90909090" />
            </div>
            <div className="space-y-1.5">
              <Label>Auth Type</Label>
              <Select value={authType} onValueChange={setAuthType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sas">sas</SelectItem>
                  <SelectItem value="tpm" disabled>tpm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Registration ID <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </Label>
              <Input type="text" value={registrationId} onChange={(e) => setRegistrationId(e.target.value)}
                placeholder="Leave blank to use Device ID" />
            </div>

            <div className="space-y-1.5">
              <Label>Device Type <span className="text-red-500">*</span></Label>
              <Select value={typeId} onValueChange={handleTypeChange} disabled={deviceTypesQuery.isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={deviceTypesQuery.isLoading ? "Loading device types…" : "Select a device type…"} />
                </SelectTrigger>
                <SelectContent>
                  {deviceTypes.map((type) => (
                    <SelectItem key={type.type_id} value={type.type_id}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {deviceTypesQuery.isSuccess && deviceTypes.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No device types defined yet. Create one under Asset Configuration.
                </p>
              )}
            </div>

            {selectedType && Object.keys(effectiveFields).length > 0 && (
              <div className="space-y-1.5">
                <Label>Fields</Label>
                <div className="rounded-lg border overflow-visible divide-y">
                  {Object.entries(effectiveFields).map(([key, field]) => (
                    <div key={key} className="px-3 py-2.5">
                      <span className="text-sm font-medium block mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500"> *</span>}
                      </span>
                      {field.description && (
                        <p className="text-xs text-muted-foreground mb-1.5">{field.description}</p>
                      )}
                      <FieldValueInput
                        definition={field}
                        value={fieldValues[key] ?? null}
                        onChange={(value) => setFieldValues((p) => ({ ...p, [key]: value }))}
                        placeholder={field.label}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <Message kind="error">{error}</Message>}
            {success && <Message kind="success">{success}</Message>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDialog}>
              {success ? "Close" : "Cancel"}
            </Button>
            {!success && (
              <Button onClick={handleCreate} disabled={loading}>
                {loading && <WaterLoader />}
                {loading ? "Processing..." : "Create"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteDeviceButton({ deviceId, canDelete, onDelete }: { deviceId: string; canDelete: boolean; onDelete: () => void }) {
  if (!canDelete) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="h-8 w-8 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        title="Delete device"
        aria-label={`Delete device ${deviceId}`}
      >
        <TrashIcon />
      </Button>
    </>
  );
}

interface DeleteDeviceDialogProps { deviceId: string; onClose: () => void; }

export function DeleteDeviceDialog({ deviceId, onClose }: DeleteDeviceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    setLoading(true); setError(null);
    try {
      await edgeConfigApi.deleteDevice(deviceId);
      setSuccess(`Device "${deviceId}" deleted successfully.`);
      queryClient.invalidateQueries({ queryKey: ["permissions", "device-management"] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["get", "/devices", "withCountryData"] }), 6000);
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e as Error).message,
      );
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Device</DialogTitle>
          <DialogDescription className="sr-only">Permanently delete the device</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label>Device ID</Label>
            <Input type="text" value={deviceId} disabled />
          </div>
          {!success && (
            <Message kind="error">
              This will permanently remove the device from SEMS, IoTHub, and the database.
            </Message>
          )}
          {error && <Message kind="error">{error}</Message>}
          {success && <Message kind="success">{success}</Message>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            {success ? "Close" : "Cancel"}
          </Button>
          {!success && (
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading && <WaterLoader />}
              {loading ? "Deleting..." : "Delete"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
