import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "react-toastify";
import { CheckIcon } from "@heroicons/react/24/solid";
import PageTitle from "@/components/Typography/PageTitle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import defaultLogo from "@/assets/sealman_logo.png";
import { getErrorMessage } from "@/lib/errors";
import { usePermissions } from "@/features/authorization/permissions/use-permissions";
import { PERMISSION_KEYS } from "@/features/authorization/permissions/permission-keys";
import useAppearanceStore, {
  DEFAULT_APP_TITLE,
  DEFAULT_FAVICON,
  type Branding,
} from "@/features/Appearance/appearanceStore";
import {
  deleteBrandingAsset,
  saveBranding,
  uploadBrandingAsset,
  type BrandingAssetKind,
} from "@/features/Appearance/brandingApi";
import {
  CUSTOM_THEME_ID,
  DEFAULT_THEME_ID,
  THEME_PRESETS,
  getThemePreset,
  hexToHsl,
  hslToHex,
  parseCssVariables,
  resolveThemeVariables,
  themeToCss,
  type ThemeVariables,
} from "@/features/Appearance/themes";

const COLOR_GROUPS: { title: string; colors: { name: string; label: string }[] }[] = [
  {
    title: "Navigation",
    colors: [
      { name: "--nav", label: "Sidebar background" },
      { name: "--nav-foreground", label: "Sidebar text" },
      { name: "--nav-active", label: "Sidebar active item" },
      { name: "--nav-active-foreground", label: "Sidebar active text" },
    ],
  },
  {
    title: "Header",
    colors: [
      { name: "--header-from", label: "Gradient left" },
      { name: "--header-via", label: "Gradient middle" },
      { name: "--header-to", label: "Gradient right" },
      { name: "--header-border", label: "Bottom border" },
    ],
  },
  {
    title: "Content",
    colors: [
      { name: "--primary", label: "Primary (buttons, links)" },
      { name: "--primary-foreground", label: "Text on primary" },
      { name: "--page", label: "Page background" },
      { name: "--background", label: "Card / panel background" },
      { name: "--foreground", label: "Text" },
      { name: "--muted-foreground", label: "Secondary text" },
      { name: "--accent", label: "Hover highlight" },
      { name: "--border", label: "Borders" },
      { name: "--destructive", label: "Danger / delete" },
    ],
  },
];

