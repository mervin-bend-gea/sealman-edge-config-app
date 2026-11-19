import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { Accordion } from "@/components/ui/accordion";
import type { MappedEndpoint } from "@/generated/edge-administration/hooks/network/usePostNetworkOverview";
import EndpointAccordionItem from "../EndpointAccordionItem";

vi.mock("@/generated/edge-administration/hooks/endpoint_types/useGetEndpointTypes", () => ({
  default: () => ({ data: [{ type_id: "plc", label: "PLC", description: null, fields: {}, mapping: {} }] }),
}));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({
  usePermissions: () => ({ hasPermission: true }),
}));
vi.mock("../AssignEndpointDialog", () => ({ default: () => null }));
vi.mock("../AssignServiceDialog", () => ({ default: () => null }));
vi.mock("../BrowseDialog", () => ({ default: () => null }));

const endpoint = {
  endpoint_id: "e1", type_id: "plc", type_label: "PLC", ip: "10.0.0.1", status: "online", source: "configured", ports: [],
} as unknown as MappedEndpoint;

describe("EndpointAccordionItem highlight", () => {
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    scrollIntoView.mockReset();
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(() => vi.useRealTimers());

  const renderItem = (highlighted: boolean, onHighlightDone = () => {}) =>
    render(
      <Accordion type="single" collapsible>
        <EndpointAccordionItem
          endpoint={endpoint} deviceId="dev-1" onCreated={() => {}} onOpenDetails={() => {}} onOpenServiceDetails={() => {}}
          highlighted={highlighted} onHighlightDone={onHighlightDone}
        />
      </Accordion>,
    );

  it("does nothing when not highlighted", () => {
    const done = vi.fn();
    const { container } = renderItem(false, done);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(container.querySelector("[data-highlighted]")).toBeNull();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(done).not.toHaveBeenCalled();
  });

  it("scrolls to the row, flashes it, then reports done", () => {
    const done = vi.fn();
    const { container } = renderItem(true, done);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-highlighted]")?.className).toContain("animate-search-highlight");
    act(() => { vi.advanceTimersByTime(3999); });
    expect(done).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2); });
    expect(done).toHaveBeenCalledTimes(1);
  });
});
