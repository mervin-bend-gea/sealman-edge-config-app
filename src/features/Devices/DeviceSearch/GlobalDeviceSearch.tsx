import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import DebouncedInput from "@/components/Input/DebouncedInput";
import useDeviceStore from "../deviceStore";

/** Quick search across device IDs, metadata, endpoints and services. */
export default function GlobalDeviceSearch() {
  const globalFilter = useDeviceStore.use.globalFilter();
  const setGlobalFilter = useDeviceStore.use.setGlobalFilter();

  return (
    <div className="ml-auto flex w-full min-w-0 items-center gap-2 sm:w-[min(100%,380px)] sm:flex-none">
      <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 shadow-xs transition-shadow focus-within:ring-1 focus-within:ring-ring">
        <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <DebouncedInput
            type="text"
            name="device-search"
            value={globalFilter}
            onChange={(value) => setGlobalFilter(value as string)}
            placeholder="Search devices, endpoints, services"
            aria-label="Search devices, endpoints and services"
            maxLength={100}
            className="h-8 w-full min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </div>
    </div>
  );
}
