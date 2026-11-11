import SectionLayout from "@/layouts/SectionLayout";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";

const SETTINGS_TABS = [
  { label: "Seal-Agent", path: "seal-agent" },
  { label: "Azure IoT Edge", path: "azure-iot-edge" },
  { label: "SEALMAN EMS", path: "sealman-ems" },
  { label: "Container Registries", path: "container-registries" },
  { label: "SEMS Templates", path: "templates" },
];

export default function SettingsLayout() {
  const { hasPermission } = usePermissions({ permissionKey: PERMISSION_KEYS.EXTENSION_READ });
  const tabs = hasPermission ? [...SETTINGS_TABS, { label: "Extensions", path: "extensions" }] : SETTINGS_TABS;
  return <SectionLayout tabs={tabs} />;
}
