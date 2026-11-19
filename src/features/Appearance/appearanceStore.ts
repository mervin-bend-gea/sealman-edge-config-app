import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_THEME_ID, type ThemeVariables } from "./themes";

// Must match index.html.
export const DEFAULT_APP_TITLE = "GEA IIoT Platform";
export const DEFAULT_FAVICON = "/sealman.ico";

export interface Branding {
  themeId: string;
  /** Only used by the custom theme. */
  variables: ThemeVariables;
  /** Empty means DEFAULT_APP_TITLE. */
  appTitle: string;
  /** null means the bundled asset. */
  logoUrl: string | null;
  faviconUrl: string | null;
}

export const DEFAULT_BRANDING: Branding = {
  themeId: DEFAULT_THEME_ID,
  variables: {},
  appTitle: "",
  logoUrl: null,
  faviconUrl: null,
};

interface AppearanceState {
  /** Platform-wide branding from the API, cached locally so a reload doesn't flash the default look. */
  published: Branding;
  /** Unsaved draft from the Appearance settings page, shown only to the editing admin. */
  preview: Branding | null;
  setPublished: (branding: Branding) => void;
  setPreview: (branding: Branding | null) => void;
}

const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      published: DEFAULT_BRANDING,
      preview: null,
      setPublished: (published) => set({ published }),
      setPreview: (preview) => set({ preview }),
    }),
    { name: "sealman.branding", partialize: (state) => ({ published: state.published }) },
  ),
);

export const useActiveBranding = () => useAppearanceStore((s) => s.preview ?? s.published);

export default useAppearanceStore;
