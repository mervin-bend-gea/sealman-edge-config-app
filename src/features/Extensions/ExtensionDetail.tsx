import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Power,
  PowerOff,
  KeyRound,
  Trash2,
  Pencil,
  RefreshCcw,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { withPermissionRequiredTooltip } from "@/features/authorization/permissions/withPermissionRequiredTooltip";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import {
  useDeleteExtension,
  useDisableExtension,
  useEnableExtension,
  useGetExtension,
  useRotateExtensionInternalKey,
} from "@/generated/edge-administration/hooks/useExtensions";
import { ExtensionEnabledBadge } from "./ExtensionEnabledBadge";
import { HealthDot } from "./HealthDot";
import { HttpMethodBadge } from "./HttpMethodBadge";
import { Input } from "@/components/ui/input";
import { ValidationModeBadge } from "./ValidationModeBadge";
import { useExtensionHealth } from "./useExtensionHealth";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { isForbidden } from "@/lib/errors";
import { extensionErrorMessages } from "./extensionErrors";
import DeviceKeysCard from "./DeviceKeysCard";
import { OneTimeKey } from "./OneTimeKeyDialog";
import { isSupportedOutlet } from "./outlets/outlets";

const GuardedButton = withPermissionRequiredTooltip(Button);

export default function ExtensionDetail() {
  const { name } = useParams();
  const { hasPermission: canRegister } = usePermissions({ permissionKey: PERMISSION_KEYS.EXTENSION_REGISTER });
  const { hasPermission: canDeregister } = usePermissions({ permissionKey: PERMISSION_KEYS.EXTENSION_DEREGISTER });
  return <ExtensionDetailContent key={`${name}:${canRegister}:${canDeregister}`} canRegister={canRegister} canDeregister={canDeregister} />;
}

