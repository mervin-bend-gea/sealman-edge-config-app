import { vi } from "vitest"

vi.mock("@/api/edgeConfig/edgeConfigApi", () => ({
  edgeConfigApi: {
    getEndpointTypes: vi.fn().mockResolvedValue([]),
    getServicePorts: vi.fn().mockResolvedValue([])
  }
}))

import { render } from "@/utils/test-utils"
import Page from "../Page"
import { useScanDefinitionStore, useTwinConfigStore } from "../stores"
import { cleanup, waitFor } from "@testing-library/react"
import useGetModuleTwinConfigMocked, { createData, createScanDefinition } from "@/generated/edge-administration/hooks/__mocks__/useGetModuleTwinConfig"
import { Status } from "@/features/Devices/Network/stores"
import { ApiError } from "@/generated/edge-administration/api"
import { NETWORK_DISCOVER_MODULE_NAME } from "@/api/edgeConfig/moduleNames"

vi.mock("@/generated/edge-administration/hooks/useGetModuleTwinConfig")
vi.mock("@/features/Devices/Network/layouts/sidebar/EndpointSidebar.tsx")
vi.mock("@/features/Devices/Network/components/mobile_top_bar/layout.tsx")
vi.mock("@/features/Devices/Network/layouts/EndpointContent/EndpointContentContainer.tsx")
vi.mock("@/features/Devices/Network/layouts/NetworkMainLayout.tsx")


describe("Network Page", () => {
  it("should reset the useTwinConfigStore & useScanDefinitionStore when the component unmount", async () => {
    useTwinConfigStore.setState({status: Status.IsSaving})
    useScanDefinitionStore.setState({networkDefinition: "1234"})

    useGetModuleTwinConfigMocked.mockResolvedValueOnce({data: undefined})

    const { unmount } = render(<Page deviceId="foo"/>)

    expect(useTwinConfigStore.getState().status).toBe(Status.IsSaving)

    unmount()

    expect(useTwinConfigStore.getState().status).toBe(Status.Default)
    expect(useScanDefinitionStore.getState().networkDefinition).toBe("")

    // No need to reset the state as it is done is the unmount phase here 😉
    useGetModuleTwinConfigMocked.mockRestore()
  })

  it("should call the getTwin config with the correct parameters", async () => {
    render(<Page deviceId="deviceID"/>)

    expect(useGetModuleTwinConfigMocked).toHaveBeenCalledWith("deviceID", NETWORK_DISCOVER_MODULE_NAME)

    cleanup()
    useGetModuleTwinConfigMocked.mockRestore()
  })

  it("should set the twin config state when the get request succeed", async () => {
    useGetModuleTwinConfigMocked.mockReturnValue({
      data: createData({scanDefinition: createScanDefinition({networkDefinition: "network"})})
    })

    render(<Page deviceId="deviceID"/>)

    await waitFor(() => {
      expect(useTwinConfigStore.getState().twinConfig.scanDefinition.networkDefinition).toBe("network")
    })

    cleanup()
    useGetModuleTwinConfigMocked.mockRestore()
  })

  it("should render the network layout immediately while the twin config query is still fetching", () => {
    useGetModuleTwinConfigMocked.mockReturnValue({isLoading: true})

    const { getByTestId, queryByText } = render(<Page deviceId="deviceId" />)

    getByTestId("NetworkMainLayout")
    expect(queryByText("Loading ...")).not.toBeInTheDocument()

    cleanup()
    useGetModuleTwinConfigMocked.mockRestore()
  })

  it("should still render the assets when the network discover module is not deployed", () => {
    useGetModuleTwinConfigMocked.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new ApiError("module missing", 404),
    })

    const { getByTestId, queryByText } = render(<Page deviceId="deviceId" />)

    getByTestId("NetworkMainLayout")
    expect(queryByText("Missing module")).not.toBeInTheDocument()

    cleanup()
    useGetModuleTwinConfigMocked.mockRestore()
  })
})
