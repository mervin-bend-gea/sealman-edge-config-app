import { Fragment } from "react";
import type { ReactNode } from "react";
import PanelHost from "./PanelHost";
import type { OutletPlacement, OutletTarget } from "./outlets";
import { useContributions, type Contribution } from "./useExtensionUi";

type ExtensionOutletProps = {
  target: OutletTarget;
  placement: "section" | "replace:config" | "replace:page";
  /** Passed to each panel as `props.context`; also filters contributions by their `when`. */
  context: object;
  onDataChanged?: () => void;
  /** Replace placement: the built-in view, shown when no extension matches or the panel fails. */
  fallback?: ReactNode;
};

export default function ExtensionOutlet({
  target,
  placement,
  context,
  onDataChanged,
  fallback = null,
}: ExtensionOutletProps) {
  const { contributions } = useContributions(
    target,
    placement as OutletPlacement,
    context as Record<string, unknown>
  );
  const contextKey = JSON.stringify(context);
  const isReplace = placement.startsWith("replace:");

  const render = (c: Contribution, errorFallback: ReactNode) => (
    <PanelHost contribution={c} contextKey={contextKey} onDataChanged={onDataChanged} errorFallback={errorFallback} />
  );

  if (isReplace) {
    const first = contributions[0];
    if (!first) return <>{fallback}</>;
    return render(
      first,
      <>
        <p className="text-sm text-muted-foreground">{first.label} unavailable, showing the built-in view</p>
        {fallback}
      </>
    );
  }

  return (
    <>
      {contributions.map((c) => (
        <Fragment key={`${c.extension}|${c.module}`}>
          <div className="bg-card border rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-semibold">{c.label}</h3>
            {render(c, <p className="text-sm text-muted-foreground">{c.label} unavailable</p>)}
          </div>
        </Fragment>
      ))}
    </>
  );
}
