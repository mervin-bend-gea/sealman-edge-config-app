import "leaflet/dist/leaflet.css";
import { MapContainer } from "react-leaflet";
import { TileLayer } from "react-leaflet";
import { Marker } from "react-leaflet";
import { Popup, Tooltip as LeafletTooltip } from "react-leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import L from "leaflet";
import { edgeConfigApi } from "../api/edgeConfig/edgeConfigApi";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import Badge from "../components/Typography/Badge";
import { BadgeColor } from "../components/Typography/Badge";
import { DeviceOnlineFilterStatus } from "../features/Devices/DevicesHeader";
import DevicesToolbar from "../features/Devices/DevicesToolbar";
import useDeviceSearch from "../features/Devices/DeviceSearch/useDeviceSearch";
import useDeviceStore from "../features/Devices/deviceStore";
import DevicesByCountry, {
  CountryDeviceInfoDict,
} from "../features/Devices/DevicesByCountry";
import { useEffect, useState } from "react";
import FilterDetails from "../features/Devices/FilterDetails";
import useGetDevices from "@/generated/edge-administration/hooks/useGetDevices/useGetDevices";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage } from "@/lib/errors";

const greenIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
});
L.Marker.prototype.options.icon = DefaultIcon;

const initialPosition: any = [50.861483790914974, 10.332054985593048];

interface DeviceMarker {
  lat: number;
  lon: number;
  name: string;
  status: string;
  customer?: string;
  description?: string;
  metadata: Array<[string, string]>;
}

