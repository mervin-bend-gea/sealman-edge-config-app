import { DeviceData } from "@/api/edgeConfig/edgeConfigApiHooks";
import { Table as TanstackTable } from "@tanstack/react-table";
import type { DeviceSearchState } from "./DeviceSearch/useDeviceSearch";

export interface DeviceDataDisplay extends DeviceData {
  onlineStatusEdge: string;
}

export interface DeviceListProps {
  table: TanstackTable<DeviceDataDisplay>;
}

export interface DeviceCardsProps extends DeviceListProps {
  globalFilter: string;
  data: DeviceDataDisplay[];
  search: DeviceSearchState;
}