function ExtensionDetailContent({ canRegister, canDeregister }: { canRegister: boolean; canDeregister: boolean }) {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: extension, isLoading, isError, error } = useGetExtension(name ?? "");
  const enableExtension = useEnableExtension();
  const disableExtension = useDisableExtension();
  const deleteExtension = useDeleteExtension();
  const rotateKey = useRotateExtensionInternalKey();
  const health = useExtensionHealth(name ?? "", !isError && (extension?.enabled ?? false), extension?.upstreams);

  const [deregisterOpen, setDeregisterOpen] = useState(false);
  const [deregisterConfirmText, setDeregisterConfirmText] = useState("");
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["get", "/extensions"] });
    queryClient.invalidateQueries({ queryKey: ["get", "/extensions/{name}", { params: { path: { name } } }] });
  }

  async function handleToggleEnabled() {
    if (extension?.enabled ? !canDeregister : !canRegister) { toast.error("Not permitted"); return; }
    if (!name) return;
    try {
      if (extension?.enabled) {
        await disableExtension.mutateAsync({ params: { path: { name } } });
        toast.success(`Extension "${name}" disabled`);
      } else {
        await enableExtension.mutateAsync({ params: { path: { name } } });
        toast.success(`Extension "${name}" enabled`);
      }
      invalidate();
    } catch (e) {
      toast.error(extensionErrorMessages(e, "Failed to change extension state")[0]);
    }
  }

  async function handleDeregister() {
    if (!canDeregister) { toast.error("Not permitted"); return; }
    if (!name) return;
    try {
      await deleteExtension.mutateAsync({ params: { path: { name } } });
      toast.success(`Extension "${name}" deregistered`);
      navigate("..");
    } catch (e) {
      toast.error(extensionErrorMessages(e, "Failed to deregister extension")[0]);
      setDeregisterOpen(false);
    }
  }

  async function handleRotateKey() {
    if (!canRegister) { toast.error("Not permitted"); return; }
    if (!name) return;
    try {
      const result = await rotateKey.mutateAsync({ params: { path: { name } } });
      setRotatedKey(result.internal_key);
    } catch (e) {
      toast.error(extensionErrorMessages(e, "Failed to rotate internal key")[0]);
      setRotateOpen(false);
    } finally {
      rotateKey.reset();
    }
  }

  const backButton = (
    <Button variant="outline" size="sm" className="h-7 px-2 bg-card" onClick={() => navigate("..")}>
      <ArrowLeft className="h-4 w-4 mr-1" />
      Extensions
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {backButton}
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !extension) {
    return (
      <div className="space-y-4">
        {backButton}
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-12">
          <AlertCircle className="h-8 w-8 text-destructive opacity-60" />
          <p className="text-sm">{isForbidden(error) ? "Not permitted" : "Failed to load extension."}</p>
        </div>
      </div>
    );
  }

  const upstreamEntries = Object.entries(extension.upstreams ?? {});

  return (
    <div className="space-y-6">
      {backButton}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{extension.name}</h1>
            <ExtensionEnabledBadge enabled={extension.enabled} />
          </div>
          {extension.description && <p className="text-sm text-muted-foreground mt-1">{extension.description}</p>}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={health.recheck}
            disabled={health.isChecking || !extension.enabled}
            title={extension.enabled ? undefined : "Enable the extension to check its upstream health"}
          >
            <RefreshCcw className={`h-4 w-4 mr-1 ${health.isChecking ? "animate-spin" : ""}`} />
            Check health
          </Button>
          <GuardedButton
            permissionKey={extension.enabled ? PERMISSION_KEYS.EXTENSION_DEREGISTER : PERMISSION_KEYS.EXTENSION_REGISTER}
            size="sm"
            variant="outline"
            onClick={handleToggleEnabled}
          >
            {extension.enabled ? <PowerOff className="h-4 w-4 mr-1" /> : <Power className="h-4 w-4 mr-1" />}
            {extension.enabled ? "Disable" : "Enable"}
          </GuardedButton>
          <GuardedButton permissionKey={PERMISSION_KEYS.EXTENSION_REGISTER} size="sm" variant="outline" onClick={() => navigate("edit")}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </GuardedButton>
          <GuardedButton permissionKey={PERMISSION_KEYS.EXTENSION_REGISTER} size="sm" variant="outline" onClick={() => { setRotatedKey(null); setRotateOpen(true); }}>
            <KeyRound className="h-4 w-4 mr-1" />
            Rotate key
          </GuardedButton>
          <GuardedButton permissionKey={PERMISSION_KEYS.EXTENSION_DEREGISTER} size="sm" variant="destructive" onClick={() => setDeregisterOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" />
            Deregister
          </GuardedButton>
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Internal key issued</dt>
          <dd>{extension.internal_key_created_at ? <time dateTime={extension.internal_key_created_at}>{new Date(extension.internal_key_created_at).toLocaleString()}</time> : "Not available"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Internal key last rotated</dt>
          <dd>{extension.internal_key_rotated_at ? <time dateTime={extension.internal_key_rotated_at}>{new Date(extension.internal_key_rotated_at).toLocaleString()}</time> : "Never rotated"}</dd>
        </div>
      </dl>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Upstreams</h3>
        <div className="border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upstreamEntries.map(([key, spec]) => {
                const status = health.upstreams?.[key];
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <HealthDot status={status?.last_status} detail={status?.last_detail} lastCheckedAt={status?.last_checked_at} disabled={!extension.enabled} checkStartedAt={health.checkStartedAt} error={health.error} />
                    </TableCell>
                    <TableCell className="font-medium">{key}</TableCell>
                    <TableCell><Badge variant="outline">{spec.type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {spec.type === "http" ? spec.base_url : spec.module_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{status?.last_detail ?? "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Routes</h3>
        <div className="border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Upstream</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Validation</TableHead>
                <TableHead>Required action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(extension.routes ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No routes defined.
                  </TableCell>
                </TableRow>
              ) : (
                extension.routes.map((route, i) => (
                  <TableRow key={`${route.method}-${route.path}-${i}`}>
                    <TableCell className="font-mono text-xs">{route.path}</TableCell>
                    <TableCell><HttpMethodBadge method={route.method} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{route.upstream}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-muted-foreground">{route.visibility}</Badge>
                    </TableCell>
                    <TableCell><ValidationModeBadge mode={route.validation_mode} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{route.required_action ?? "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {extension.routes.some((route) => route.visibility === "device") && <DeviceKeysCard name={extension.name} />}

      {extension.ui && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">UI</h3>
          <div className="border rounded-lg overflow-hidden bg-card">
            <div className="px-4 py-3 text-sm space-y-1 border-b">
              <div><span className="text-muted-foreground">Entry: </span><span className="font-mono text-xs">{extension.ui.entry}</span></div>
              <div><span className="text-muted-foreground">Remote name: </span><span className="font-mono text-xs">{extension.ui.remoteName}</span></div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extension.ui.contributions.map((c, i) => (
                  <TableRow key={`${c.target}-${c.placement}-${i}`}>
                    <TableCell className="font-mono text-xs">{c.target}</TableCell>
                    <TableCell className="font-mono text-xs">{c.placement}</TableCell>
                    <TableCell>{c.label}</TableCell>
                    <TableCell>
                      {!isSupportedOutlet(c.target, c.placement) && (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                          Not available in this Sealman version
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <AlertDialog
        open={deregisterOpen}
        onOpenChange={(o) => { setDeregisterOpen(o); if (!o) setDeregisterConfirmText(""); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deregister "{extension.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This unmounts every live route for this extension and permanently removes its manifest, issued
              internal key, and RBAC action provenance. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">
              Type <span className="font-mono font-medium text-foreground">{extension.name}</span> to confirm.
            </label>
            <Input
              value={deregisterConfirmText}
              onChange={(e) => setDeregisterConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeregister}
              disabled={deleteExtension.isPending || deregisterConfirmText !== extension.name}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteExtension.isPending ? "Deregistering…" : "Deregister"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rotateOpen} onOpenChange={(o) => { if (rotateKey.isPending) return; setRotateOpen(o); if (!o) setRotatedKey(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate internal key</DialogTitle>
            <DialogDescription>
              The previous key stops working immediately. The new key is only ever shown here, once.
            </DialogDescription>
          </DialogHeader>
          {rotatedKey ? (
            <OneTimeKey secret={rotatedKey} />
          ) : (
            <p className="text-sm text-muted-foreground">Rotating will immediately invalidate the current key.</p>
          )}
          <DialogFooter>
            {rotatedKey ? (
              <Button onClick={() => { setRotatedKey(null); setRotateOpen(false); }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" disabled={rotateKey.isPending} onClick={() => setRotateOpen(false)}>Cancel</Button>
                <Button onClick={handleRotateKey} disabled={rotateKey.isPending}>
                  {rotateKey.isPending ? "Rotating…" : "Rotate key"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
