import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import DeviceList from "./features/Devices/DeviceList";
import MainLayout from "./layouts/MainLayout";
import { ToastContainer } from "react-toastify";
import { queryClient } from "./config/queryConfig";
import Dashboard from "./pages/Dashboard";

import DeviceDetail from "./features/Devices/DeviceDetail";
import ComingNextPage from "./pages/ComingNextPage";
import ErrorFallback from "./pages/ErrorFallback";
import PageNotFound from "./pages/PageNotFound";
import Version from "./pages/Version";
import { QueryClientProvider } from "@tanstack/react-query";
// import { SmartEmsSettings } from "@/features/Devices/Network/smart_ems/pages/settings.tsx";
import SettingsLayout from "./pages/settings/SettingsLayout";
import PlatformTypesSettings from "./pages/settings/PlatformTypesSettings";
import PageTitle from "./components/Typography/PageTitle";
import TemplateGroupList from "./features/ModuleConfigTemplates/TemplateGroupList";
import TemplateGroupPage from "./features/ModuleConfigTemplates/TemplateGroupPage";
import TemplatePage from "./features/ModuleConfigTemplates/TemplatePage";
import TemplatesLayout from "./features/ModuleConfigTemplates/TemplatesLayout";
import SealAgentSettings from "./pages/settings/SealAgentSettings";
import AppearanceSettings from "./pages/settings/AppearanceSettings";
import PlatformFunctionsSettings from "./pages/settings/PlatformFunctionsSettings";
import PresetTemplateVariablesSettings from "./pages/settings/PresetTemplateVariablesSettings";
import { DeviceTemplateVariablesSection, IOTEDGE_AGENT_VARIABLES, IOTEDGE_REGISTRY_VARIABLES, SEALMAN_EMS_VARIABLES } from "./pages/settings/TemplatesSettings";
import DeploymentsLayout from "./pages/deployments/DeploymentsLayout";
import AssetConfigurationLayout from "./pages/assetConfiguration/AssetConfigurationLayout";
import AssetConfigurationAccess from "./pages/assetConfiguration/AssetConfigurationAccess";
import { SmartEmsAuthCallback } from "./features/Devices/Network/smart_ems/pages/AuthCallback";
import ExtensionsSettings from "./features/Extensions/ExtensionsSettings";
import ExtensionDetail from "./features/Extensions/ExtensionDetail";
import RegisterExtensionPage from "./features/Extensions/RegisterExtensionPage";
import EditExtensionPage from "./features/Extensions/EditExtensionPage";
import ExtensionAccess from "./features/Extensions/ExtensionAccess";
import { PERMISSION_KEYS } from "./features/authorization/permissions/permission-keys";
import RoutedExtensionPanel from "./features/Extensions/outlets/RoutedExtensionPanel";
import { useOutletUser } from "./features/Extensions/outlets/useOutletUser";
import { useAuth } from "./auth";
import { useEffect } from "react";
import { NewUserCheck } from "./components/NewUserCheck";
import Authorization from "./features/authorization/Authorization";
import Teams from "./features/authorization/Teams";
import Roles from "./features/authorization/Roles";
import Scopes from "./features/authorization/Scopes";
import Users from "./features/authorization/Users";
import UserProfile from "./pages/UserProfile";

function ExtensionPage() {
  const user = useOutletUser();
  return <RoutedExtensionPanel target="global" placement="page" context={{ user }} />;
}

