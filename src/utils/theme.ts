import { isDesktop } from "./desktop";
import { hslToHex, hslToHsla, isDarkHex } from "./getAverageColor";

const DEFAULT_TITLE_BAR_COLOR = "#ff000000";
const DEFAULT_TITLE_BAR_SYMBOL = "#ffffff";

export function setDesktopTitleBarColors(
  transparent = false,
  overrideColor?: string,
) {
  if (!isDesktop()) return;

  let color = DEFAULT_TITLE_BAR_COLOR;
  let symbol = DEFAULT_TITLE_BAR_SYMBOL;

  const root = window.document.documentElement;
  const styles = getComputedStyle(root);

  if (!transparent) {
    symbol = hslToHsla(styles.getPropertyValue("--foreground").trim());
    color = hslToHsla(styles.getPropertyValue("--background").trim());
  } else if (overrideColor) {
    symbol = isDarkHex(overrideColor) ? "#ffffff" : "#000000";
  }

  const bgColor =
    overrideColor || hslToHex(styles.getPropertyValue("--background").trim());

  window.api.setTitleBarOverlayColors({
    color,
    symbol,
    bgColor,
  });
}

let themeColorMeta: Element | null = null;

export function updatePwaThemeColor(overrideColor?: string) {
  let color = overrideColor;

  if (!color) {
    const bgHsl = getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim();

    if (!bgHsl) return;

    color = hslToHex(bgHsl);
  }

  if (!themeColorMeta) {
    themeColorMeta =
      document.querySelector('meta[name="theme-color"]') ??
      Object.assign(document.createElement("meta"), { name: "theme-color" });
    document.head.appendChild(themeColorMeta);
  }

  if (themeColorMeta.getAttribute("content") !== color) {
    themeColorMeta.setAttribute("content", color);
  }
}
