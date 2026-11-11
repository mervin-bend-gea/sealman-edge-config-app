import { Outlet } from "react-router-dom";

/** Page frame of the module templates: a column of full-width boxes. */
export default function TemplatesLayout() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex w-full flex-col gap-4">
        <Outlet />
      </div>
    </div>
  );
}
