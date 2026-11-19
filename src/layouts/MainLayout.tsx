import SideNavigation from "../components/Navigation/SideNavigation";
import AppHeader from "../components/Navigation/AppHeader";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <SideNavigation />
        <main className="min-w-0 flex-1 overflow-y-auto bg-page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

