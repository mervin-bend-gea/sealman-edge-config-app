import { edgeConfigApiInstance } from "@/api/edgeConfig/edgeConfigApi";
import useAppearanceStore, { type Branding } from "./appearanceStore";
import type { ThemeVariables } from "./themes";

export type BrandingAssetKind = "logo" | "favicon";

interface BrandingDto {
  theme_id: string;
  variables: ThemeVariables;
  app_title: string;
  logo_version?: string | null;
  favicon_version?: string | null;
}

const API_URI = import.meta.env.VITE_API_URI;

const assetUrl = (kind: BrandingAssetKind, version?: string | null) =>
  version ? `${API_URI}/public/branding/${kind}?v=${encodeURIComponent(version)}` : null;

function toBranding(dto: BrandingDto): Branding {
  return {
    themeId: dto.theme_id,
    variables: dto.variables ?? {},
    appTitle: dto.app_title ?? "",
    logoUrl: assetUrl("logo", dto.logo_version),
    faviconUrl: assetUrl("favicon", dto.favicon_version),
  };
}

const publish = (dto: BrandingDto) => useAppearanceStore.getState().setPublished(toBranding(dto));

/** Loads the public branding (no sign-in needed); keeps the cached one if the API is unreachable. */
export async function refreshBranding(): Promise<void> {
  try {
    const response = await fetch(`${API_URI}/public/branding`);
    if (response.ok) publish(await response.json());
  } catch {
    // Offline or API down: the locally cached branding stays in place.
  }
}

export async function saveBranding(branding: Pick<Branding, "themeId" | "variables" | "appTitle">): Promise<void> {
  const { data } = await edgeConfigApiInstance.put<BrandingDto>("/platform/branding", {
    theme_id: branding.themeId,
    variables: branding.variables,
    app_title: branding.appTitle,
  });
  publish(data);
}

export async function uploadBrandingAsset(kind: BrandingAssetKind, file: Blob): Promise<void> {
  const { data } = await edgeConfigApiInstance.put<BrandingDto>(`/platform/branding/${kind}`, file, {
    headers: { "Content-Type": "application/octet-stream" },
  });
  publish(data);
}

export async function deleteBrandingAsset(kind: BrandingAssetKind): Promise<void> {
  const { data } = await edgeConfigApiInstance.delete<BrandingDto>(`/platform/branding/${kind}`);
  publish(data);
}
