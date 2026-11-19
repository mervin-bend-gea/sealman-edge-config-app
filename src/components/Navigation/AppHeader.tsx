import { NavLink } from "react-router-dom";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useMemo } from "react";

import SignOutButton from "../Auth/SignOutButton";
import defaultLogo from "../../assets/sealman_logo.png";
import { useAuth } from "@/auth";
import { useActiveBranding } from "@/features/Appearance/appearanceStore";
import { Button } from "@/components/ui/button";

// Docs and Help are placeholders until the targets exist.
const HEADER_LINKS = [
  { label: "Docs", href: "#" },
  { label: "Help", href: "#" },
];

export default function AppHeader() {
  const auth = useAuth();
  const logo = useActiveBranding().logoUrl ?? defaultLogo;

  const initials = useMemo(() => {
    return auth.user?.name?.split(" ").map((n) => n[0]).join("") || "";
  }, [auth.user?.name]);

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-header-border bg-linear-to-r from-header-from via-header-via to-header-to px-4 shadow-sm">
      <div className="flex items-center gap-6">
        <img className="h-10 w-auto max-w-full object-contain" src={logo} alt="Logo" />
      </div>

      <div className="flex items-center gap-1">
        {HEADER_LINKS.map((link) => (
          <Button key={link.label} asChild variant="ghost" size="sm" className="text-gray-700">
            <a href={link.href} onClick={(e) => e.preventDefault()}>
              {link.label}
            </a>
          </Button>
        ))}

        <Menu as="div" className="relative ml-2">
          <MenuButton className="flex items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-white/70 focus:outline-hidden focus-visible:ring-1 focus-visible:ring-vibrant-blue">
            <span className="sr-only">Open user menu</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs font-medium text-gray-700">
              {initials}
            </span>
            <span className="hidden max-w-48 truncate text-sm font-medium text-gray-700 sm:block">
              {auth.user?.name}
            </span>
            <ChevronDownIcon className="hidden h-4 w-4 shrink-0 text-gray-400 sm:block" aria-hidden="true" />
          </MenuButton>
          <MenuItems
            anchor="bottom end"
            className="z-50 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 [--anchor-gap:0.5rem] focus:outline-hidden"
          >
            <MenuItem>
              {({ close }) => (
                <NavLink
                  to="/user/profile"
                  onClick={close}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  User Profile
                </NavLink>
              )}
            </MenuItem>
            <MenuItem>
              <SignOutButton />
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>
    </header>
  );
}
