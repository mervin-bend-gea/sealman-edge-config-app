import createSelectors from "@/utils/zustandSelectors";
import { ColumnFiltersState } from "@tanstack/react-table";
import { create } from "zustand";
import type { DeviceSearchFilter } from "@/generated/edge-administration/hooks/devices/useSearchDevices";

interface DeviceStore {
  globalFilter: string;
  setGlobalFilter: (filterValue: string) => void;

  columnFilters: ColumnFiltersState;
  setColumnFilters: (columnFilters: ColumnFiltersState) => void;

  // Advanced search: the selected filter chips. None selected = the plain quick search.
  searchFilters: DeviceSearchFilter[];
  setSearchFilters: (searchFilters: DeviceSearchFilter[]) => void;
}

const useDeviceStore = create<DeviceStore>()((set) => ({
  globalFilter: "",
  setGlobalFilter: (filterValue: string) => set({ globalFilter: filterValue }),
  columnFilters: [],
  setColumnFilters: (columnFilters: ColumnFiltersState) => set({ columnFilters: columnFilters }),
  searchFilters: [],
  setSearchFilters: (searchFilters: DeviceSearchFilter[]) => set({ searchFilters }),
}));

export default createSelectors(useDeviceStore);
