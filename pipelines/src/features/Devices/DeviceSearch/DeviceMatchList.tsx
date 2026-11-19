import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DeviceSearchMatch } from "@/generated/edge-administration/hooks/devices/useSearchDevices";
import { getDeviceSearchJumpPath, splitByTerm } from "./deviceSearch";

const KIND_LABEL: Record<DeviceSearchMatch["kind"], string> = {
  device_id: "Device ID",
  metadata: "Metadata",
  endpoint: "Endpoint",
  service: "Service",
};

function Highlighted({ text, term }: { text: string; term: string }) {
  return (
    <>
      {splitByTerm(text, term).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-xs bg-yellow-200 px-0.5 text-inherit">
            {part.text}
          </mark>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

function matchTitle(match: DeviceSearchMatch): string | null {
  if (match.kind === "endpoint") return match.endpoint_name ?? match.type_label ?? null;
  if (match.kind === "service") {
    const owner = match.endpoint_name ? ` on ${match.endpoint_name}` : "";
    return `${match.type_label ?? "Service"}${owner}`;
  }
  return null;
}

/** Why a device matched the search: one entry per match, each with a "Jump to Page" button. */
export default function DeviceMatchList({
  deviceId,
  matches,
  term,
}: {
  deviceId: string;
  matches: DeviceSearchMatch[];
  term: string;
}) {
  const navigate = useNavigate();

  return (
    <ul className="divide-y" aria-label={`Matches in device ${deviceId}`}>
      {matches.map((match, index) => {
        const title = matchTitle(match);
        return (
          <li key={`${match.kind}:${match.service_id ?? match.endpoint_id ?? ""}:${index}`} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{KIND_LABEL[match.kind]}</Badge>
                {title && <span className="truncate text-sm font-medium">{title}</span>}
              </div>
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {match.fields.map((field, fieldIndex) => (
                  <div key={`${field.key ?? "type"}:${fieldIndex}`} className="flex gap-1.5">
                    <dt className="text-muted-foreground">{field.label}:</dt>
                    <dd className="break-all">
                      <Highlighted text={field.value} term={term} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              aria-label={`Jump to ${KIND_LABEL[match.kind]} page of device ${deviceId}`}
              onClick={(e) => {
                e.stopPropagation();
                navigate(getDeviceSearchJumpPath(deviceId, match));
              }}
            >
              Jump to Page
              <ArrowRightIcon />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
