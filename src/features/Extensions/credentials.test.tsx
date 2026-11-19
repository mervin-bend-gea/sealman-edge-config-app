import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { focusManager, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeviceKeysCard from "./DeviceKeysCard";
import ExtensionAccess from "./ExtensionAccess";
import ExtensionDetail from "./ExtensionDetail";
import RegisterExtensionPage from "./RegisterExtensionPage";
import SettingsLayout from "@/pages/settings/SettingsLayout";
import { queryClient } from "@/config/queryConfig";
import type { ExtensionFormDraft } from "./extensionFormTypes";
import type { components } from "@/generated/edge-administration/types";

const mocks = vi.hoisted(() => {
  const fetch = vi.fn();
  return {
    fetch, user: "user-a", grants: new Set<string>(), loading: false, permissionsError: false,
    notify: vi.fn(), requests: [] as { method: string; path: string; body: unknown }[],
    keys: [] as components["schemas"]["DeviceKeyInfo"][], denied: false,
    rotatedAt: null as string | null,
    omitTimestamps: false,
  };
});
vi.mock("openapi-fetch", async (importOriginal) => {
  const { default: createClient } = await importOriginal<typeof import("openapi-fetch")>();
  return {
    default: (options: Parameters<typeof createClient>[0]) => createClient({ ...options, baseUrl: "http://api.test", fetch: mocks.fetch }),
  };
});
vi.mock("@/auth", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { sub: mocks.user, iss: "test" } }),
  getAccessToken: async () => "test-access-token",
}));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({
  usePermissions: ({ permissionKey }: { permissionKey: string }) => ({
    hasPermission: mocks.grants.has(permissionKey), isLoading: mocks.loading, isError: mocks.permissionsError,
    error: mocks.permissionsError ? new Error("Permission lookup failed") : null,
  }),
}));
vi.mock("react-toastify", () => ({ toast: { success: mocks.notify, error: mocks.notify } }));
vi.mock("./ExtensionFormFields", () => ({
  ExtensionFormFields: ({ draft, onChange }: { draft: ExtensionFormDraft; onChange: (draft: ExtensionFormDraft) => void }) => (
    <input aria-label="Extension name" value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} />
  ),
}));

const extension = {
  schema_version: 1, name: "test-extension", description: "", upstreams: {}, routes: [], enabled: false,
  internal_key_created_at: "2026-10-01T10:00:00Z", internal_key_rotated_at: null,
};
const keyId = "11111111-1111-4111-8111-111111111111";
const oldKeyId = "22222222-2222-4222-8222-222222222222";
const createdAt = "2026-11-01T10:00:00Z";
const revokedAt = "2026-11-02T10:00:00Z";
const deviceKey = (overrides: Partial<components["schemas"]["DeviceKeyInfo"]> = {}): components["schemas"]["DeviceKeyInfo"] => ({
  id: keyId, device_id: "device-a", module_id: "$edgeAgent", created_at: createdAt, revoked_at: null, ...overrides,
});
const response = (data: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), {
  status, headers: { "content-type": "application/json" },
});
const wrapper = (children: React.ReactNode, location = "/") => (
  <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[location]}>{children}</MemoryRouter></QueryClientProvider>
);
const devicePage = () => wrapper(
  <Routes>
    <Route element={<ExtensionAccess />}>
      <Route path="/" element={<DeviceKeysCard name="test-extension" />} />
    </Route>
  </Routes>,
);

