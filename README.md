# Edge Config App

The Edge Config App is a web application for operations and engineering teams to manage configurations across a fleet of IIoT Edge devices.
It communicates with the [Edge Config Api](https://github.com/eclipse-sealman/sealman-edge-config-api) and the [SEALMAN Ems](https://github.com/eclipse-sealman/sealman-ems).

### Prerequisites

Node 22+ is required. Install it via nvm (one-time setup):

```bash
nvm install 22
```

### Running locally

**Local (cross platform):**
```bash
npm install
npm run dev
```

**Devcontainer:** open the command palette (`Ctrl/Cmd+Shift+P`) -> `Reopen in Container`, then run the same commands above.

Visit http://localhost:3000

**To activate SSL on the dev server:** add `VITE_USE_DEV_SERVER_SSL=true` to your `.env.local`.

## Environment Setup

Copy `env.local.example` to `.env.local` and fill in the values.

`VITE_VERSION` is baked into the container image at build time; all other variables must be injected at runtime when deploying with Docker.

### General

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URI` | Yes | Base URL of the Edge Config API. |
| `VITE_VERSION` | No | Application version shown in the UI. Defaults to `local-development`. |
| `VITE_WEBVNC_URI` | No | Base URL of the WebVNC API. Required for the WebVNC feature. |
| `VITE_WEBVNC_API_KEY` | No | API key for the WebVNC API. |
| `VITE_SEMS_API_URL` | Yes | Base URL of the Smart EMS API. |

### Authentication

Set `VITE_AUTHENTICATION_PROVIDER` to `keycloak` (default) or `entra` and fill in the corresponding variables below.

| Variable | Provider | Description |
|---|---|---|
| `VITE_AUTHENTICATION_PROVIDER` | - | Authentication provider to use: `keycloak` or `entra`. Defaults to `keycloak`. |
| `VITE_KEYCLOAK_AUTHORITY` | keycloak | Keycloak realm URL (e.g., `http://localhost:8080/realms/local-dev`). |
| `VITE_KEYCLOAK_CLIENT_ID` | keycloak | Keycloak client ID. |
| `VITE_ENTRA_ID_AUTHORITY` | entra | Entra ID authority URL. |
| `VITE_ENTRA_ID_CLIENT_ID` | entra | Entra ID application (client) ID. |
| `VITE_ENTRA_ID_REDIRECT_URI` | entra | Redirect URL after login (e.g., `http://localhost:3000`). |
| `VITE_API_SCOPES` | entra | Comma-separated OAuth scopes requested when acquiring API tokens. |

### Device metadata

The gateway's device type is read-only when editing metadata. Select the type when creating the device; it cannot be changed afterward.

### API access errors

Assets and the VPN endpoint list show "Not permitted" after an API 403 and hide previously loaded restricted results. In Assets, a discovery denial stops scanning but preserves the independent configured-endpoint read, showing endpoints with their last-known status. A denial of that endpoint read hides the Assets results. The affected workflow stops automatic requests until an explicit retry or a device/account change. Gateway VPN controls remain available independently.

Applications stops config-status polling after HTTP 400 or 403; retry explicitly or correct the module IDs to resume. System module IDs such as `$edgeAgent` and `$edgeHub` are sent unchanged. If saving additional scan ports is denied, the custom scan can still use those ports temporarily without retrying the save in the background.

### Extension credentials

Platform Configuration > Extensions requires `extension.read`. Registration, editing, internal-key rotation, and device-key issue/revoke require `extension.register`; disabling/deregistering requires `extension.deregister`. The API remains authoritative if access changes.

Registration displays `internal_key` once when returned by the API. Internal routes use `X-Internal-Key`; rotation invalidates the previous key immediately. HTTP routes with `device` visibility use per-device `X-Device-Key` credentials on the field-ingress API. Their detail page lists key metadata and allows issuing/replacing or confirming revocation of a key. Optional module IDs are metadata, not an authentication restriction.

Copy newly issued credentials before closing their dialogs: they are not saved to browser storage or query caches, and cannot be retrieved by the UI later. Device-key endpoints and registration-time keys require the corresponding local API changes; the published older API does not provide them.

Extension details show initial internal-key issuance and the most recent rotation separately; rotation does not change the initial issuance timestamp. Unknown legacy issuance dates show "Not available"; before the first rotation, the UI shows "Never rotated". Device-key history includes UUIDs, optional labels/descriptions, issuance and revocation timestamps, and active/revoked status. Only one key is active per extension/device: issuing a replacement immediately revokes the previous record without removing its history. Revocation targets the selected key's UUID, not the device ID.

## Running in Docker

```bash
docker build . -t edge-configuration-app
docker run --rm --name edge-configuration-app -p 3000:8080 \
	-e VITE_SEMS_API_URL="https://smart-ems.example.com" \
	edge-configuration-app
```

## Key Dependencies

| Dependency | Purpose |
|---|---|
| [Vite](https://vitejs.dev) | Build tool and dev server |
| [React Router](https://reactrouter.com/en/main) | Client-side routing (`src/App.tsx`) |
| [Tailwind CSS](https://tailwindcss.com/docs) | Utility-first styling |
| [React Query](https://tanstack.com/query/latest) | Data fetching, caching and synchronization |
| [Tanstack Table](https://tanstack.com/table/latest) | Tables and datagrids |
| [MSAL React](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-react/README.md) | Authentication with Azure Entra ID |
| [React Leaflet](https://react-leaflet.js.org/) | World map |
| [Lucide React](https://lucide.dev/) | Primary icon set used across the UI |
| [Hero Icons](https://heroicons.com/) | Additional icon set used in some components |
| [React Toastify](https://www.npmjs.com/package/react-toastify) | User notifications and alerts |
| [Radix UI](https://www.radix-ui.com/) | Accessible component primitives (dialogs, dropdowns, tabs, etc.) |
