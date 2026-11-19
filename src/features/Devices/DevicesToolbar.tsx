import type { ReactNode } from "react";
import DevicesHeader, { DeviceOnlineFilterStatus } from "./DevicesHeader";
import SearchFilterChips from "./DeviceSearch/SearchFilterChips";
import GlobalDeviceSearch from "./DeviceSearch/GlobalDeviceSearch";

interface DevicesToolbarProps {
  title: string;
  description?: string;
  deviceOnlineFilter: DeviceOnlineFilterStatus;
  setDeviceOnlineFilter: (status: DeviceOnlineFilterStatus) => void;
  children?: ReactNode;
  showGeolocationInfo?: boolean;
  missingGeolocationCount?: number;
}

/** Shared dashboard/device-list heading and fleet search controls. */
export default function DevicesToolbar({
  title,
  description,
  deviceOnlineFilter,
  setDeviceOnlineFilter,
  children,
  showGeolocationInfo,
  missingGeolocationCount,
}: DevicesToolbarProps) {
  return (
    <section className="space-y-3 rounded-xl border bg-background px-4 py-3 shadow-xs" aria-label={`${title} controls`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center">
        <DevicesHeader
          showGeolocationInfo={showGeolocationInfo}
          missingGeolocationCount={missingGeolocationCount}
          deviceOnlineFilter={deviceOnlineFilter}
          setDeviceOnlineFilter={setDeviceOnlineFilter}
        >
          <SearchFilterChips className="flex flex-wrap items-center gap-2" />
        </DevicesHeader>
        </div>
        <GlobalDeviceSearch />
      </div>
    </section>
  );
}
