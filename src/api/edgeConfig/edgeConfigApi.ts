import axios, { AxiosError } from "axios";
import { NetworkScanData } from "./networkDiscover/networkDiscoverInterfaces";
import { getAccessToken } from "@/auth";
import { CMD_PROXY_MODULE_NAME, NETWORK_DISCOVER_MODULE_NAME } from "./moduleNames";

export const edgeConfigApiInstance = axios.create({
  baseURL: `${import.meta.env.VITE_API_URI}`,
});


edgeConfigApiInstance.interceptors.request.use(async function (config: any) {
  const isCypress = window.Cypress != undefined;
  
  if (isCypress) {
    return config;
  }
  
  try {
    const accessToken = await getAccessToken();
    config.headers["Authorization"] = `Bearer ${accessToken}`;
  } catch (error) {
    console.error("Failed to acquire token:", error);
    throw new Error("User is not authenticated");
  }
  return config;
}, undefined);


export interface DirectMethodResponse<T> {
  status: number,
  payload: T
}

export interface DirectMethodRequest {
  methodName: string,
  methodPayload: any
}

/*
* This function unwraps the direct method responses, into AxiosErrors
* you can use it when handling direct methods
*/
function handleDirectMethodResponse(response: DirectMethodResponse<any>) {
  if (response.status >= 400) {
    throw new AxiosError(response.payload, response.status.toString());
  } else {
    return response;
  }
}

const getDevices = async () => {
  const { data } = await edgeConfigApiInstance.get('/devices');
  return data;
}

const getDevice = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/device?device=${deviceId}`);
  return data;
}

const getSmartEmsInfo = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/smartems/info`);
  return data;
}

const putDeploymentTag = async (deviceId: string | undefined, deploymentTag: string) => {
  const { data } = await edgeConfigApiInstance.put(`/${deviceId}/deployment`, { deployment: deploymentTag });
  return data;
}

const getSmartEmsStatus = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/smartems/status`);
  return data;
}

const getModules = async (deviceId: string | undefined, signal?: AbortSignal) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/modules`, { signal });
  return data;
}

const getConfigStatus = async (deviceId: string | undefined, payload: { modules?: string[] }, signal?: AbortSignal) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/config/status`, payload, { signal });
  return data;
}

const getSmartEmsConfigLan = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/smartems/config/lan`);
  return data;
}

const getSmartEmsConfigExport = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/smartems/config/export`);
  return data;
}

const postSmartEmsConfigLan = async (deviceId: string | undefined, payload: any) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/smartems/configure/lan`, payload);
  return data;
}

const scanNetwork = async (deviceId: string | undefined, payload: any) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/${NETWORK_DISCOVER_MODULE_NAME}/methods`, payload);
  return handleDirectMethodResponse(data);
}

const getPeriodicNetworkScanResult = async (deviceId: string) => {
  const { data } = await edgeConfigApiInstance.get<NetworkScanData>(`/${deviceId}/network/topology`)
  return data
}

const nmShow = async (deviceId: string | undefined, payload: any) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/${CMD_PROXY_MODULE_NAME}/methods`, payload);
  return handleDirectMethodResponse(data);
}

const getTwinConfig = async (deviceId: string | undefined, moduleName: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/twin/config/${moduleName}`)
  return data;
}

const postTwinConfig = async (deviceId: string | undefined, moduleName: string | undefined, payload: any) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/twin/config/${moduleName}`, payload)
  return data;
}

const invokeDirectMethod = async (deviceId: string | undefined, module: string, payload: DirectMethodRequest) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/${module}/methods`, payload);
  return handleDirectMethodResponse(data);
}

const getDeployments = async () => {
  const { data } = await edgeConfigApiInstance.get('/deployments');
  return data;
}

const getDeploymentStatus = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/deployment/status`);
  return data;
}

const getConnectionStatus = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/connection/status`);
  return data;
}

const getCmdLanIpConfig = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/cmd/lan/ip/config`);
  return data;
}

const postDeviceCmdSmartemsCheck = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/cmd/smartems/check`);
  return data;
}

const getDeviceCmdStatus = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/cmd/status`);
  return data;
}

const getDeviceCmdConfigShow = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/cmd/config/show`);
  return data;
}

const getDeviceCmdNmConfig = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/cmd/nm/config`);
  return data;
}

