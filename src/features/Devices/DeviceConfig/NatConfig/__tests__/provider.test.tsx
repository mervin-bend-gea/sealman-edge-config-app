// TODO: This test can be refactored to use renderHook once the content of the provider is wrapped in a custom hook
import { render } from "@/utils/test-utils"
import useGetDeviceNatConfigMocked from "@/generated/edge-administration/hooks/__mocks__/useGetDeviceNatConfig"
import { postDeviceNatConfigMocked } from "@/generated/edge-administration/hooks/__mocks__/usePostDeviceNatConfig"
import DeviceNatConfigRulesProvider from "../provider"
import { DeviceNatConfigRulesContext } from "../context"
import { useContext } from "react"
import userEvent from "@testing-library/user-event"
import useGetSmartEmsStatusMocked from "@/generated/edge-administration/hooks/__mocks__/useGetSmartEmsStatus"

vi.mock("@/generated/edge-administration/hooks/useGetDeviceNatConfig")
vi.mock("@/generated/edge-administration/hooks/usePostDeviceNatConfig")
vi.mock("@/generated/edge-administration/hooks/useGetSmartEmsStatus")

describe("Device NAT Config Provider", () => {
  it("should call useGetDeviceNatConfig with deviceId when it's given as prop", () => {
    render(
      <DeviceNatConfigRulesProvider deviceId={ "deviceId" }>
        test
      </DeviceNatConfigRulesProvider>
    )

    expect(useGetDeviceNatConfigMocked).toHaveBeenCalledWith("deviceId")
  })

  it("should call useGetSmartEmsStatus to be able to check the firmware version", () => {
    render(
      <DeviceNatConfigRulesProvider deviceId={ "deviceId" }>
        test
      </DeviceNatConfigRulesProvider>
    )

     expect(useGetSmartEmsStatusMocked).toHaveBeenCalled()
  })

  suite("should tell if the provider is loading based on the isLoading of the getHooks", () => {
    const testCases = [
      { isGetNatConfigLoading: true, isSmartEmsStatusLoading: false, expected: 'PROVIDER_LOADING' },
      { isGetNatConfigLoading: false, isSmartEmsStatusLoading: true, expected: 'PROVIDER_LOADING' },
      { isGetNatConfigLoading: true, isSmartEmsStatusLoading: true, expected: 'PROVIDER_LOADING' },
      { isGetNatConfigLoading: false, isSmartEmsStatusLoading: false, expected: 'PROVIDER_NOT_LOADING' },
    ];

    testCases.forEach(({ isGetNatConfigLoading, isSmartEmsStatusLoading, expected }) => {
      it(`isGetNatConfigLoading: ${isGetNatConfigLoading}, isSmartEmsStatusLoading: ${isSmartEmsStatusLoading}`, () => {
        useGetDeviceNatConfigMocked.mockReturnValueOnce({
          isLoading: isGetNatConfigLoading
        })
        useGetSmartEmsStatusMocked.mockReturnValueOnce({
          isLoading: isSmartEmsStatusLoading
        })

        const MyTestComponent = () => {
           const { isLoading } = useContext(DeviceNatConfigRulesContext)

           return isLoading ? "PROVIDER_LOADING" : "PROVIDER_NOT_LOADING"
        }
        const {getByText} = render(
          <DeviceNatConfigRulesProvider deviceId={ "deviceId" }>
            <MyTestComponent />
          </DeviceNatConfigRulesProvider>
        )

        getByText(expected);
      })
    })
  })

  it("should update the nat rules", async () => {
    const user = userEvent.setup()

    const MyTestComponent = () => {
      const { natConfig, addNatRule } = useContext(DeviceNatConfigRulesContext)

      const handleClick = () => {
        addNatRule({extIp: "1", intIp: "2", name: "new_rule_name"})
      }

      return (
        <>
          <button onClick={handleClick}>ACTION</button>
          {natConfig?.nat_rules?.map((r, i) => (
            <div key={i}>
             {r.name}
            </div>
          ))}
        </>
      )
    }

    const { findByText, getByText } = render(
      <DeviceNatConfigRulesProvider deviceId={ "deviceId" }>
        <MyTestComponent />
      </DeviceNatConfigRulesProvider>
    )

    await user.click(getByText("ACTION"))
    expect(await findByText("new_rule_name"))
  })

  it("should enable NAT when a rule is added and disable it when the last rule is deleted", async () => {
    const user = userEvent.setup()
    useGetDeviceNatConfigMocked.mockReturnValue({data: {nat_enabled: false, nat_rules: []}})
    const MyTestComponent = () => {

      const { addNatRule, deleteRule, natConfig } = useContext(DeviceNatConfigRulesContext)

      return (
        <>
          <button onClick={() => addNatRule({ extIp: "1", intIp: "2", name: "test-rule" })}>Add rule</button>
          <button onClick={() => deleteRule(0)}>Delete rule</button>
          {natConfig?.nat_enabled ? "ENABLED" : "DISABLED"}
        </>
      )
    }

    const { getByText } = render(
      <DeviceNatConfigRulesProvider deviceId="testId">
        <MyTestComponent />
      </DeviceNatConfigRulesProvider>
    )

    getByText("DISABLED")
    await user.click(getByText("Add rule"))
    getByText("ENABLED")
    await user.click(getByText("Delete rule"))
    getByText("DISABLED")
    useGetDeviceNatConfigMocked.mockRestore()
  })

  it("should update a specific rule",async () => {
    const user = userEvent.setup()
    // TODO: Initial value doesn't need to be specified and tested for
    useGetDeviceNatConfigMocked.mockReturnValue({data: {
      nat_enabled: false,
      nat_rules: [
        {
          extIp: "old-ext",
          intIp: "old-int",
          name: "old-name"
        }
      ]
    }})
    const MyTestComponent = () => {

      const { updateRule, natConfig } = useContext(DeviceNatConfigRulesContext)

      const handleClick = () => {
        updateRule({
          index: 0,
          rule: {
            extIp: "new-ext",
            intIp: "new-int",
            name: "new-name"
          }
        })
      }

      return (
        <>
          <button onClick={handleClick}>ACTION</button>
          <p>{natConfig?.nat_rules![0].extIp}</p>
          <p>{natConfig?.nat_rules![0].intIp}</p>
          <p>{natConfig?.nat_rules![0].name}</p>
        </>
      )
    }

    const { getByText, findByText } = render(
      <DeviceNatConfigRulesProvider deviceId="testId">
        <MyTestComponent />
      </DeviceNatConfigRulesProvider>
    )

    getByText("old-ext")
    getByText("old-int")
    getByText("old-name")
    await user.click(getByText("ACTION"))
    await findByText("new-ext")
    await findByText("new-int")
    await findByText("new-name")

    useGetDeviceNatConfigMocked.mockRestore()
  })

  it("should delete a specific rule", async () => {
    const user = userEvent.setup()
    useGetDeviceNatConfigMocked.mockReturnValue({data: {
      nat_enabled: false,
      nat_rules: [
        {
          extIp: "old-ext",
          intIp: "old-int",
          name: "old-name"
        }
      ]
    }})
    const MyTestComponent = () => {

      const { deleteRule, natConfig } = useContext(DeviceNatConfigRulesContext)

      const handleClick = () => {
        deleteRule(0)
      }

      return (
        <>
          <button onClick={handleClick}>ACTION</button>
          {`rules: ${natConfig?.nat_rules?.length}`}
        </>
      )
    }

    const { getByText }  = render(
      <DeviceNatConfigRulesProvider deviceId="test">
        <MyTestComponent />
      </DeviceNatConfigRulesProvider>
    )

    getByText("rules: 1")
    await user.click(getByText("ACTION"))
    getByText("rules: 0")
  })

  it("should call the usePostDeviceNatConfig hook", async () => {
    const user = userEvent.setup()
    useGetDeviceNatConfigMocked.mockReturnValue({data: {nat_enabled: false, nat_rules: []}})
    const MyTestComponent = () => {
      const { postConfig } = useContext(DeviceNatConfigRulesContext)

      const handleClick = () => {
        postConfig()
      }
      return <>
        <button onClick={handleClick}>ACTION</button>
      </>
    }

    const { getByText }  =  render(
      <DeviceNatConfigRulesProvider deviceId={"deviceId"}>
        <MyTestComponent />
      </DeviceNatConfigRulesProvider>
    )

    await user.click(getByText("ACTION"))
    expect(postDeviceNatConfigMocked).toHaveBeenCalledWith({
      deviceId: "deviceId",
      body:  {
        "nat_enabled": false,
        "nat_rules": [
        ]
      }
    })
    useGetDeviceNatConfigMocked.mockRestore()
  })
})
