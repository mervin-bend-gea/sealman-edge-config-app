import useGetModuleTwinConfig from "@/generated/edge-administration/hooks/useGetModuleTwinConfig";
import { NetworkDiscoverTwinConfig } from "@/api/edgeConfig/networkDiscover/networkDiscoverInterfaces";
import { NETWORK_DISCOVER_MODULE_NAME } from "@/api/edgeConfig/moduleNames";
import { useEffect , useState } from "react";
import { useNetworkPageStore, useScanDefinitionStore, useTwinConfigStore } from "./stores";
import { NetworkMainLayout } from "@/features/Devices/Network/layouts";
import { loadNetworkMeta , isMetaLoaded } from "./api/networkMeta"

interface props {
  deviceId: string
}

export default function Page({ deviceId }: props) {
  const setDeviceId = useNetworkPageStore(s => s.setDeviceId)
  const setTwinConfigState = useTwinConfigStore(s => s.setTwinConfigState)
  const setScanDefinition = useScanDefinitionStore(s => s.setScanDefinition)
  const [metaReady, setMetaReady] = useState(isMetaLoaded());
  const [_metaError, setMetaError] = useState<string | null>(null);

  if (!deviceId) {
    throw Error("NO DEVICE ID")
  }

  setDeviceId(deviceId)

  // seal-app-net-discover is optional: without it assets are still manageable, only scan/online states are missing.
  const { data } = useGetModuleTwinConfig(deviceId, NETWORK_DISCOVER_MODULE_NAME)

  useEffect(() => {
  async function bootstrap() {
    try {
      if (!isMetaLoaded()) {
        await loadNetworkMeta();
      }
      setMetaReady(true);
    } catch (err) {
      setMetaError("Failed to load network configuration.");
      setMetaReady(true);
    }
  }

  bootstrap();
}, []);


useEffect(() => {
  if (!metaReady || !data) return;

  const typedData = data as unknown as NetworkDiscoverTwinConfig;

  setTwinConfigState(typedData);
  setScanDefinition(typedData.scanDefinition);
}, [metaReady, data]);

  useEffect(() => {
    return () => {
      useTwinConfigStore.setState(useTwinConfigStore.getInitialState())
      useScanDefinitionStore.setState(useScanDefinitionStore.getInitialState())
    }
  }, [])

  // Render immediately rather than blocking on the twin config / network meta fetches -
  // Overview (the default view) doesn't need either, and legacy views that do (the sidebar's
  // status switch, the endpoint sidebar's "Configure network scan" sheet, etc.) update
  // reactively once their data arrives.
  return <NetworkMainLayout />
}