const deviceShouldBeDisplayed = (
  filterStatus: DeviceOnlineFilterStatus,
  iotEdgeRuntime: string,
  countryCode: string,
  countriesSelectedDict?: CountryDeviceInfoDict,
) => {
  let shouldBeDisplayed = false;
  if (filterStatus === DeviceOnlineFilterStatus.All) {
    shouldBeDisplayed = true;
  } else {
    shouldBeDisplayed =
      (filterStatus === DeviceOnlineFilterStatus.Online &&
        iotEdgeRuntime === "Connected") ||
      (filterStatus === DeviceOnlineFilterStatus.Offline &&
        iotEdgeRuntime !== "Connected");
  }

  if (!shouldBeDisplayed) {
    return false;
  }

  if (countriesSelectedDict) {
    const country = countriesSelectedDict[countryCode];
    shouldBeDisplayed = Boolean(country?.selected) &&
      (country?.countryFilterStatus === DeviceOnlineFilterStatus.All ||
        (country?.countryFilterStatus === DeviceOnlineFilterStatus.Online && iotEdgeRuntime === "Connected") ||
        (country?.countryFilterStatus === DeviceOnlineFilterStatus.Offline && iotEdgeRuntime !== "Connected"));
  }

  return shouldBeDisplayed;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const easEdgeDevices = useGetDevices();
  const search = useDeviceSearch();
  const clearSearchFilters = useDeviceStore.use.clearSearchFilters();
  const setGlobalFilter = useDeviceStore.use.setGlobalFilter();

  const [deviceOnlineFilter, setDeviceOnlineFilter] = useState(
    DeviceOnlineFilterStatus.All,
  );
  const [markers, setMarkers] = useState<DeviceMarker[]>([]);
  const [countriesSelectedDict, setCountriesSelectedDict] = useState<
    CountryDeviceInfoDict | undefined
  >(undefined);

  const [missingGeolocationCount, setMissingGeolocationCount] = useState(0);
  const [countrySelectRefreshKey, setCountrySelectRefreshKey] = useState(0);

  useEffect(() => {
    const markersArray: DeviceMarker[] = [];

    let missingGeoLocation = 0;

    if (easEdgeDevices.data) {
      easEdgeDevices.data.forEach((device) => {
        if (!device.deviceMetadata.geoLocation?.value) {
          missingGeoLocation++;
        }

        const countryCodeValue = device.deviceMetadata.countryCode?.value;

        const countryCode =
          typeof countryCodeValue === "string"
            ? countryCodeValue
            : "UNASSIGNED";

        const searchMatches = !search.active || search.matchesByDevice.has(device.deviceId);
        const displayDevice = deviceShouldBeDisplayed(
          deviceOnlineFilter,
          device.iotEdgeRuntime,
          countryCode,
          countriesSelectedDict,
        ) && searchMatches;

        const geoValue = device.deviceMetadata.geoLocation?.value as string;

        const [lat, lon] = geoValue
          ? geoValue.split(",").map((v) => v.trim())
          : [];

        const customerValue = device.deviceMetadata.customer?.value;

        if (lat && lon && displayDevice) {
          const latitude = Number(lat);
          const longitude = Number(lon);
          if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            missingGeoLocation++;
          } else {
            markersArray.push({
              lat: latitude,
              lon: longitude,
              name: device.deviceId,
              status: device.iotEdgeRuntime,
              customer:
                typeof customerValue === "string" ? customerValue : undefined,
              // The type for value from the API isn't string, but in practice it should always be a string or undefined, so we check the type before assigning to avoid runtime errors
              description: typeof device.deviceMetadata.description?.value === "string" ? device.deviceMetadata.description?.value : undefined,
              metadata: Object.entries(device.deviceMetadata ?? {})
                .filter(([, entry]) => entry?.value !== null && entry?.value !== undefined && entry?.value !== "")
                .map(([key, entry]): [string, string] => [key, String(entry?.value)]),
            });
          }
        }
      });
    }

    setMarkers(markersArray);
    setMissingGeolocationCount(missingGeoLocation);
  }, [easEdgeDevices?.data, deviceOnlineFilter, countriesSelectedDict, search.active, search.matchesByDevice]);

  if (easEdgeDevices.isLoading)
    return <LoadingState label="Loading dashboard..." className="h-full" />;

  if (easEdgeDevices.isError) {
    console.error(easEdgeDevices.error);
    return (
      <ErrorState
        title="Could not load the dashboard"
        message={getErrorMessage(easEdgeDevices.error)}
        onRetry={() => easEdgeDevices.refetch()}
      />
    );
  }

  const clearTableFilter = () => {
    setDeviceOnlineFilter(DeviceOnlineFilterStatus.All);
    setCountriesSelectedDict(undefined);
    clearSearchFilters();
    setGlobalFilter("");
    setCountrySelectRefreshKey((key) => key + 1);
  };

  return (
    <div className="h-full space-y-4 overflow-y-auto p-6">
      <DevicesToolbar
        title="Dashboard"
        showGeolocationInfo
        missingGeolocationCount={missingGeolocationCount}
        deviceOnlineFilter={deviceOnlineFilter}
        setDeviceOnlineFilter={(value) => {
          setDeviceOnlineFilter(value);
          setCountriesSelectedDict(undefined);
          setCountrySelectRefreshKey((key) => key + 1);
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <DevicesByCountry
            onSelectChanged={(countriesDict) => setCountriesSelectedDict(countriesDict)}
            refreshKey={countrySelectRefreshKey}
          />
          <FilterDetails
            totalRows={easEdgeDevices.data?.length ?? 0}
            filteredRows={markers.length}
            clearTableFilter={clearTableFilter}
          />
        </div>
      </DevicesToolbar>
      <div className="overflow-hidden rounded-lg border shadow-xs">
      <MapContainer center={initialPosition} zoom={5} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((item) => (
          <Marker
            key={item.name}
            icon={item.status === "Connected" ? greenIcon : redIcon}
            position={[item.lat, item.lon]}
          >
            <LeafletTooltip direction="top" sticky opacity={0.98}>
              <div className="min-w-40 space-y-1 text-xs">
                <button type="button" className="font-semibold text-blue-700 underline underline-offset-2" onClick={() => navigate(`/devices/${item.name}`)}>Device ID: {item.name}</button>
                <div className="flex items-center gap-1.5 font-medium">
                  <span className={`h-2 w-2 rounded-full ${item.status === "Connected" ? "bg-green-500" : "bg-red-500"}`} />
                  {item.status === "Connected" ? "Online" : "Offline"}
                </div>
                {item.metadata.slice(0, 6).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[auto_1fr] gap-2">
                    <span className="text-slate-500">{key}:</span><span className="break-all font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </LeafletTooltip>
            <Popup>
              <div className="space-y-2">
                <div><strong>Device ID:</strong> {item.name}</div>
                <div><strong>Status:</strong> {item.status === "Connected" ? "Online" : "Offline"}</div>
                {item.description && <div><strong>Description:</strong> {item.description}</div>}
                {item.customer && <div><strong>Customer:</strong> {item.customer}</div>}
                <button type="button" className="text-blue-700 underline" onClick={() => navigate(`/devices/${item.name}`)}>Open device</button>
              </div>
              <ConnectionStatusMini deviceId={item.name}></ConnectionStatusMini>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      </div>
    </div>
  );
}

interface ConnectionStatusData {
  iotEdgeRuntime: string;
  iotHub: string;
  sems: string;
  vpn: string;
}

export function ConnectionStatusMini({ deviceId }: { deviceId: string }) {
  const { isLoading, isError, data, error } = useQuery<
    ConnectionStatusData,
    Error
  >({
    queryKey: ["getConnectionStatus", deviceId],
    queryFn: () => edgeConfigApi.getConnectionStatus(deviceId),
  });

  if (isLoading)
    return (
      <div className="p-2 rounded-sm ring-1 ring-inset animate-pulse ring-gray-200">
        <div className="h-[40px] bg-slate-300 rounded-sm" />
      </div>
    );

  if (isError) return <div className="text-sm text-destructive">Could not load the status: {getErrorMessage(error)}</div>;

  if (!data) return null;

  return (
    <div>
      <Badge
        color={
          data.iotEdgeRuntime === "Connected"
            ? BadgeColor.Green
            : BadgeColor.Red
        }
      >
        Runtime
      </Badge>
      <Badge
        color={data.iotHub === "Connected" ? BadgeColor.Green : BadgeColor.Red}
      >
        IoTHub
      </Badge>
      <Badge
        color={data.sems === "Connected" ? BadgeColor.Green : BadgeColor.Red}
      >
        SmartEMS
      </Badge>
      {data.vpn !== undefined && (
        <Badge
          color={data.vpn === "Connected" ? BadgeColor.Green : BadgeColor.Red}
        >
          VPN
        </Badge>
      )}
    </div>
  );
}
