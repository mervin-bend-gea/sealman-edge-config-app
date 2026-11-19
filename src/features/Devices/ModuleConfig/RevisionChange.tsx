import { InlineAlert, LoadingState } from "@/components/ui/page-state";
import { getErrorMessage } from "@/lib/errors";
import { useRevision } from "@/features/ModuleConfigTemplates/api";
import DiffView from "@/features/ModuleConfigTemplates/DiffView";

/** Diff of a revision against the one before it (n vs n-1). */
export default function RevisionChange({ deviceId, moduleName, revisionId, parentId }: {
  deviceId: string;
  moduleName: string;
  revisionId: number;
  parentId?: number | null;
}) {
  const current = useRevision(deviceId, moduleName, revisionId);
  const previous = useRevision(deviceId, moduleName, parentId ?? undefined);

  if (parentId == null) {
    return <p className="text-sm text-muted-foreground">First recorded revision, nothing to compare with.</p>;
  }
  if (current.isLoading || previous.isLoading) return <LoadingState label="Loading changes..." className="p-2" />;
  const error = current.error ?? previous.error;
  if (error) return <InlineAlert>{getErrorMessage(error)}</InlineAlert>;

  const a = previous.data;
  const b = current.data;
  if (!a?.content_available || !b?.content_available) {
    return (
      <InlineAlert variant="warning">
        No comparison possible: the content of {!b?.content_available ? `revision ${revisionId}` : `revision ${parentId}`} is
        not available (it was written into the shared legacy blob by an older client, or removed).
      </InlineAlert>
    );
  }
  return <DiffView before={a.content} after={b.content} />;
}