// Client-side checks are for quick feedback only; the API validates the actual file content.
const ASSET_RULES: Record<BrandingAssetKind, { types: string[]; maxBytes: number; label: string }> = {
  logo: { types: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"], maxBytes: 512 * 1024, label: "PNG, JPEG, SVG or WebP" },
  favicon: { types: ["image/x-icon", "image/vnd.microsoft.icon", "image/png", "image/svg+xml"], maxBytes: 128 * 1024, label: "ICO, PNG or SVG" },
};

type AssetDraft = { action: "keep" } | { action: "upload"; file: File; previewUrl: string } | { action: "remove" };
type SettingsDraft = Pick<Branding, "themeId" | "variables" | "appTitle">;

const KEEP: AssetDraft = { action: "keep" };

const toDraft = (branding: Branding): SettingsDraft => ({
  themeId: branding.themeId,
  variables: branding.variables,
  appTitle: branding.appTitle,
});

const assetPreviewUrl = (draft: AssetDraft, publishedUrl: string | null) =>
  draft.action === "upload" ? draft.previewUrl : draft.action === "remove" ? null : publishedUrl;

function readImageFile(file: File, kind: BrandingAssetKind, onLoad: (draft: AssetDraft) => void) {
  const rules = ASSET_RULES[kind];
  // Some systems report .ico files without a MIME type.
  const type = file.type || (file.name.toLowerCase().endsWith(".ico") ? "image/x-icon" : "");
  if (!rules.types.includes(type)) {
    toast.error(`Unsupported file type. Use ${rules.label}.`);
    return;
  }
  if (file.size > rules.maxBytes) {
    toast.error(`The file must not be larger than ${rules.maxBytes / 1024} KB.`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onLoad({ action: "upload", file, previewUrl: reader.result as string });
  reader.onerror = () => toast.error("Could not read the file.");
  reader.readAsDataURL(file);
}

function Swatches({ variables }: { variables: ThemeVariables }) {
  return (
    <div className="flex gap-1">
      {["--nav", "--primary", "--accent", "--page"].map((name) => (
        <span
          key={name}
          className="h-5 w-5 rounded-full border"
          style={{ backgroundColor: `hsl(${variables[name]})` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function ThemeOption({
  name,
  description,
  selected,
  onSelect,
  disabled,
  variables,
}: {
  name: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  variables?: ThemeVariables;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`relative flex flex-col gap-3 rounded-lg border bg-card p-4 text-left shadow-xs transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed ${
        selected ? "border-primary ring-1 ring-primary" : ""
      }`}
    >
      {selected && <CheckIcon className="absolute right-3 top-3 h-4 w-4 text-primary" aria-hidden="true" />}
      {variables ? <Swatches variables={variables} /> : <span className="h-5 font-mono text-xs text-muted-foreground">{"{ css }"}</span>}
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function AssetPicker({
  kind,
  previewUrl,
  fallbackUrl,
  hasCustom,
  disabled,
  onChange,
  previewClassName,
  imageClassName,
}: {
  kind: BrandingAssetKind;
  previewUrl: string | null;
  fallbackUrl: string;
  hasCustom: boolean;
  disabled: boolean;
  onChange: (draft: AssetDraft) => void;
  previewClassName: string;
  imageClassName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) readImageFile(file, kind, onChange);
  };

  return (
    <>
      <span className={previewClassName}>
        <img className={imageClassName} src={previewUrl ?? fallbackUrl} alt={`Current ${kind}`} />
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={[...ASSET_RULES[kind].types, ...(kind === "favicon" ? [".ico"] : [])].join(",")}
        className="hidden"
        onChange={handleChange}
      />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
        Upload {kind === "logo" ? "logo" : "icon"}
      </Button>
      <Button type="button" variant="ghost" disabled={disabled || !hasCustom} onClick={() => onChange({ action: "remove" })}>
        Restore default
      </Button>
    </>
  );
}

export default function AppearanceSettings() {
  const published = useAppearanceStore((s) => s.published);
  const setPreview = useAppearanceStore((s) => s.setPreview);
  const { hasPermission: canWrite, isLoading: isPermissionLoading } = usePermissions({
    permissionKey: PERMISSION_KEYS.PLATFORM_CONFIG_WRITE,
  });
  const readOnly = isPermissionLoading || !canWrite;

  const [baseline, setBaseline] = useState(published);
  const [draft, setDraft] = useState<SettingsDraft>(() => toDraft(published));
  const [logo, setLogo] = useState<AssetDraft>(KEEP);
  const [favicon, setFavicon] = useState<AssetDraft>(KEEP);
  const [cssDraft, setCssDraft] = useState<string | null>(null);
  const [cssErrors, setCssErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isDirty =
    logo.action !== "keep" ||
    favicon.action !== "keep" ||
    JSON.stringify(draft) !== JSON.stringify(toDraft(baseline));

  // Pick up branding that arrives after mount (first load, other admin) unless the user is editing.
  useEffect(() => {
    if (isDirty || published === baseline) return;
    setBaseline(published);
    setDraft(toDraft(published));
  }, [published, baseline, isDirty]);

  const logoUrl = assetPreviewUrl(logo, published.logoUrl);
  const faviconUrl = assetPreviewUrl(favicon, published.faviconUrl);

  useEffect(() => {
    setPreview(isDirty ? { ...draft, logoUrl, faviconUrl } : null);
  }, [isDirty, draft, logoUrl, faviconUrl, setPreview]);
  useEffect(() => () => setPreview(null), [setPreview]);

  const isCustom = draft.themeId === CUSTOM_THEME_ID;
  const activeVariables = useMemo(
    () => resolveThemeVariables(draft.themeId, draft.variables),
    [draft.themeId, draft.variables],
  );

  const selectPreset = (themeId: string) => setDraft((d) => ({ ...d, themeId, variables: {} }));

  // Starts from the currently shown theme so the user only tweaks what they need.
  const selectCustom = () => setDraft((d) => ({ ...d, themeId: CUSTOM_THEME_ID, variables: activeVariables }));

  const setColor = (name: string, hex: string) =>
    setDraft((d) => ({
      ...d,
      themeId: CUSTOM_THEME_ID,
      variables: { ...activeVariables, [name]: hexToHsl(hex, activeVariables[name] ?? "") },
    }));

  const applyCss = () => {
    if (cssDraft === null) return;
    const { variables, errors } = parseCssVariables(cssDraft);
    setCssErrors(errors);
    if (errors.length) return;
    setDraft((d) => ({ ...d, themeId: CUSTOM_THEME_ID, variables: { ...activeVariables, ...variables } }));
  };

  const discard = () => {
    setDraft(toDraft(published));
    setBaseline(published);
    setLogo(KEEP);
    setFavicon(KEEP);
    setCssDraft(null);
    setCssErrors([]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveBranding(draft);
      for (const [kind, asset] of [["logo", logo], ["favicon", favicon]] as const) {
        if (asset.action === "upload") await uploadBrandingAsset(kind, asset.file);
        else if (asset.action === "remove") await deleteBrandingAsset(kind);
      }
      const latest = useAppearanceStore.getState().published;
      setBaseline(latest);
      setDraft(toDraft(latest));
      setLogo(KEEP);
      setFavicon(KEEP);
      toast.success("Appearance saved for all users");
    } catch (error) {
      toast.error(`Could not save appearance: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const disabled = readOnly || saving;

  return (
    <div className="space-y-8 pb-20">
      <PageTitle
        title="Appearance"
        description="Customize the colors, the header logo and the browser tab of the platform for all users."
      />

      {!isPermissionLoading && !canWrite && (
        <p className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
          You can view the appearance settings, but changing them requires the platform configuration write permission.
        </p>
      )}

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Theme</h3>
          <p className="text-sm text-muted-foreground">Pick a preset, then fine-tune individual colors below.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {THEME_PRESETS.map((preset) => (
            <ThemeOption
              key={preset.id}
              name={preset.name}
              description={preset.description}
              variables={preset.variables}
              selected={!isCustom && getThemePreset(draft.themeId).id === preset.id}
              onSelect={() => selectPreset(preset.id)}
              disabled={disabled}
            />
          ))}
          <ThemeOption
            name="Custom"
            description="Your own colors."
            selected={isCustom}
            onSelect={selectCustom}
            disabled={disabled}
          />
        </div>

        <div className="space-y-6 rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Click a color swatch to change it. You see changes immediately; other users see them after saving
            {isCustom ? "." : ". Changing a color turns the selected preset into a custom theme."}
          </p>
          {COLOR_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h4 className="text-sm font-semibold">{group.title}</h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {group.colors.map(({ name, label }) => {
                  const hex = hslToHex(activeVariables[name] ?? "");
                  return (
                    <label
                      key={name}
                      className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:bg-accent has-disabled:cursor-not-allowed"
                    >
                      <input
                        type="color"
                        value={hex ?? "#000000"}
                        disabled={!hex || disabled}
                        onChange={(e) => setColor(name, e.target.value)}
                        className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {!readOnly && (
            <details onToggle={(e) => e.currentTarget.open && setCssDraft(themeToCss(activeVariables))}>
              <summary className="cursor-pointer text-sm font-semibold">Advanced: edit theme variables</summary>
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Only the listed variables are allowed. Colors are HSL values (<code>hue saturation% lightness%</code>,
                  optionally <code>/ alpha</code>), <code>--radius</code> is a length in <code>rem</code> or <code>px</code>.
                </p>
                <Textarea
                  aria-label="Theme variables"
                  value={cssDraft ?? ""}
                  onChange={(e) => setCssDraft(e.target.value)}
                  spellCheck={false}
                  rows={18}
                  className="font-mono text-xs"
                />
                {cssErrors.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <p className="font-medium">These lines are not allowed or invalid:</p>
                    <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                      {cssErrors.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={disabled} onClick={applyCss}>
                    Apply to preview
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => setCssDraft(themeToCss(getThemePreset(DEFAULT_THEME_ID).variables))}
                  >
                    Load default template
                  </Button>
                </div>
              </div>
            </details>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Logo</h3>
          <p className="text-sm text-muted-foreground">Shown in the top left corner. PNG, JPEG, SVG or WebP, max. 512 KB.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
          <AssetPicker
            kind="logo"
            previewUrl={logoUrl}
            fallbackUrl={defaultLogo}
            hasCustom={Boolean(logoUrl)}
            disabled={disabled}
            onChange={setLogo}
            previewClassName="mr-3 flex h-14 w-60 items-center justify-center rounded-md border bg-linear-to-r from-header-from via-header-via to-header-to px-3"
            imageClassName="h-10 w-auto max-w-full object-contain"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Browser Tab</h3>
          <p className="text-sm text-muted-foreground">Title and icon shown in the browser tab.</p>
        </div>
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="appTitle" className="w-24">
              Title
            </Label>
            <Input
              id="appTitle"
              value={draft.appTitle}
              maxLength={80}
              placeholder={DEFAULT_APP_TITLE}
              disabled={disabled}
              onChange={(e) => setDraft((d) => ({ ...d, appTitle: e.target.value }))}
              className="w-80"
            />
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || !draft.appTitle}
              onClick={() => setDraft((d) => ({ ...d, appTitle: "" }))}
            >
              Restore default
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-24 text-sm font-medium">Icon</span>
            <AssetPicker
              kind="favicon"
              previewUrl={faviconUrl}
              fallbackUrl={DEFAULT_FAVICON}
              hasCustom={Boolean(faviconUrl)}
              disabled={disabled}
              onChange={setFavicon}
              previewClassName="flex h-10 w-10 items-center justify-center rounded-md border bg-background"
              imageClassName="h-6 w-6 object-contain"
            />
            <span className="text-xs text-muted-foreground">ICO, PNG or SVG, max. 128 KB. Square images work best.</span>
          </div>
        </div>
      </section>

      {isDirty && !readOnly && (
        <div className="sticky bottom-0 z-10 -mx-2 flex items-center justify-end gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
          <span className="mr-auto text-sm text-muted-foreground">
            Unsaved changes - only you see them until you save.
          </span>
          <Button type="button" variant="outline" disabled={saving} onClick={discard}>
            Discard
          </Button>
          <Button type="button" disabled={saving} onClick={save}>
            {saving ? "Saving..." : "Save for all users"}
          </Button>
        </div>
      )}
    </div>
  );
}
