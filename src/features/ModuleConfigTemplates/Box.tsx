import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A page section in a full-width box: title, optional description and header actions, optionally compactable
 * (only the header stays while collapsed).
 */
export default function Box({ label, title, description, actions, children, className, collapse }: {
  label: string;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  collapse?: { collapsed: boolean; onToggle: () => void };
}) {
  const collapsed = !!collapse?.collapsed;
  return (
    <section aria-label={label} className={cn("w-full space-y-4 rounded-lg border bg-card p-5", collapsed && "space-y-0 py-3", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center gap-3">
          {collapse && (
            <Button type="button" variant="ghost" size="icon" className="-ml-2 h-8 w-8" aria-expanded={!collapsed}
                    aria-label={`${collapsed ? "Expand" : "Collapse"} ${title ?? label}`} onClick={collapse.onToggle}>
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
          <div className="mr-auto space-y-1">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && !collapsed && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {!collapsed && children}
    </section>
  );
}