const postDeviceCmdLanConfig = async (deviceId: string | undefined, payload: any) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/cmd/lan/config`, payload);
  return data;
}

const getDeviceCellularConfig = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.get(`/${deviceId}/smartems/config/cellular`);
  return data;
}

const postDeviceCellularConfig = async (deviceId: string | undefined, payload: any) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/smartems/config/cellular`, payload);
  return data;
}

const postDeviceNetworkDiscover = async (deviceId: string | undefined, payload: any) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/network/discover`, payload);
  return data;
}

const postWebFtpWriteFile = async (deviceId: string | undefined, payload: any) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/webftp/writeFile`, payload, {headers: {'Content-Type': 'multipart/form-data'}})
  return data;
}

const postInfluxBucketCreate = async (deviceId: string | undefined) => {
  const { data } = await edgeConfigApiInstance.post(`/${deviceId}/influx/bucket/create`);
  return data;
}

const getDeviceManagementPermissions = async (signal?: AbortSignal): Promise<{ can_create: boolean; deletable_device_ids: string[] }> => {
  const { data } = await edgeConfigApiInstance.get('/auth/permissions/device-management', { signal });
  return data;
}

const getPermissions = async (deviceId: string | undefined, signal?: AbortSignal) => {
  const resourceType = deviceId ? "device" : "platform";
  const url = `/auth/permissions/${resourceType}`;
  const params = deviceId ? { device_id: deviceId } : {};
  const { data } = await edgeConfigApiInstance.get(url, { params, signal });
  return data;
}

const getRoles = async () => {
  const { data } = await edgeConfigApiInstance.get('/auth/roles');
  return data;
}

const getRoleDetails = async (roleId: string) => {
  const { data } = await edgeConfigApiInstance.get(`/auth/roles/${roleId}`);
  return data;
}

const deleteRole = async (roleId: string) => {
  await edgeConfigApiInstance.delete(`/auth/roles/${roleId}`);
}

const createRole = async (payload: { name: string; description: string | null; actions: string[] }) => {
  const { data } = await edgeConfigApiInstance.post('/auth/roles', payload);
  return data;
}

const updateRole = async (roleId: string, payload: { name: string; description: string | null; actions: string[] }) => {
  const { data } = await edgeConfigApiInstance.put(`/auth/roles/${roleId}`, payload);
  return data;
}

const getActions = async () => {
  const { data } = await edgeConfigApiInstance.get('/auth/actions');
  return data;
}

const getScopes = async () => {
  const { data } = await edgeConfigApiInstance.get('/auth/scopes');
  return data;
}

const getScopeDetails = async (scopeId: string) => {
  const { data } = await edgeConfigApiInstance.get(`/auth/scopes/${scopeId}`);
  return data;
}

const deleteScope = async (scopeId: string) => {
  await edgeConfigApiInstance.delete(`/auth/scopes/${scopeId}`);
}

const getTeams = async () => {
  const { data } = await edgeConfigApiInstance.get('/auth/teams');
  return data;
}

const getTeamDetails = async (teamId: string) => {
  const { data } = await edgeConfigApiInstance.get(`/auth/teams/${teamId}`);
  return data;
}

const deleteTeam = async (teamId: string) => {
  await edgeConfigApiInstance.delete(`/auth/teams/${teamId}`);
}

const createTeam = async (payload: { name: string; scope_id: string | null; role_ids: string[] }) => {
  const { data } = await edgeConfigApiInstance.post('/auth/teams', payload);
  return data;
}

const updateTeam = async (teamId: string, payload: { name: string; scope_id: string | null; role_ids: string[] }) => {
  const { data } = await edgeConfigApiInstance.put(`/auth/teams/${teamId}`, payload);
  return data;
}
const getUsers = async () => {
  const { data } = await edgeConfigApiInstance.get('/auth/users');
  return data;
}

const getCurrentUser = async () => {
  const { data } = await edgeConfigApiInstance.get('/auth/user');
  return data;
}

const getCurrentUserTeams = async () => {
  const { data } = await edgeConfigApiInstance.get('/auth/user/teams');
  return data;
}

const addUserToTeam = async (teamId: string, userId: string) => {
  const { data } = await edgeConfigApiInstance.post(`/auth/teams/${teamId}/users`, { user_id: userId });
  return data;
}

const removeUserFromTeam = async (teamId: string, userId: string) => {
  await edgeConfigApiInstance.delete(`/auth/teams/${teamId}/users/${userId}`);
}

