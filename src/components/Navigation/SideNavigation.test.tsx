import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SideNavigation from "./SideNavigation";

const permissions = vi.hoisted(() => ({ grants: new Set<string>() }));

vi.mock("@/features/authorization/permissions/use-permissions", () => ({
  usePermissions: ({ permissionKey }: { permissionKey: string }) => ({
    hasPermission: permissions.grants.has(permissionKey),
    isLoading: false,
  }),
}));
vi.mock("@/features/Extensions/outlets/useNavContributions", () => ({ useNavContributions: () => [] }));
vi.mock("@/features/Extensions/outlets/useOutletUser", () => ({ useOutletUser: () => null }));

describe("configuration navigation permissions", () => {
  beforeEach(() => { permissions.grants.clear(); });

  it("shows each configuration section only for its own read permission", () => {
    permissions.grants.add("platform.config.read");
    const { rerender } = render(<MemoryRouter><SideNavigation /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Platform Configuration" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Asset Configuration" })).not.toBeInTheDocument();

    permissions.grants.clear();
    permissions.grants.add("platform.asset.config.read");
    rerender(<MemoryRouter><SideNavigation /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Asset Configuration" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Platform Configuration" })).not.toBeInTheDocument();
  });
});