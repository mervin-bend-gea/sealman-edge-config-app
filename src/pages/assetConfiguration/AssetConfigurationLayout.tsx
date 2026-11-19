import { Outlet } from "react-router-dom";

export default function AssetConfigurationLayout() {
  return (
    <div className="h-full min-h-0 min-w-0 p-4 lg:p-6">
      <Outlet />
    </div>
  );
}