const getUserTeamAssignments = async (userId: string) => {
  const { data } = await edgeConfigApiInstance.get(`/auth/users/${userId}/teams`);
  return data;
}
const createScope = async (
  payload: { name: string; description: string | null; attr: Record<string, unknown>; access_rule: "ALL" | "ANY" },
) => {
  const { data } = await edgeConfigApiInstance.post('/auth/scopes', payload);
  return data;
}

const updateScope = async (
  scopeId: string,
  payload: { name: string; description: string | null; attr: Record<string, unknown>; access_rule: "ALL" | "ANY" },
) => {
  const { data } = await edgeConfigApiInstance.put(`/auth/scopes/${scopeId}`, payload);
  return data;
}

const getEventData = async (deviceId: string = "*") => {
  const { data } = await edgeConfigApiInstance.get(`/eventData?device_id=${deviceId}`);
  return data;
}

const getAvailableTemplates = async () => {
  const { data } = await edgeConfigApiInstance.get('/platform/devices/available-templates');
  return data;
}

const saveSelectedTemplates = async (templates: string[]) => {
  const { data } = await edgeConfigApiInstance.post('/platform/devices/selected-templates', { templates });
  return data;
}

const getDevicesWithMetaKey = async (key: string): Promise<string[]> => {
  const { data } = await edgeConfigApiInstance.get<{ deviceId: string }[]>('/devices', {
    params: { meta: { [key]: "" } },
  });
  return data.map((device) => device.deviceId);
}

const createDevice = async (
  deviceId: string,
  authType: string,
  typeId: string,
  meta?: Record<string, unknown>,
  registrationId?: string,
) => {
  const body: Record<string, unknown> = { authType, typeId };
  if (meta && Object.keys(meta).length > 0) {
    body.meta = meta;
  }
  if (registrationId) {
    body.registration_id_generated = registrationId;
  }
  const { data } = await edgeConfigApiInstance.put(`/devices/${deviceId}`, body);
  return data;
};

const deleteDevice = async (deviceId: string) => {
  const { data } = await edgeConfigApiInstance.delete(`/devices/${deviceId}`);
  return data;
};

const getDeviceTemplateVariables = async (): Promise<Record<string, string>> => {
  const { data } = await edgeConfigApiInstance.get('/platform/device-template-variables');
  return data.variables;
};

const setDeviceTemplateVariable = async (name: string, value: string): Promise<Record<string, string>> => {
  const { data } = await edgeConfigApiInstance.put(`/platform/device-template-variables/${encodeURIComponent(name)}`, { value });
  return data.variables;
};

const deleteDeviceTemplateVariable = async (name: string): Promise<void> => {
  await edgeConfigApiInstance.delete(`/platform/device-template-variables/${encodeURIComponent(name)}`);
};


export const edgeConfigApi = {
  getDevices,
  getDevice,
  getSmartEmsInfo,
  putDeploymentTag,
  getSmartEmsStatus,
  getModules,
  getConfigStatus,
  getSmartEmsConfigLan,
  postSmartEmsConfigLan,
  scanNetwork,
  getPeriodicNetworkScanResult,
  getTwinConfig,
  postTwinConfig,
  invokeDirectMethod,
  getDeployments,
  getDeploymentStatus,
  getConnectionStatus,
  nmShow,
  getCmdLanIpConfig,
  postDeviceCmdSmartemsCheck,
  getDeviceCmdStatus,
  postDeviceCmdLanConfig,
  getDeviceCellularConfig,
  postDeviceCellularConfig,
  postDeviceNetworkDiscover,
  getDeviceCmdNmConfig,
  getSmartEmsConfigExport,
  getDeviceCmdConfigShow,
  postInfluxBucketCreate,
  postWebFtpWriteFile,
  getPermissions,
  getDeviceManagementPermissions,
  getRoles,
  getRoleDetails,
  deleteRole,
  createRole,
  updateRole,
  getActions,
  getScopes,
  getScopeDetails,
  deleteScope,
  createScope,
  updateScope,
  getTeams,
  getTeamDetails,
  deleteTeam,
  createTeam,
  updateTeam,
  getUsers,
  getCurrentUser,
  getCurrentUserTeams,
  addUserToTeam,
  removeUserFromTeam,
  getUserTeamAssignments,
  getEventData,
  getAvailableTemplates,
  saveSelectedTemplates,
  createDevice,
  deleteDevice,
  getDevicesWithMetaKey,
  getDeviceTemplateVariables,
  setDeviceTemplateVariable,
  deleteDeviceTemplateVariable
}
