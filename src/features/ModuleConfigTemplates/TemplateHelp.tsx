import type { ReactNode } from "react";

const tone = {
  variable: "bg-green-100 text-green-900",
  device: "bg-blue-100 text-blue-900",
  endpoint: "bg-purple-100 text-purple-900",
  ref: "bg-violet-200 text-violet-950",
  plain: "bg-slate-200 text-slate-900",
  invalid: "bg-red-100 text-red-900",
};

const C = ({ t, children }: { t: keyof typeof tone; children: string }) => (
  <code className={`whitespace-nowrap rounded px-1 ${tone[t]}`}>{children}</code>
);

type Row = [ReactNode, ReactNode, ReactNode];

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <>
      <tr><td colSpan={3} className="pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</td></tr>
      {rows.map((r, i) => (
        <tr key={i} className="border-b border-border/50 align-top last:border-0">
          <td className="py-1.5 pr-4">{r[0]}</td><td className="py-1.5 pr-4">{r[1]}</td><td className="py-1.5 text-muted-foreground">{r[2]}</td>
        </tr>
      ))}
    </>
  );
}

/** Collapsible cheat sheet of what a template or block body may contain, simplest forms first. */
export default function TemplateHelp({ kind }: { kind: "template" | "block" }) {
  return (
    <details className="group rounded-md border bg-muted/20 text-sm">
      <summary className="cursor-pointer select-none px-3 py-2 font-medium">What can I write?
        <span className="ml-2 font-normal text-muted-foreground">Tip: use Insert in the editor toolbar, and hover a highlighted part to see what it does.</span>
      </summary>
      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-muted-foreground"><th className="py-1 pr-4 font-medium">You write</th><th className="py-1 pr-4 font-medium">Becomes</th><th className="py-1 font-medium">Asked when applying</th></tr>
          </thead>
          <tbody>
            <Section title="Values typed in" rows={[
              [<C t="variable">{"${speed}"}</C>, <>the value typed in; it appears under <b>Variables</b> by itself, where you set its type</>, <>a field “speed”</>],
            ]} />
            <Section title="From the device" rows={[
              [<C t="device">{"${device.city}"}</C>, "a field of the device's metadata", "nothing"],
            ]} />
            <Section title="From a machine (endpoint) on the device" rows={[
              [<C t="endpoint">{"${endpoint.ip}"}</C>, "IP of the chosen endpoint (also .name, or any field of it)", "an endpoint dropdown"],
              [<C t="endpoint">{"${service.port}"}</C>, "port of a service on that endpoint", "a service dropdown under it"],
              [<><C t="endpoint">{"${endpoint[plc].ip}"}</C><br /><C t="endpoint">{"${service[plc].port}"}</C></>,
               "the same, when you need more than one endpoint: give each a name", "one dropdown per name"],
            ]} />
            <Section title="Reusable parts" rows={[
              [<C t="ref">{'{ "$ref": "Client" }'}</C>, "the content of the block “Client”", "the block's own inputs"],
              ...(kind === "template" ? [[
                <C t="ref">{'{ "$list": ["ClientA", "ClientB"], "$label": "Client" }'}</C>,
                "one entry per client the user adds, each one of these blocks; $label is optional",
                <>“+ Add client”, then a card per client</>,
              ] as Row] : []),
            ]} />
            <Section title="Other" rows={[
              [<C t="plain">{"$${"}</C>, <>the literal text <code>{"${"}</code></>, "nothing"],
              [<C t="invalid">{"${typo}"}</C>, "red: not declared or not valid; hover it to see why", "—"],
            ]} />
          </tbody>
        </table>
        {kind === "block" && <p className="mt-2 text-xs text-muted-foreground">Blocks cannot contain lists. Each use of a block gets its own inputs.</p>}
      </div>
    </details>
  );
}