describe("minimal extension credentials UI", () => {
  beforeEach(() => {
    queryClient.clear();
    mocks.user = "user-a"; mocks.loading = false; mocks.permissionsError = false; mocks.denied = false;
    mocks.grants = new Set(["extension.read", "extension.register", "extension.deregister"]);
    mocks.keys = []; mocks.requests = []; mocks.rotatedAt = null; mocks.omitTimestamps = false;
    mocks.notify.mockReset();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    mocks.fetch.mockReset().mockImplementation(async (request: Request) => {
      const path = new URL(request.url).pathname;
      const text = request.method === "POST" ? await request.text() : "";
      const body: unknown = text ? JSON.parse(text) : null;
      mocks.requests.push({ method: request.method, path, body });
      if (mocks.denied) return response({ message: "Denied" }, 403);
      if (path.endsWith("/internal-key/rotate")) {
        mocks.rotatedAt = revokedAt;
        return response({ internal_key: "rotated-test-key" });
      }
      if (path.endsWith("/device-keys") && request.method === "POST") {
        const requestBody = JSON.parse(text) as components["schemas"]["DeviceKeyRequest"];
        mocks.keys = [
          ...mocks.keys.map((key) => key.device_id === requestBody.device_id && !key.revoked_at ? { ...key, revoked_at: revokedAt } : key),
          deviceKey({ ...requestBody }),
        ];
        return response({ id: keyId, device_id: requestBody.device_id, device_key: "issued-test-key" }, 201);
      }
      if (request.method === "DELETE") {
        const id = path.split("/").at(-1);
        if (!mocks.keys.some((key) => key.id === id && !key.revoked_at)) return response({ detail: "No active matching key" }, 404);
        mocks.keys = mocks.keys.map((key) => key.id === id ? { ...key, revoked_at: revokedAt } : key);
        return response(null, 204);
      }
      if (path.endsWith("/device-keys")) return response(mocks.keys);
      if (path.endsWith("/extensions") && request.method === "POST") return response({ ...extension, internal_key: "registration-test-key" }, 201);
      return response({
        ...extension,
        internal_key_created_at: mocks.omitTimestamps ? undefined : extension.internal_key_created_at,
        internal_key_rotated_at: mocks.omitTimestamps ? undefined : mocks.rotatedAt,
      });
    });
  });
  afterEach(() => { queryClient.clear(); });

  it("does not mount restricted routes or fetch extension data while read access is unresolved or missing", async () => {
    mocks.loading = true;
    const { rerender } = render(devicePage());
    expect(screen.getByText("Checking extension permissions...")).toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.loading = false; mocks.grants.clear();
    rerender(devicePage());
    expect(screen.getByText("Not permitted")).toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.permissionsError = true;
    rerender(devicePage());
    expect(screen.getByText("Could not check extension permissions")).toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("guards direct registration/edit routes separately from read access", () => {
    mocks.grants = new Set(["extension.read"]);
    render(wrapper(<Routes>
      <Route element={<ExtensionAccess />}>
        <Route element={<ExtensionAccess permissionKey="extension.register" />}>
          <Route path="new" element={<div>Registration form</div>} />
        </Route>
      </Route>
    </Routes>, "/new"));
    expect(screen.getByText("Requires extension.register.")).toBeInTheDocument();
    expect(screen.queryByText("Registration form")).not.toBeInTheDocument();
  });

  it("adds the navigation link only for extension readers", () => {
    mocks.grants.clear();
    const tree = () => wrapper(<Routes><Route path="/" element={<SettingsLayout />} /></Routes>);
    const { rerender } = render(tree());
    expect(screen.queryByRole("link", { name: "Extensions" })).not.toBeInTheDocument();
    mocks.grants.add("extension.read");
    rerender(tree());
    expect(screen.getByRole("link", { name: "Extensions" })).toHaveAttribute("href", "/extensions");
  });

  it("lists metadata without credential controls for read-only users", async () => {
    mocks.grants = new Set(["extension.read"]);
    mocks.keys = [deviceKey({ label: "Current", description: "Field unit" }), deviceKey({ id: oldKeyId, revoked_at: revokedAt })];
    render(devicePage());
    expect(await screen.findByRole("cell", { name: keyId })).toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "device-a" })).toHaveLength(2);
    expect(screen.getAllByRole("cell", { name: "$edgeAgent" })).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "Current" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Field unit" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Revoked" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Label (optional)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Issue key" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  });

  it("issues, displays once, copies and revokes a device key with confirmation", async () => {
    render(devicePage());
    await screen.findByText("No device keys issued.");
    fireEvent.change(screen.getByLabelText("Device ID"), { target: { value: " device-a " } });
    fireEvent.change(screen.getByLabelText("Module ID (optional)"), { target: { value: "$edgeAgent" } });
    fireEvent.change(screen.getByLabelText("Label (optional)"), { target: { value: " Field unit " } });
    fireEvent.change(screen.getByLabelText("Description (optional)"), { target: { value: " Primary ingress key " } });
    fireEvent.click(screen.getByRole("button", { name: "Issue key" }));
    expect(await screen.findByText("issued-test-key")).toBeInTheDocument();
    expect(mocks.requests).toContainEqual({ method: "POST", path: "/extensions/test-extension/device-keys", body: { device_id: "device-a", module_id: "$edgeAgent", label: "Field unit", description: "Primary ingress key" } });
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data))).not.toContain("issued-test-key");
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    fireEvent.click(screen.getByRole("button", { name: "Copy key" }));
    await screen.findByRole("button", { name: "Copied" });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("issued-test-key");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByText("issued-test-key")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Label (optional)")).toHaveValue("");
    expect(screen.getByLabelText("Description (optional)")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(mocks.requests.filter((request) => request.method === "DELETE")).toHaveLength(0);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Revoke key" }));
    await screen.findByRole("cell", { name: "Revoked" });
    expect(screen.getByRole("cell", { name: "Field unit" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Primary ingress key" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
    expect(mocks.requests).toContainEqual({ method: "DELETE", path: `/extensions/test-extension/device-keys/by-id/${keyId}`, body: null });
  });

  it("treats omitted revoked_at and nullable metadata as an active key", async () => {
    mocks.keys = [{ id: keyId, device_id: "device-a", created_at: createdAt }];
    render(devicePage());
    await screen.findByRole("cell", { name: keyId });
    expect(screen.getByRole("cell", { name: "Active" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: new Date(createdAt).toLocaleString() })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Revoke key" }));
    await screen.findByRole("cell", { name: "Revoked" });
    expect(mocks.requests).toContainEqual({ method: "DELETE", path: `/extensions/test-extension/device-keys/by-id/${keyId}`, body: null });
  });

  it("shows multiple historical records for one device and only revokes the active UUID", async () => {
    mocks.keys = [deviceKey({ id: oldKeyId, label: "Retired", revoked_at: revokedAt }), deviceKey({ label: "Current" })];
    render(devicePage());
    await screen.findByRole("cell", { name: oldKeyId });
    expect(screen.getAllByRole("cell", { name: "device-a" })).toHaveLength(2);
    const retiredRow = screen.getByRole("cell", { name: oldKeyId }).closest("tr")!;
    expect(within(retiredRow).getByText("Revoked")).toBeInTheDocument();
    expect(within(retiredRow).getByText(new Date(revokedAt).toLocaleString())).toBeInTheDocument();
    expect(within(retiredRow).queryByRole("button")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(keyId);
    expect(screen.getByRole("alertdialog")).not.toHaveTextContent(oldKeyId);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Revoke key" }));
    await waitFor(() => expect(screen.getAllByRole("cell", { name: "Revoked" })).toHaveLength(2));
    expect(mocks.requests).toContainEqual({ method: "DELETE", path: `/extensions/test-extension/device-keys/by-id/${keyId}`, body: null });
  });

  it("retains revoked history after replacement and omits blank optional metadata", async () => {
    mocks.keys = [deviceKey({ id: oldKeyId, label: "Old" })];
    render(devicePage());
    await screen.findByRole("cell", { name: oldKeyId });
    fireEvent.change(screen.getByLabelText("Device ID"), { target: { value: "device-a" } });
    fireEvent.change(screen.getByLabelText("Label (optional)"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Issue key" }));
    await screen.findByText("issued-test-key");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await screen.findByRole("cell", { name: "Revoked" });
    expect(screen.getByRole("cell", { name: "Active" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: oldKeyId })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: keyId })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Revoke" })).toHaveLength(1);
    expect(mocks.requests).toContainEqual({ method: "POST", path: "/extensions/test-extension/device-keys", body: { device_id: "device-a" } });
  });

  it("surfaces a UUID revoke conflict without falling back to device-wide revocation", async () => {
    mocks.keys = [deviceKey()];
    render(devicePage());
    await screen.findByRole("cell", { name: keyId });
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    mocks.keys = [deviceKey({ revoked_at: revokedAt })];
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Revoke key" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Request failed (404)"));
    expect(mocks.requests.filter((request) => request.method === "DELETE")).toEqual([
      { method: "DELETE", path: `/extensions/test-extension/device-keys/by-id/${keyId}`, body: null },
    ]);
  });

  it("reports clipboard failures without losing the one-time key", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("Clipboard unavailable"));
    render(devicePage());
    fireEvent.change(screen.getByLabelText("Device ID"), { target: { value: "device-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Issue key" }));
    await screen.findByText("issued-test-key");
    fireEvent.click(screen.getByRole("button", { name: "Copy key" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Select and copy it manually");
    expect(screen.getByText("issued-test-key")).toBeInTheDocument();
  });

  it("suppresses stale metadata on a later 403 and stops focus/reconnect refetches", async () => {
    mocks.keys = [deviceKey()];
    render(devicePage());
    await screen.findByText("device-a");
    mocks.denied = true;
    await act(async () => { await queryClient.invalidateQueries(); });
    await screen.findByText("Not permitted");
    expect(screen.queryByRole("cell", { name: "device-a" })).not.toBeInTheDocument();
    const calls = mocks.fetch.mock.calls.length;
    await act(async () => {
      focusManager.setFocused(false); focusManager.setFocused(true);
      onlineManager.setOnline(false); onlineManager.setOnline(true);
      await queryClient.invalidateQueries();
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(calls);
  });

  it("clears credentials when the account or read permission changes", async () => {
    const { rerender } = render(devicePage());
    fireEvent.change(screen.getByLabelText("Device ID"), { target: { value: "device-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Issue key" }));
    await screen.findByText("issued-test-key");
    mocks.user = "user-b";
    rerender(devicePage());
    await waitFor(() => expect(screen.queryByText("issued-test-key")).not.toBeInTheDocument());
    mocks.grants.clear();
    rerender(devicePage());
    expect(screen.getByText("Not permitted")).toBeInTheDocument();
  });

  it("does not redisplay an issued key after write access is lost and regained", async () => {
    const { rerender } = render(devicePage());
    fireEvent.change(screen.getByLabelText("Device ID"), { target: { value: "device-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Issue key" }));
    await screen.findByText("issued-test-key");
    mocks.grants.delete("extension.register");
    rerender(devicePage());
    await waitFor(() => expect(screen.queryByText("issued-test-key")).not.toBeInTheDocument());
    mocks.grants.add("extension.register");
    rerender(devicePage());
    expect(screen.queryByText("issued-test-key")).not.toBeInTheDocument();
  });

  it("reports an issuance denial without showing a credential", async () => {
    render(devicePage());
    await screen.findByText("No device keys issued.");
    mocks.denied = true;
    fireEvent.change(screen.getByLabelText("Device ID"), { target: { value: "device-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Issue key" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not permitted");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  });

  it("shows registration's internal key before navigation and clears the mutation result", async () => {
    render(wrapper(<Routes><Route path="extensions" element={<Outlet />}>
      <Route index element={<div>Extension list</div>} />
      <Route path="new" element={<RegisterExtensionPage />} />
    </Route></Routes>, "/extensions/new"));
    fireEvent.click(screen.getByRole("button", { name: "Skip, start blank" }));
    fireEvent.change(screen.getByLabelText("Extension name"), { target: { value: "test-extension" } });
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByText("registration-test-key")).toBeInTheDocument();
    expect(screen.queryByText("Extension list")).not.toBeInTheDocument();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await screen.findByText("Extension list");
    expect(screen.queryByText("registration-test-key")).not.toBeInTheDocument();
  });

  it("confirms internal-key rotation, resets its mutation cache and clears the key on close", async () => {
    render(wrapper(<Routes><Route path="extensions/:name" element={<ExtensionDetail />} /></Routes>, "/extensions/test-extension"));
    await screen.findByRole("heading", { name: "test-extension" });
    expect(screen.getByText("Never rotated")).toBeInTheDocument();
    const issuedTimestamp = screen.getByText(new Date(extension.internal_key_created_at).toLocaleString());
    expect(issuedTimestamp).toHaveAttribute("datetime", extension.internal_key_created_at);
    fireEvent.click(screen.getByRole("button", { name: "Rotate key" }));
    expect(mocks.requests.filter((request) => request.path.endsWith("/internal-key/rotate"))).toHaveLength(0);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Rotate key" }));
    await screen.findByText("rotated-test-key");
    await screen.findByText(new Date(revokedAt).toLocaleString());
    expect(screen.queryByText("Never rotated")).not.toBeInTheDocument();
    expect(screen.getByText(new Date(extension.internal_key_created_at).toLocaleString())).toHaveAttribute("datetime", extension.internal_key_created_at);
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByText("rotated-test-key")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Rotate key" }));
    expect(screen.queryByText("rotated-test-key")).not.toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Rotate key" })).toBeInTheDocument();
  });

  it("shows unknown legacy issuance and never rotated when nullable timestamps are omitted", async () => {
    mocks.omitTimestamps = true;
    render(wrapper(<Routes><Route path="extensions/:name" element={<ExtensionDetail />} /></Routes>, "/extensions/test-extension"));
    await screen.findByRole("heading", { name: "test-extension" });
    expect(screen.getByText("Not available")).toBeInTheDocument();
    expect(screen.getByText("Never rotated")).toBeInTheDocument();
    expect(screen.queryByText(new Date(extension.internal_key_created_at).toLocaleString())).not.toBeInTheDocument();
  });
});
