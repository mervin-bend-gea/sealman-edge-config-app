import { Fragment, useEffect, useMemo, useState } from "react";
import Badge from "../../components/Typography/Badge";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDownIcon, ChevronRightIcon, CpuChipIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  getSortedRowModel,
  Updater,
  ColumnFiltersState,
  ColumnDef,
} from "@tanstack/react-table";
import { DeviceData } from "../../api/edgeConfig/edgeConfigApiHooks";
import DevicesHeader, { DeviceOnlineFilterStatus } from "./DevicesHeader";
import FilterDetails from "./FilterDetails";
import useDeviceStore from "./deviceStore";
import DeviceSearchBar from "./DeviceSearch/DeviceSearchBar";
import DeviceMatchList from "./DeviceSearch/DeviceMatchList";
import useDeviceSearch, { DeviceSearchState } from "./DeviceSearch/useDeviceSearch";
import useGetDevices from "@/generated/edge-administration/hooks/useGetDevices/useGetDevices";
import useDeviceMetadataFields from "@/features/PlatformTypes/useDeviceMetadataFields";
import { formatMetadataValue } from "@/features/PlatformTypes/FieldValueInput";
import useDeviceTableColumnsStore, { defaultFieldVisible } from "@/features/PlatformTypes/deviceTableColumnsStore";
import { DeviceDataDisplay, DeviceListProps } from "./Devices.types";
import { DeviceCards } from "./DeviceCards";
import DeviceManageDialog, { DeleteDeviceDialog } from "./DeviceManageDialog";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage } from "@/lib/errors";

function formatDataForTable(data: DeviceData[] | undefined): DeviceDataDisplay[] {
  if (!data) return [];

  return data.map((device) => ({
    ...device,
    onlineStatusEdge: device.iotEdgeRuntime === "Connected" ? "online" : "offline",
  }));
}

const columnHelper = createColumnHelper<DeviceDataDisplay>();

const baseColumns: ColumnDef<DeviceDataDisplay, any>[] = [
  columnHelper.accessor("onlineStatusEdge", {
    cell: (info) => {
      const online = info.getValue() === "online";
      return (
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            online
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <span className="relative flex h-2 w-2">
            {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-red-500"}`} />
          </span>
          {online ? "Online" : "Offline"}
        </span>
      );
    },
    header: "Status",
    filterFn: "equalsString",
  }),
  columnHelper.accessor("iotEdgeRuntime", {
    cell: (info) => <Badge>{info.getValue()}</Badge>,
    header: "Edge Runtime",
    filterFn: "equalsString",
  }),
  columnHelper.accessor("deviceId", {
    cell: (info) => (
      <span className="inline-flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700">
          <CpuChipIcon className="h-4 w-4" />
        </span>
        <span className="font-semibold tracking-tight">{info.getValue()}</span>
      </span>
    ),
    header: () => "Device-ID",
  }),
];

export default function DeviceList() {
  const globalFilter = useDeviceStore.use.globalFilter();
  const setGlobalFilter = useDeviceStore.use.setGlobalFilter();

  const columnFilters = useDeviceStore.use.columnFilters();
  const setColumnFiltersStore = useDeviceStore.use.setColumnFilters();
  const setColumnFilters = (updaterOrValue: Updater<ColumnFiltersState>) => {
    setColumnFiltersStore(
      typeof updaterOrValue === "function"
        ? updaterOrValue(columnFilters)
        : updaterOrValue,
    );
  };

  const setSearchFilters = useDeviceStore.use.setSearchFilters();
  const search = useDeviceSearch();

  useEffect(() => {
    setGlobalFilter("");
    setColumnFiltersStore([]);
    setSearchFilters([]);
  }, [setColumnFiltersStore, setGlobalFilter, setSearchFilters]);

  const { isLoading, isError, data, error } = useGetDevices();
  const { fields: metadataFields } = useDeviceMetadataFields();
  const columnVisibilityOverrides = useDeviceTableColumnsStore((s) => s.overrides);

  // With an advanced search running, only the devices the API matched are listed.
  const tableData = useMemo<DeviceDataDisplay[]>(() => {
    const rows = formatDataForTable(data as DeviceData[]);
    return search.hasTerm ? rows.filter((row) => search.matchesByDevice.has(row.deviceId)) : rows;
  }, [data, search.hasTerm, search.matchesByDevice]);

  // Metadata columns are just the customizable display in the table - which fields show up
  // there is controlled by Asset Configuration → Devices Table Columns. Search itself is
  // scoped separately, below, to every metadata key a device has (see metadataSearchIndexColumn).
  const columns = useMemo<ColumnDef<DeviceDataDisplay, any>[]>(() => {
    const metadataColumns = metadataFields.map(([key, field]) =>
      columnHelper.accessor((row) => formatMetadataValue(row.deviceMetadata[key]?.value, field), {
        id: `meta:${key}`,
        header: () => field.label,
      }),
    );
    // Hidden column whose value is every metadata value a device has, joined into one search
    // blob - not just the fields configured as table columns above - so the search bar reaches
    // fields that aren't shown (or aren't even part of the default type's required fields).
    const metadataSearchIndexColumn = columnHelper.accessor(
      (row) =>
        Object.values(row.deviceMetadata ?? {})
          .map((entry) => entry?.value)
          .filter((value) => value !== null && value !== undefined && value !== "")
          .map(String)
          .join(" "),
      { id: "metadataSearchIndex", header: () => null },
    );
    return [...baseColumns, ...metadataColumns, metadataSearchIndexColumn];
  }, [metadataFields]);

  const columnVisibility = useMemo(() => {
    const visibility: Record<string, boolean> = { iotEdgeRuntime: false, metadataSearchIndex: false };
    for (const [key] of metadataFields) {
      visibility[`meta:${key}`] = columnVisibilityOverrides[key] ?? defaultFieldVisible(key);
    }
    return visibility;
  }, [metadataFields, columnVisibilityOverrides]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      columnFilters,
      // the quick (in-browser) search is replaced by the API search while filter chips are selected
      globalFilter: search.active ? "" : globalFilter,
      columnVisibility,
    },
    defaultColumn: {
      size: 200,
      minSize: 50,
      maxSize: 500,
    },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
    // Search device IDs plus the full metadata index (every key a device has, regardless of
    // whether it's shown as a column) - not the per-field meta:* columns or Status/Edge Runtime.
    getColumnCanGlobalFilter: (column) => column.id === "deviceId" || column.id === "metadataSearchIndex",
  });

  const calculateDeviceOnlineFilter = () => {
    if (columnFilters.length === 1 && columnFilters[0].id === "onlineStatus") {
      return columnFilters[0].value === "online"
        ? DeviceOnlineFilterStatus.Online
        : DeviceOnlineFilterStatus.Offline;
    } else {
      return DeviceOnlineFilterStatus.All;
    }
  };
  const deviceOnlineFilter = useMemo(calculateDeviceOnlineFilter, [
    columnFilters,
  ]);

  const filterByStatusFromHeader = (
    deviceOnlineFilterStatus: DeviceOnlineFilterStatus,
  ) => {
    setGlobalFilter("");
    if (deviceOnlineFilterStatus === DeviceOnlineFilterStatus.All) {
      setColumnFilters([]);
    } else {
      setColumnFilters([
        {
          id: "iotEdgeRuntime",
          value:
            deviceOnlineFilterStatus === DeviceOnlineFilterStatus.Online
              ? "Connected"
              : "Disconnected",
        },
      ]);
    }
  };

  if (isLoading) return <LoadingState label="Loading devices..." />;

  if (isError)
    return <ErrorState title="Could not load the devices" message={getErrorMessage(error)} />;

  return (
    <div className="@container w-full p-4">
      <div className="hidden @2xl:block">
        <div className="overflow-hidden rounded-xl border bg-white shadow-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
            <h1 className="text-lg font-semibold tracking-tight">Devices</h1>
            <DevicesHeader
              deviceOnlineFilter={deviceOnlineFilter}
              setDeviceOnlineFilter={filterByStatusFromHeader}
            />
            {data && (
              <FilterDetails
                totalRows={data.length}
                filteredRows={table.getRowModel().rows.length}
                className="items-center"
              />
            )}
            <div className="ml-auto flex items-center gap-3">
              <DeviceSearchBar className="w-96 max-w-full" />
              <DeviceManageDialog />
            </div>
          </div>
          <DeviceTable table={table} search={search} />
        </div>
      </div>
      <div className="block @2xl:hidden">
        <DeviceCards
          table={table}
          globalFilter={globalFilter}
          data={tableData}
          search={search}
        />
      </div>
    </div>
  );
}

