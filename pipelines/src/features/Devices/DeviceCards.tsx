import Badge, { BadgeColor } from "../../components/Typography/Badge";
import { useNavigate, useParams } from "react-router-dom";
import { DeviceCardsProps } from "./Devices.types";
import FilterDetails from "./FilterDetails";
import { useState } from "react";
import DeviceSearchBar from "./DeviceSearch/DeviceSearchBar";
import DeviceMatchList from "./DeviceSearch/DeviceMatchList";

export function DeviceCards({
  table,
  data,
  search,
}: DeviceCardsProps) {
  const navigate = useNavigate();
  const { deviceId } = useParams();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const deviceItems = table.getRowModel().rows.map((row) => {
    const device = row.original;
    const matches = search.matchesByDevice.get(device.deviceId) ?? [];
    const expanded = search.hasTerm && expandedIds.has(device.deviceId);
    return (
      <div
        key={device.deviceId}
        className={`cursor-pointer rounded-lg border p-3 shadow-xs transition-colors hover:bg-slate-50 ${deviceId === device.deviceId ? "border-blue-200 bg-blue-50" : "bg-background"}`}
      >
        <div className="flex flex-row items-center gap-4">
          <div
            onClick={() => (search.hasTerm ? toggleExpanded(device.deviceId) : navigate(`/devices/${device.deviceId}`))}
            aria-expanded={search.hasTerm ? expanded : undefined}
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
            <DeviceMatchList deviceId={device.deviceId} matches={matches} term={search.term} />
          </div>
        )}
      </div>
    );
  });

  return (
    <div className="space-y-3 p-4">
      <div className="sticky top-0 z-10 space-y-2 rounded-lg border bg-background p-3 shadow-xs">
        <FilterDetails
          className="pb-2"
          totalRows={data.length}
          filteredRows={table.getRowModel().rows.length}
        />

        <DeviceSearchBar className="w-full" />
      </div>
      {deviceItems}
    </div>
  );
}
