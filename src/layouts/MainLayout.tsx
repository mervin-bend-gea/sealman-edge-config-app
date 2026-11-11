import SideNavigation from "../components/Navigation/SideNavigation";
import AppHeader from "../components/Navigation/AppHeader";
import AppFooter from "../components/Navigation/AppFooter";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <SideNavigation />
        <main className="min-w-0 flex-1 overflow-y-auto bg-gray-50">
          <Outlet />
        </main>
      </div>
      <AppFooter />
    </div>
  );
}