function DeviceTable({ table, search }: DeviceListProps & { search: DeviceSearchState }) {
  const navigate = useNavigate();
  const { deviceId: activeDeviceId } = useParams();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <>
      <Table>
        <TableHeader className="bg-slate-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-10 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
              <TableHead className="w-28" />
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={table.getVisibleLeafColumns().length + 1} className="py-12 text-center text-muted-foreground">
                {search.error
                  ? `Search failed: ${getErrorMessage(search.error)}`
                  : search.isFetching
                    ? "Searching..."
                    : "No devices match the current filter."}
              </TableCell>
            </TableRow>
          )}
          {table.getRowModel().rows.map((row) => {
            const id = row.original.deviceId;
            const matches = search.matchesByDevice.get(id) ?? [];
            const expanded = search.hasTerm && expandedIds.has(id);
            return (
              <Fragment key={row.id}>
                <TableRow
                  onClick={() => (search.hasTerm ? toggleExpanded(id) : navigate(`/devices/${id}`))}
                  aria-expanded={search.hasTerm ? expanded : undefined}
                  className={`group cursor-pointer ${activeDeviceId === id ? "bg-blue-50" : "hover:bg-slate-50"} ${search.isStale ? "opacity-60" : ""}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                  <TableCell className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetId(id);
                        }}
                        className="h-8 w-8 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                        title="Delete device"
                        aria-label={`Delete device ${id}`}
                      >
                        <TrashIcon />
                      </Button>
                      {search.hasTerm ? (
                        <>
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {matches.length} {matches.length === 1 ? "match" : "matches"}
                          </span>
                          <ChevronDownIcon
                            className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
                          />
                        </>
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {expanded && (
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableCell colSpan={table.getVisibleLeafColumns().length + 1} className="p-0">
                      <DeviceMatchList deviceId={id} matches={matches} term={search.term} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      {deleteTargetId && (
        <DeleteDeviceDialog
          deviceId={deleteTargetId}
          onClose={() => setDeleteTargetId(null)}
        />
      )}
    </>
  );
}
