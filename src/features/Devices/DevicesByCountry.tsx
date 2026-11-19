import { Fragment, useEffect, useMemo, useState } from "react";
import Badge from "../../components/Typography/Badge";
import { Menu, Transition } from "@headlessui/react";
import { IndeterminateCheckbox } from "../../components/Input/FormElements";
import CountryFlag from "../../components/CountryFlag";
import { DeviceOnlineFilterStatus } from "./DevicesHeader";
import useGetDevices from "@/generated/edge-administration/hooks/useGetDevices/useGetDevices";
import { DeviceWithCountryData } from "@/generated/edge-administration/hooks/useGetDevices/useGetDevices.types";

export interface CountryDeviceInfo {
  countryCode: string;
  countryCodeAlpha2?: string;
  countryName?: string;
  countryRegion: string;
  continent: string;
  devices: number;
  selected: boolean;
  countryFilterStatus: DeviceOnlineFilterStatus;
}

export interface ContinentDeviceInfo {
  continent: string;
  countries: CountryDeviceInfo[];
  selected: boolean;
}

export interface CountryDeviceInfoDict {
  [key: string]: CountryDeviceInfo;
}

export interface RegionDeviceInfoDict {
  [key: string]: ContinentDeviceInfo;
}

interface DevicesByCountryProps {
  /** Refresh key is used to reset country filter from outside of component.
   * When different value is passed, filter will be reset.
   */
  refreshKey: number;
  onSelectChanged: (selectedCountryDevices: CountryDeviceInfoDict) => void;
}

