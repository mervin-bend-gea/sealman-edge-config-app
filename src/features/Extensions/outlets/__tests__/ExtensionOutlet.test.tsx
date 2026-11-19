import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PanelProps } from "../sdk";
import type { Contribution } from "../useExtensionUi";

const contributionsMock = vi.fn();
const loadMock = vi.fn();

vi.mock("../useExtensionUi", () => ({
  useContributions: (...args: unknown[]) => contributionsMock(...args),
}));
vi.mock("../federation", () => ({ loadExtensionPanel: (...args: unknown[]) => loadMock(...args) }));
vi.mock("@/auth", () => ({ getAccessToken: vi.fn().mockResolvedValue("secret-token") }));
vi.mock("react-toastify", () => ({ toast: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import ExtensionOutlet from "../ExtensionOutlet";
import { resetExtensionPanelCache } from "../lazyPanel";

const c: Contribution = {
  extension: "acme",
  remoteName: "acme",
  entry: "/remoteEntry.js",
  module: "./EndpointPanel",
  label: "Acme",
  target: "endpoint",
  placement: "section",
};

const Panel = (_props: PanelProps<unknown>) => <div>panel body</div>;

function setup(ui: Partial<React.ComponentProps<typeof ExtensionOutlet>> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ExtensionOutlet target="endpoint" placement="section" context={{ user: { id: "u", name: "n" } }} {...ui} />
    </QueryClientProvider>
  );
}

describe("ExtensionOutlet", () => {
  beforeEach(() => {
    resetExtensionPanelCache();
    contributionsMock.mockReset();
    loadMock.mockReset();
    contributionsMock.mockReturnValue({ contributions: [c], isLoading: false });
    loadMock.mockResolvedValue(Panel);
  });

  it("section renders every matching extension", async () => {
    contributionsMock.mockReturnValue({
      contributions: [
        { ...c, extension: "a", label: "A" },
        { ...c, extension: "b", label: "B" },
      ],
      isLoading: false,
    });
    setup();
    expect(screen.getByRole("heading", { name: "A" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "B" })).toBeTruthy();
    expect(await screen.findAllByText("panel body")).toHaveLength(2);
  });

  it("keeps the panel mounted when the context changes", async () => {
    let mounts = 0;
    const MountCounting = ({ context }: PanelProps<unknown>) => {
      useEffect(() => {
        mounts++;
      }, []);
      return <div>panel for {(context as { endpointId: string }).endpointId}</div>;
    };
    loadMock.mockResolvedValue(MountCounting);
    const client = new QueryClient();
    const outlet = (endpointId: string) => (
      <QueryClientProvider client={client}>
        <ExtensionOutlet target="endpoint" placement="section" context={{ endpointId }} />
      </QueryClientProvider>
    );
    const { rerender } = render(outlet("e1"));
    expect(await screen.findByText("panel for e1")).toBeTruthy();
    rerender(outlet("e2"));
    expect(await screen.findByText("panel for e2")).toBeTruthy();
    expect(mounts).toBe(1);
  });

  it("replace renders the fallback when nothing matches", () => {
    contributionsMock.mockReturnValue({ contributions: [], isLoading: false });
    setup({ target: "module", placement: "replace:config", fallback: <p>built-in view</p> });
    expect(screen.getByText("built-in view")).toBeTruthy();
  });

  it("replace renders the fallback when the panel fails to load", async () => {
    loadMock.mockRejectedValue(new Error("Timed out"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    setup({ target: "module", placement: "replace:config", fallback: <p>built-in view</p> });
    expect(await screen.findByText("Acme unavailable, showing the built-in view")).toBeTruthy();
    expect(screen.getByText("built-in view")).toBeTruthy();
  });

  it("replace:page renders only the first matching extension, without the card, and falls back to the built-in page", async () => {
    contributionsMock.mockReturnValue({
      contributions: [
        { ...c, extension: "a", label: "A", target: "module", placement: "replace:page" },
        { ...c, extension: "b", label: "B", target: "module", placement: "replace:page" },
      ],
      isLoading: false,
    });
    const { container } = setup({ target: "module", placement: "replace:page", fallback: <p>built-in page</p> });
    expect(await screen.findByText("panel body")).toBeTruthy();
    expect(container.querySelectorAll("h3")).toHaveLength(0);
    expect(screen.queryByText("built-in page")).toBeNull();
    expect(contributionsMock).toHaveBeenCalledWith("module", "replace:page", expect.anything());

    loadMock.mockRejectedValue(new Error("Timed out"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetExtensionPanelCache();
    setup({ target: "module", placement: "replace:page", fallback: <p>built-in page</p> });
    expect(await screen.findByText("A unavailable, showing the built-in view")).toBeTruthy();
  });

  it("loads the panel once and does not re-suspend in a loop", async () => {
    // A real async loader: each call returns a fresh pending promise, as loadRemote does.
    loadMock.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(Panel), 5)));
    setup();
    expect(await screen.findByText("panel body")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(loadMock).toHaveBeenCalledTimes(1);
  });
});
