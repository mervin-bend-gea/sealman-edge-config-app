import { useState } from "react";
import { toast } from "react-toastify";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inputClass } from "@/features/PlatformTypes/FieldValueInput";
import useGetDefaultScanPorts from "@/generated/edge-administration/hooks/network/useGetDefaultScanPorts";
import usePostDefaultScanPort from "@/generated/edge-administration/hooks/network/usePostDefaultScanPort";
import useDeleteDefaultScanPort from "@/generated/edge-administration/hooks/network/useDeleteDefaultScanPort";

/**
 * The global list of ports scanned on every device at minimum, regardless of what's configured
 * on any one of them (see get_network_scan_ports.py). Seeded from every service type's own
 * default port, and kept in sync whenever a new service type is created with one - but also
 * directly editable here, independent of any single service type.
 */
export default function DefaultScanPortsCard({ canEdit = true }: { canEdit?: boolean }) {
  const portsQuery = useGetDefaultScanPorts();
  const { postDefaultScanPort, isPending: isAdding } = usePostDefaultScanPort();
  const { deleteDefaultScanPort } = useDeleteDefaultScanPort();
  const [portInput, setPortInput] = useState("");

  const ports = portsQuery.data ?? [];

  const addPort = async () => {
    if (!canEdit) return;
    const port = Number(portInput);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error("Enter a valid port (1-65535)");
      return;
    }
    if (ports.includes(port)) {
      setPortInput("");
      return;
    }
    await postDefaultScanPort({ port });
    await portsQuery.refetch();
    setPortInput("");
  };

  const removePort = async (port: number) => {
    if (!canEdit) return;
    await deleteDefaultScanPort(port);
    await portsQuery.refetch();
  };

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Default Scan Ports</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Ports scanned automatically on every device, at minimum - on top of whichever ports its own configured
          services use. New service types with a default port are added here automatically.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          disabled={!canEdit}
          value={portInput}
          onChange={(e) => setPortInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addPort();
            }
          }}
          placeholder="e.g. 502"
          className={`${inputClass} h-9 max-w-40 disabled:cursor-not-allowed disabled:opacity-50`}
        />
        <Button type="button" variant="outline" onClick={addPort} disabled={!canEdit || isAdding} className="shrink-0" aria-label="Add port">
          <Plus />
        </Button>
      </div>

      {portsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading ports...</p>
      ) : ports.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No default ports configured yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ports.map((port) => (
            <Badge key={port} variant="secondary" className="gap-1">
              {port}
              <button type="button" onClick={() => removePort(port)} disabled={!canEdit} aria-label={`Remove port ${port}`} className="disabled:cursor-not-allowed disabled:opacity-50">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
