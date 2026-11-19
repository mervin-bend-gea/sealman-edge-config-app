import { useEffect } from "react";
import { DEFAULT_APP_TITLE, DEFAULT_FAVICON, useActiveBranding } from "./appearanceStore";
import { refreshBranding } from "./brandingApi";
import { resolveThemeCss } from "./themes";

const STYLE_ELEMENT_ID = "sealman-theme";

/** Injects the selected theme as an unlayered stylesheet, which overrides the layered defaults in index.css. */
export default function AppearanceStyles() {
  const { themeId, variables, appTitle, faviconUrl } = useActiveBranding();
  const css = resolveThemeCss(themeId, variables);

  useEffect(() => {
    void refreshBranding();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshBranding();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    document.title = appTitle.trim() || DEFAULT_APP_TITLE;
  }, [appTitle]);

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = faviconUrl ?? DEFAULT_FAVICON;
  }, [faviconUrl]);

  useEffect(() => {
    let element = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (!css) {
      element?.remove();
      return;
    }
    if (!element) {
      element = document.createElement("style");
      element.id = STYLE_ELEMENT_ID;
      document.head.appendChild(element);
    }
    element.textContent = css;
  }, [css]);

  return null;
}
