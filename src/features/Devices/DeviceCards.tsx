import Badge, { BadgeColor } from "../../components/Typography/Badge";
import { useNavigate, useParams } from "react-router-dom";
import { DeviceCardsProps } from "./Devices.types";
import { useState , useEffect } from "react";
import DeviceMatchList from "./DeviceSearch/DeviceMatchList";

export function DeviceCards({
  table,
  search,
}: DeviceCardsProps) {
  const navigate = useNavigate();
  const { deviceId } = useParams();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const resultIds = table.getRowModel().rows
    .map((row) => row.original.deviceId)
    .filter((id) => (search.matchesByDevice.get(id)?.length ?? 0) > 0);
  const resultSignature = resultIds.join("|");
  useEffect(() => {
    if (search.active && !search.isFetching) setExpandedIds(new Set(resultIds));
    else if (!search.active) setExpandedIds(new Set());
  }, [search.active, search.isFetching, resultSignature]);
  const toggleExpanded = (id: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const deviceItems = table.getRowModel().rows.map((row) => {
    const device = row.original;
    const matches = search.matchesByDevice.get(device.deviceId) ?? [];
    const expandable = search.expandable && matches.length > 0;
    const expanded = expandable && expandedIds.has(device.deviceId);
    return (
      <div
        key={device.deviceId}
        className={`cursor-pointer rounded-lg border p-3 shadow-xs transition-colors hover:bg-slate-50 ${deviceId === device.deviceId ? "border-blue-200 bg-blue-50" : "bg-background"}`}
      >
        <div className="flex flex-row items-center gap-4">
          <div
            onClick={() => (expandable ? toggleExpanded(device.deviceId) : navigate(`/devices/${device.deviceId}`))}
            aria-expanded={expandable ? expanded : undefined}
          >
            <div className="flex flex-row gap-1">
                <Badge color={device.deviceStatus === "Connected" ? BadgeColor.Green : BadgeColor.Red}>
                  {device.deviceStatus === "Connected" ? "online" : "offline"}
                </Badge>
              <Badge>{device.deviceMetadata.customer?.value as string}</Badge>
            </div>
            <div className="font-semibold truncate">{device.deviceId}</div>
            <div className="truncate text-sm text-muted-foreground">
              {device.deviceMetadata.description?.value as string}
            </div>
          </div>
        </div>
        {expanded && (
          <div className="-mx-3 mt-3 -mb-3 border-t bg-slate-50">
            <DeviceMatchList deviceId={device.deviceId} matches={matches} terms={search.terms} />
          </div>
        )}
      </div>
    );
  });

  return (
    <div className="space-y-3">
      {deviceItems}
    </div>
  );
}
