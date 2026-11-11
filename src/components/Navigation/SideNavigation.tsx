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
import { Fragment, useMemo } from "react";

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
}

export default function SideNavigation() {
  const { hasPermission: hasAuthorizationReadPermission, isLoading: isPermissionsLoading } = usePermissions({
    permissionKey: PERMISSION_KEYS.PLATFORM_AUTHORIZATION_READ,
  });

  const { hasPermission: hasTemplateReadPermission, isLoading: isTemplatePermissionLoading } = usePermissions({
    permissionKey: PERMISSION_KEYS.MODULE_CONFIG_TEMPLATE_READ,
  });

  const user = useOutletUser();
  const extensionPages = useNavContributions("global", "page", { user });

  const navigation: INavigation[] = useMemo(() => {
    const items: INavigation[] = [
      { name: "Dashboard", href: "/", icon: HomeIcon, end: true },
      { name: "Devices", href: "/devices", icon: CpuChipIcon },
      { name: "Asset Configuration", href: "/platform-types", icon: Squares2X2Icon, separatorBefore: true },
    ];

    if (!isTemplatePermissionLoading && hasTemplateReadPermission) {
      items.push({ name: "Module Templates", href: "/module-templates", icon: DocumentDuplicateIcon });
    }

    items.push({ name: "Deployments", href: "/deployments", icon: RocketLaunchIcon });

    if (!isPermissionsLoading && hasAuthorizationReadPermission) {
      items.push({ name: "Authorization", href: "/authorization/teams", icon: ShieldCheckIcon });
    }

    items.push({ name: "Monitoring", href: "/monitoring", icon: ClockIcon });

    items.push({
      name: "Platform Configuration",
      href: "/settings/seal-agent",
      icon: Cog6ToothIcon,
      separatorBefore: true,
    });

    for (const page of extensionPages) {
      items.push({ name: page.label, href: page.to, icon: PuzzlePieceIcon });
    }

    return items;
  }, [hasAuthorizationReadPermission, isPermissionsLoading, hasTemplateReadPermission, isTemplatePermissionLoading, extensionPages]);

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col bg-[#0f1f47] lg:w-60">
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {navigation.map((item) => (
          <Fragment key={item.href}>
            {item.separatorBefore && <div className="my-2 border-t border-white/10" role="separator" />}
            <NavLink
              to={item.href}
              end={item.end}
              title={item.name}
              className={({ isActive }) =>
                `flex items-center justify-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors lg:justify-start ${
                  isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">{item.name}</span>
            </NavLink>
          </Fragment>
        ))}
      </nav>
    </aside>
  );
}