export default function DevicesByCountry({ onSelectChanged, refreshKey }: DevicesByCountryProps) {
  const { data, isSuccess } = useGetDevices();
  const [countryCount, setCountryCount] = useState(0);
  const [continentDevices, setContinentDevices] = useState<ContinentDeviceInfo[]>([]);

  const [countryFilterStatus, setCountryFilterStatus] = useState(DeviceOnlineFilterStatus.All);
  const countryOnline =
    countryFilterStatus === DeviceOnlineFilterStatus.All || countryFilterStatus === DeviceOnlineFilterStatus.Online;
  const countryOffline =
    countryFilterStatus === DeviceOnlineFilterStatus.All || countryFilterStatus === DeviceOnlineFilterStatus.Offline;

  useEffect(() => {
    if (isSuccess) {
      const countryDeviceDict = data.reduce((dict: CountryDeviceInfoDict, x: DeviceWithCountryData) => {
        let countryCode = "UNASSIGNED";
        let countryName = "[UNASSIGNED]";

        if (x.countryCode) {
          countryCode = x.countryCode;
          countryName = x.countryName ?? "";
        }

        if (!dict[countryCode]) {
          dict[countryCode] = {
            countryCode,
            countryName,
            countryCodeAlpha2: x.countryCodeAlpha2,
            countryRegion: x.countryRegion ?? "Unassigned",
            continent: x.continent ?? "Unassigned",
            devices: 0,
            selected: true,
            countryFilterStatus: DeviceOnlineFilterStatus.All,
          };
        }
        dict[countryCode].devices += 1;
        return dict;
      }, {});

      const countryArray = Object.values(countryDeviceDict).sort((a, b) =>
        (a.countryName ?? "_").localeCompare(b.countryName ?? "_")
      );

      const regionDict = countryArray.reduce((dict: RegionDeviceInfoDict, x: CountryDeviceInfo) => {
        if (!dict[x.continent]) {
          dict[x.continent] = {
            continent: x.continent,
            countries: [],
            selected: true,
          };
        }
        dict[x.continent].countries.push(x);
        return dict;
      }, {});

      const regionArray = Object.values(regionDict).sort((a, b) =>
        (a.continent ?? "_").localeCompare(b.continent ?? "_")
      );

      setContinentDevices(regionArray);
      setCountryCount(countryArray.length);
      setCountryFilterStatus(DeviceOnlineFilterStatus.All);
    }
  }, [isSuccess, data, refreshKey]);

  const selectedCount = useMemo(() => {
    let selectedCount = 0;
    continentDevices.forEach((x) => {
      selectedCount += x.countries.filter((c) => c.selected).length;
    });
    return selectedCount;
  }, [continentDevices]);

  const raiseOnSelected = (continentDeviceList: ContinentDeviceInfo[]) => {
    onSelectChanged(
      continentDeviceList.reduce((dict: CountryDeviceInfoDict, x: ContinentDeviceInfo) => {
        x.countries.forEach((country) => {
          dict[country.countryCode] = country;
        });
        return dict;
      }, {})
    );
  };

  if (!isSuccess) {
    return null;
  }

  const toggleSelectAll = () => {
    const selected = selectedCount !== countryCount;
    const continentDeviceList = continentDevices.map((x) => ({
      ...x,
      countries: x.countries.map((c) => ({
        ...c,
        selected,
        countryFilterStatus: DeviceOnlineFilterStatus.All,
      })),
    }));
    setContinentDevices(continentDeviceList);
    setCountryFilterStatus(DeviceOnlineFilterStatus.All);
    raiseOnSelected(continentDeviceList);
  };

  const toggleSelectCountry = (countryCode: string) => {
    const continentDeviceList = continentDevices.map((x) => {
      return {
        ...x,
        countries: x.countries.map((c) => {
          if (c.countryCode !== countryCode) {
            return c;
          }
          return {
            ...c,
            selected: !c.selected,
            countryFilterStatus,
          };
        }),
      };
    });
    setContinentDevices(continentDeviceList);
    raiseOnSelected(continentDeviceList);
  };

  const toggleSelectContinent = (continent: string) => {
    const continentDeviceList = continentDevices.map((x) => {
      if (x.continent !== continent) {
        return x;
      }
      const selected = !x.countries.every((c) => c.selected);
      return {
        ...x,
        countries: x.countries.map((c) => ({
          ...c,
          selected,
          countryFilterStatus,
        })),
      };
    });

    setContinentDevices(continentDeviceList);
    raiseOnSelected(continentDeviceList);
  };

  const toggleCountryFilterStatus = (status: DeviceOnlineFilterStatus) => {
    let newCountryFilterStatus = DeviceOnlineFilterStatus.All;

    if (status === DeviceOnlineFilterStatus.Online) {
      switch (countryFilterStatus) {
        case DeviceOnlineFilterStatus.All:
        case DeviceOnlineFilterStatus.Online:
          newCountryFilterStatus = DeviceOnlineFilterStatus.Offline;
          break;
        case DeviceOnlineFilterStatus.Offline:
          newCountryFilterStatus = DeviceOnlineFilterStatus.All;
          break;
      }
    } else if (status === DeviceOnlineFilterStatus.Offline) {
      switch (countryFilterStatus) {
        case DeviceOnlineFilterStatus.All:
        case DeviceOnlineFilterStatus.Offline:
          newCountryFilterStatus = DeviceOnlineFilterStatus.Online;
          break;
        case DeviceOnlineFilterStatus.Online:
          newCountryFilterStatus = DeviceOnlineFilterStatus.All;
          break;
      }
    }

    const continentDeviceList = continentDevices.map((x) => {
      return {
        ...x,
        countries: x.countries.map((c) => ({
          ...c,
          countryFilterStatus: newCountryFilterStatus,
        })),
      };
    });

    setCountryFilterStatus(newCountryFilterStatus);
    setContinentDevices(continentDeviceList);
    raiseOnSelected(continentDeviceList);
  };

  return (
    <Menu as="div" className="relative inline-block">
      {/* <Badge color={BadgeColor.Yellow}>
        <Menu.Button>Countries {selectedCount !== 0 ? <>({selectedCount})</> : null}</Menu.Button>
      </Badge> */}
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items
          className="z-index-above-map absolute left-0 mt-1 text-sm origin-top-left rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          style={{ width: "min(750px, calc(100vw - 1rem))" }}
        >
          <div className="px-2 pb-2 flex flex-row gap-2">
            <div>
              <IndeterminateCheckbox
                checked={selectedCount === countryCount}
                indeterminate={selectedCount > 0}
                onChange={toggleSelectAll}
              />{" "}
              Select all
            </div>
            {selectedCount > 0 && selectedCount < countryCount ? (
              <>
                <div>
                  <IndeterminateCheckbox
                    checked={countryOnline}
                    onChange={() => toggleCountryFilterStatus(DeviceOnlineFilterStatus.Online)}
                  />{" "}
                  Online
                </div>
                <div>
                  <IndeterminateCheckbox
                    checked={countryOffline}
                    onChange={() => toggleCountryFilterStatus(DeviceOnlineFilterStatus.Offline)}
                  />{" "}
                  Offline
                </div>
              </>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
          {continentDevices.map((c) => (
            <div key={c.continent}>
              <div
                className="px-2 font-bold text-blue-700 cursor-pointer"
                onClick={() => toggleSelectContinent(c.continent)}
              >
                {c.continent}
              </div>
              <div className="flex flex-wrap p-2">
                {c.countries.map((country) => (
                  <div key={country.countryCode} className="cursor-pointer w-full sm:w-1/2 md:w-1/3 flex flex-row">
                    <IndeterminateCheckbox
                      className="my-2"
                      checked={country.selected}
                      onChange={() => toggleSelectCountry(country.countryCode)}
                    />
                    <div className="px-2 py-1 cursor-pointer" onClick={() => toggleSelectCountry(country.countryCode)}>
                      <CountryFlag alpha2Code={country.countryCodeAlpha2 ?? ""} name={country.countryName} />{" "}
                      {country.countryName} <Badge>{country.devices}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
