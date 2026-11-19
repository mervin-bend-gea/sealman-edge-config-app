import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssetConfigurationAccess from "./AssetConfigurationAccess";

const mocks = vi.hoisted(() => ({
  grants: new Set<string>(),
  loading: false,
  error: null as Error | null,
}));

vi.mock("@/auth", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { sub: "user-a", iss: "test" } }),
}));
vi.mock("@/features/authorization/permissions/use-permissions", () => ({
  usePermissions: ({ permissionKey }: { permissionKey: string }) => ({
    hasPermission: mocks.grants.has(permissionKey),
    isLoading: mocks.loading,
    isError: mocks.error !== null,
    error: mocks.error,
  }),
}));

const tree = () => (
  <MemoryRouter>
    <Routes>
      <Route element={<AssetConfigurationAccess />}>
        <Route path="/" element={<div>Asset types</div>} />
      </Route>
    </Routes>
  </MemoryRouter>
);

describe("AssetConfigurationAccess", () => {
  beforeEach(() => {
    mocks.grants.clear();
    mocks.loading = false;
    mocks.error = null;
  });

  it("requires asset configuration read access for direct routes", () => {
    mocks.grants.add("platform.config.read");
    const { rerender } = render(tree());
    expect(screen.getByText("Requires platform.asset.config.read.")).toBeInTheDocument();
    expect(screen.queryByText("Asset types")).not.toBeInTheDocument();
    mocks.grants.add("platform.asset.config.read");
    rerender(tree());
    expect(screen.getByText("Asset types")).toBeInTheDocument();
  });

  it("does not mount routes while permission checks load or fail", () => {
    mocks.loading = true;
    const { rerender } = render(tree());
    expect(screen.getByText("Checking asset configuration permissions...")).toBeInTheDocument();
    expect(screen.queryByText("Asset types")).not.toBeInTheDocument();
    mocks.loading = false;
    mocks.error = new Error("Permission lookup failed");
    rerender(tree());
    expect(screen.getByText("Could not check asset configuration permissions")).toBeInTheDocument();
    expect(screen.queryByText("Asset types")).not.toBeInTheDocument();
  });
});