import { useMemo } from "react";
import { useContributions, type Contribution } from "./useExtensionUi";

export const contributionPath = (c: Contribution) =>
  c.path ??
  (c.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "page");

/** Nav entries for the tabs or pages extensions contribute; `to` is relative for tabs, absolute for pages. */
export function useNavContributions(
  target: "device" | "global" | "module",
  placement: "tab" | "page",
  context?: object
): Array<{ label: string; to: string }> {
  const { contributions } = useContributions(target, placement, context as Record<string, unknown> | undefined);
  return useMemo(
    () =>
      contributions.map((c) => ({
        label: c.label,
        to: `${placement === "page" ? "/" : ""}x/${c.extension}/${contributionPath(c)}`,
      })),
    [contributions, placement]
  );
}