export default function App() {
  const auth = useAuth();

  // Auto sign-in for Keycloak (similar to useAutoSignin)
  useEffect(() => {
    if (!auth.isAuthenticated && !auth.isLoading) {
      auth.signIn();
    }
  }, [auth, auth.isAuthenticated, auth.isLoading]);

  // Do not mount routes (or their react-query hooks) until OIDC has a user.
  // Otherwise axios/openapi middleware call getAccessToken() while sessionStorage
  // is still empty, throw "User is not authenticated", and the UI treats the
  // backend as unauthenticated even after login completes.
  if (auth.isLoading || !auth.isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">
        {auth.isLoading ? "Loading..." : "Redirecting to sign in..."}
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} errorElement={<ErrorFallback />} />
            <Route path="devices" element={<Outlet />}>
              <Route
                index
                element={
                  <div className="h-full overflow-y-auto">
                    <DeviceList />
                  </div>
                }
              />
              <Route path=":deviceId/*" element={<DeviceDetail />} />
            </Route>

            <Route path="module-templates" element={<TemplatesLayout />}>
              <Route index element={<TemplateGroupList />} />
              <Route path="new" element={<TemplateGroupPage />} />
              <Route path=":groupId" element={<TemplateGroupPage />} />
              <Route path=":groupId/edit" element={<TemplateGroupPage mode="edit" />} />
              <Route path=":groupId/templates/new" element={<TemplatePage />} />
              <Route path=":groupId/templates/:templateId" element={<TemplatePage />} />
            </Route>

            <Route element={<AssetConfigurationAccess />}>
              <Route path="platform-types" element={<AssetConfigurationLayout />}>
                <Route index element={<Navigate to="asset-types" replace />} />
                <Route path="asset-types" element={<PlatformTypesSettings />} />
                <Route path="templates" element={<Navigate to="/settings/sealman-ems" replace />} />
              </Route>
            </Route>
            <Route path="deployments" element={<DeploymentsLayout />}>
              <Route index element={<Navigate to="management" replace />} />
              <Route
                path="management"
                element={
                  <ComingNextPage
                    title="Deployment Management"
                    description="Managing deployments across your whole fleet is the next feature on our roadmap and will arrive in an upcoming release."
                  />
                }
              />
              <Route
                path="operations"
                element={
                  <ComingNextPage
                    title="Deployment Operations"
                    description="Running and tracking deployment operations across your fleet is coming soon and will arrive in an upcoming release."
                  />
                }
              />
            </Route>
            <Route path="fleet-configuration/*" element={<Navigate to="/deployments" replace />} />
            <Route
              path="monitoring/*"
              element={
                <ComingNextPage
                  title="Monitoring"
                  description="A central log of what happened on your platform and fleet is coming soon and will arrive in an upcoming release."
                />
              }
            />
            <Route path="activity/*" element={<Navigate to="/monitoring" replace />} />

            <Route path="authorization" element={<Authorization />}>
              <Route index element={<Navigate to="teams" replace />} />
              <Route path="teams" element={<Teams />} />
              <Route path="roles" element={<Roles />} />
              <Route path="scopes" element={<Scopes />} />
              <Route path="users" element={<Users />} />
            </Route>

            <Route path="settings/smartems" element={<SmartEmsAuthCallback />} />
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="seal-agent" replace />} />
              <Route path="platform-types" element={<Navigate to="/platform-types/asset-types" replace />} />
              <Route path="seal-agent" element={<SealAgentSettings />} />
              <Route path="appearance" element={<AppearanceSettings />} />
              <Route path="platform-functions" element={<PlatformFunctionsSettings />} />
              <Route
                path="azure-iot-edge"
                element={
                  <PresetTemplateVariablesSettings
                    title="Azure IoT Edge"
                    description="Template variables used to provision the Azure IoT Edge runtime on devices. Empty fields fall back to the template default."
                    sections={[
                      {
                        title: "Container Registry",
                        description: "Registry from which the IoT Edge daemon pulls its containers.",
                        variables: IOTEDGE_REGISTRY_VARIABLES,
                      },
                      {
                        title: "Edge Agent",
                        description: "Image of the IoT Edge agent started by the IoT Edge daemon.",
                        variables: IOTEDGE_AGENT_VARIABLES,
                      },
                    ]}
                  />
                }
              />
              <Route
                path="sealman-ems"
                element={
                  <PresetTemplateVariablesSettings
                    title="SEMS"
                    description="Template variables for the connection of devices to the SEALMAN Edge Management System. Empty fields fall back to the template default."
                    sections={[{ title: "Connection", variables: SEALMAN_EMS_VARIABLES }]}
                  >
                    <div className="space-y-6">
                      <PageTitle
                        title="Variables"
                        description="Additional template variables applied to all devices."
                      />
                      <DeviceTemplateVariablesSection />
                    </div>
                  </PresetTemplateVariablesSettings>
                }
              />
              <Route path="templates" element={<Navigate to="/settings/sealman-ems" replace />} />
              <Route path="module-templates" element={<Navigate to="/module-templates" replace />} />
              <Route path="extensions" element={<ExtensionAccess />}>
                <Route index element={<ExtensionsSettings />} />
                <Route element={<ExtensionAccess permissionKey={PERMISSION_KEYS.EXTENSION_REGISTER} />}>
                  <Route path="new" element={<RegisterExtensionPage />} />
                </Route>
                <Route path=":name" element={<Outlet />}>
                  <Route index element={<ExtensionDetail />} />
                  <Route element={<ExtensionAccess permissionKey={PERMISSION_KEYS.EXTENSION_REGISTER} />}>
                    <Route path="edit" element={<EditExtensionPage />} />
                  </Route>
                </Route>
              </Route>
              {/* <Route path="smartems" element={<SmartEmsSettings />} /> */}
            </Route>
            <Route path="x/:ext/:path/*" element={<ExtensionPage />} />
            <Route path="user/profile" element={<UserProfile />} />
            <Route path="version" element={<Version />} />
            <Route path="*" element={<PageNotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <NewUserCheck />
      <ToastContainer position="top-right" theme="light" autoClose={5000} newestOnTop pauseOnFocusLoss={false} />
    </QueryClientProvider>
  );
}
