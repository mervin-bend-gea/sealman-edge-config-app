import createSelectors from "@/utils/zustandSelectors";
import { ColumnFiltersState } from "@tanstack/react-table";
import { create } from "zustand";
import type { SearchChip } from "./DeviceSearch/deviceSearch";

interface DeviceStore {
  globalFilter: string;
  setGlobalFilter: (filterValue: string) => void;

  columnFilters: ColumnFiltersState;
  setColumnFilters: (columnFilters: ColumnFiltersState) => void;

  // Advanced search: the filter chips ("City: Berlin"); a device has to match ALL of them.
  searchChips: SearchChip[];
  setSearchChips: (searchChips: SearchChip[]) => void;

  // Column filters: the selected values per metadata field. Values of one column are alternatives
  // (OR); the columns, like the chips, all have to match (AND).
  columnValueFilters: Record<string, string[]>;
  setColumnValueFilter: (field: string, values: string[]) => void;

  // Removes the chips and the column filters (not the status filter, which is `columnFilters`).
  clearSearchFilters: () => void;
}

const useDeviceStore = create<DeviceStore>()((set) => ({
  globalFilter: "",
  setGlobalFilter: (filterValue: string) => set({ globalFilter: filterValue }),
  columnFilters: [],
  setColumnFilters: (columnFilters: ColumnFiltersState) => set({ columnFilters: columnFilters }),
  searchChips: [],
  setSearchChips: (searchChips: SearchChip[]) => set({ searchChips }),
  columnValueFilters: {},
  setColumnValueFilter: (field: string, values: string[]) =>
    set((state) => {
      const { [field]: _previous, ...others } = state.columnValueFilters;
      return { columnValueFilters: values.length > 0 ? { ...others, [field]: values } : others };
    }),
  clearSearchFilters: () => set({ searchChips: [], columnValueFilters: {} }),
}));

export default createSelectors(useDeviceStore);
