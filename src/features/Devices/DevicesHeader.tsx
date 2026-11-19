import { ReactNode, useEffect, useState } from "react";
import { CountryDeviceInfoDict } from "./DevicesByCountry";
import useGetDevices from "@/generated/edge-administration/hooks/useGetDevices/useGetDevices";

export interface DevicesHeaderProps {
  showGeolocationInfo?: boolean;
  missingGeolocationCount?: number;
  deviceOnlineFilter: DeviceOnlineFilterStatus;
  setDeviceOnlineFilter: (status: DeviceOnlineFilterStatus) => void;
  onSelectCountriesChanged?: (selectedCountryDevices: CountryDeviceInfoDict) => void;
  /** Shown after the status pills, in the same row (e.g. the search filter chips). */
  children?: ReactNode;
}

export enum DeviceOnlineFilterStatus {
  All = "ALL",
  Online = "ONLINE",
  Offline = "OFFLINE",
}

export default function DevicesHeader({
  deviceOnlineFilter,
  setDeviceOnlineFilter,
  children,
}: DevicesHeaderProps) {
  const { data, isSuccess } = useGetDevices();

  const [totalCount, setTotalCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (isSuccess) {
      setTotalCount(data.length);
      setOnlineCount(data.filter((x) => x.iotEdgeRuntime === "Connected").length);
    }
  }, [isSuccess, data]);

  if (!isSuccess) {
    return null;
  }

  return (
    <div className="flex flex-row flex-wrap items-center gap-2 p-2">
      <FilterPill
        label={`${totalCount} Devices`}
        active={deviceOnlineFilter === DeviceOnlineFilterStatus.All}
        activeClass="border-slate-900 bg-slate-900 text-white"
        onClick={() => setDeviceOnlineFilter(DeviceOnlineFilterStatus.All)}
      />
      <FilterPill
        label={`${onlineCount} Online`}
        dotClass="bg-green-500"
        active={deviceOnlineFilter === DeviceOnlineFilterStatus.Online}
        activeClass="border-green-500 bg-green-50 text-green-700"
        onClick={() =>
          setDeviceOnlineFilter(
            deviceOnlineFilter !== DeviceOnlineFilterStatus.Online
              ? DeviceOnlineFilterStatus.Online
              : DeviceOnlineFilterStatus.All
          )
        }
      />
      <FilterPill
        label={`${totalCount - onlineCount} Offline`}
        dotClass="bg-red-500"
        active={deviceOnlineFilter === DeviceOnlineFilterStatus.Offline}
        activeClass="border-red-500 bg-red-50 text-red-700"
        onClick={() =>
          setDeviceOnlineFilter(
            deviceOnlineFilter !== DeviceOnlineFilterStatus.Offline
              ? DeviceOnlineFilterStatus.Offline
              : DeviceOnlineFilterStatus.All
          )
        }
      />
      {/* {showGeolocationInfo ? (
        // <Badge color={BadgeColor.Gray}>{missingGeolocationCount} Missing Geolocation</Badge>
      ) : null} */}
      {children}
    </div>
  );
}

function FilterPill({
  label,
  dotClass,
  active,
  activeClass,
  onClick,
}: {
  label: string;
  dotClass?: string;
  active: boolean;
  activeClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? activeClass : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {dotClass && <span className={`h-2 w-2 rounded-full ${dotClass}`} />}
      {label}
    </button>
  );
}
