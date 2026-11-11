import { Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { ErrorState } from "@/components/ui/page-state";
import PanelHost from "./PanelHost";
import { contributionPath } from "./useNavContributions";
import { useContributions } from "./useExtensionUi";

type RoutedExtensionPanelProps = {
  target: "device" | "global" | "module";
  placement: "tab" | "page";
  context: object;
};

/** Route element for `x/:ext/:path/*`: the matching contribution in the standard card. */
export default function RoutedExtensionPanel({ target, placement, context }: RoutedExtensionPanelProps) {
  const params = useParams();
  const { contributions, isLoading } = useContributions(
    target,
    placement,
    context as Record<string, unknown>
  );

  const c = contributions.find((x) => x.extension === params.ext && contributionPath(x) === params.path);
  if (!c) {
    if (isLoading) return <Loader2 className="animate-spin" size={16} />;
    return <ErrorState title="Page not found" message="This extension page is not available." />;
  }

  const contextKey = JSON.stringify({ ...context, subPath: params["*"] ?? "" });
  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold">{c.label}</h3>
      <PanelHost
        contribution={c}
        contextKey={contextKey}
        errorFallback={<p className="text-sm text-muted-foreground">{c.label} unavailable</p>}
      />
    </div>
  );
}
