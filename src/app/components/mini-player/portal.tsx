import { PropsWithChildren, useEffect } from "react";
import { createPortal } from "react-dom";
import { appThemes } from "@/app/observers/theme-observer";
import { useTheme } from "@/store/theme.store";
import { Theme } from "@/types/themeContext";

type PortalProps = PropsWithChildren<{
  pipWindow: Window | null;
}>;

export function MiniPlayerPortal({ pipWindow, children }: PortalProps) {
  const { theme } = useTheme();

  useEffect(() => {
    if (pipWindow) {
      setAppTheme(theme, pipWindow);
    }
  }, [pipWindow, theme]);

  useEffect(() => {
    if (!pipWindow) return;

    syncHead(pipWindow);
  }, [pipWindow]);

  if (!pipWindow) return null;

  return createPortal(children, pipWindow.document.body);
}

function setAppTheme(theme: Theme, pipWindow: Window) {
  pipWindow.document.documentElement.classList.remove(...appThemes);

  pipWindow.document.documentElement.classList.add(theme);
}

function syncHead(pipWindow: Window) {
  const pipDocument = pipWindow.document;
  pipDocument.head.replaceChildren();

  const charset = document.querySelector<HTMLMetaElement>("meta[charset]");
  if (charset) {
    pipDocument.head.appendChild(charset.cloneNode(true));
  }

  const viewport = document.querySelector<HTMLMetaElement>(
    'meta[name="viewport"]',
  );
  if (viewport) {
    pipDocument.head.appendChild(viewport.cloneNode(true));
  }

  const title = pipDocument.createElement("title");
  title.textContent = document.title;
  pipDocument.head.appendChild(title);

  for (const styleSheet of Array.from(document.styleSheets)) {
    copyStyleSheet(styleSheet, pipDocument);
  }
}

function copyStyleSheet(styleSheet: CSSStyleSheet, pipDocument: Document) {
  try {
    const cssRules = Array.from(styleSheet.cssRules)
      .map((rule) => rule.cssText)
      .join("\n");
    const style = pipDocument.createElement("style");
    style.textContent = cssRules;
    pipDocument.head.appendChild(style);
    return;
  } catch {
    if (!styleSheet.href) return;
  }

  const link = pipDocument.createElement("link");
  link.rel = "stylesheet";
  link.href = styleSheet.href;
  link.media = styleSheet.media.mediaText;
  pipDocument.head.appendChild(link);
}
