import { NavLink } from "react-router-dom";
import {
  ClockIcon,
  Cog6ToothIcon,
  CpuChipIcon,
  DocumentDuplicateIcon,
  HomeIcon,
  PuzzlePieceIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { Fragment, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import HalfManHalfSeal from "./HalfManHalfSeal";

import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { useNavContributions } from "@/features/Extensions/outlets/useNavContributions";
import { useOutletUser } from "@/features/Extensions/outlets/useOutletUser";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";

interface INavigation {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  end?: boolean;
  separatorBefore?: boolean;
  separatorAfter?: boolean;
}

export default function SideNavigation() {
  const [collapsed, setCollapsed] = useState(false);
  const { hasPermission: hasAuthorizationReadPermission, isLoading: isAuthPermissionsLoading } = usePermissions({
    permissionKey: PERMISSION_KEYS.PLATFORM_AUTHORIZATION_READ,
  });
  const {
    hasPermission: hasPlatformConfigReadPermission,
    isLoading: isPlatformConfigPermissionsLoading,
  } = usePermissions({
    permissionKey: PERMISSION_KEYS.PLATFORM_CONFIG_READ,
  });
  const {
    hasPermission: hasAssetConfigReadPermission,
    isLoading: isAssetConfigPermissionsLoading,
  } = usePermissions({
    permissionKey: PERMISSION_KEYS.PLATFORM_ASSET_CONFIG_READ,
  });

  const { hasPermission: hasTemplateReadPermission, isLoading: isTemplatePermissionLoading } = usePermissions({
    permissionKey: PERMISSION_KEYS.MODULE_CONFIG_TEMPLATE_READ,
  });

  const user = useOutletUser();
  const extensionPages = useNavContributions("global", "page", { user });

  const navigation: INavigation[] = useMemo(() => {
    const items: INavigation[] = [
      { name: "Dashboard", href: "/", icon: HomeIcon, end: true },
      { name: "Devices", href: "/devices", icon: CpuChipIcon, separatorAfter: true },
    ];

    if (!isAssetConfigPermissionsLoading && hasAssetConfigReadPermission) {
      items.push({ name: "Asset Modelling", href: "/platform-types", icon: Squares2X2Icon });
    }

    if (!isTemplatePermissionLoading && hasTemplateReadPermission) {
      items.push({ name: "Module Templates", href: "/module-templates", icon: DocumentDuplicateIcon });
    }

    items.push({ name: "Deployments", href: "/deployments", icon: RocketLaunchIcon });

    if (!isAuthPermissionsLoading && hasAuthorizationReadPermission) {
      items.push({ name: "Authorization", href: "/authorization/teams", icon: ShieldCheckIcon });
    }

    items.push({ name: "Monitoring", href: "/monitoring", icon: ClockIcon });

    if (!isPlatformConfigPermissionsLoading && hasPlatformConfigReadPermission) {
      items.push({
        name: "Platform Configuration",
        href: "/settings/seal-agent",
        icon: Cog6ToothIcon,
        separatorBefore: true,
      });
    }

    for (const page of extensionPages) {
      items.push({ name: page.label, href: page.to, icon: PuzzlePieceIcon });
    }

    return items;
  }, [
    hasAuthorizationReadPermission,
    hasAssetConfigReadPermission,
    hasPlatformConfigReadPermission,
    isAuthPermissionsLoading,
    isAssetConfigPermissionsLoading,
    isPlatformConfigPermissionsLoading,
    hasTemplateReadPermission,
    isTemplatePermissionLoading,
    extensionPages,
  ]);

  return (
    <aside className={`flex h-full shrink-0 flex-col bg-[#0f1f47] transition-[width] duration-200 ease-in-out ${collapsed ? "w-16" : "w-16 lg:w-60"}`}>
      <div className={`flex h-11 shrink-0 items-center border-b border-white/10 px-2 ${collapsed ? "justify-center" : "justify-end"}`}>
        {!collapsed && (
          <span className="hidden min-w-0 flex-1 truncate text-center text-base font-bold tracking-wide text-slate-100 lg:inline">IIoT Platform</span>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-slate-200 transition-colors hover:border-blue-300/60 hover:bg-blue-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
        </button>
      </div>
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2 pt-3">
        {navigation.map((item) => (
          <Fragment key={item.href}>
            {item.separatorBefore && <div className="my-2 border-t border-white/10" role="separator" />}
            <NavLink
              to={item.href}
              end={item.end}
              title={collapsed ? item.name : undefined}
              aria-label={item.name}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? "justify-center" : "justify-start"} gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="hidden truncate lg:inline">{item.name}</span>}
            </NavLink>
            {item.separatorAfter && <div className="my-2 border-t border-white/10" role="separator" />}
          </Fragment>
        ))}
      </nav>
      <div className={`shrink-0 border-t border-white/10 ${collapsed ? "px-1 py-3" : "px-3 py-3"}`}>
        <HalfManHalfSeal collapsed={collapsed} />
      </div>
    </aside>
  );
}
