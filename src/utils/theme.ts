import { isDesktop } from "./desktop";
import { hslToHex, hslToHsla } from "./getAverageColor";

const DEFAULT_TITLE_BAR_COLOR = "#ff000000";
const DEFAULT_TITLE_BAR_SYMBOL = "#ffffff";

export function setDesktopTitleBarColors(transparent = false) {
  if (!isDesktop()) return;

  let color = DEFAULT_TITLE_BAR_COLOR;
  let symbol = DEFAULT_TITLE_BAR_SYMBOL;

  const root = window.document.documentElement;
  const styles = getComputedStyle(root);

  if (!transparent) {
    symbol = hslToHsla(styles.getPropertyValue("--foreground").trim());
    color = hslToHsla(styles.getPropertyValue("--background").trim());
  }

  const bgColor = hslToHex(styles.getPropertyValue("--background").trim());

  window.api.setTitleBarOverlayColors({
    color,
    symbol,
    bgColor,
  });
}

let themeColorMeta: Element | null = null;

export function updatePwaThemeColor() {
  const bgHsl = getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim();

  if (!bgHsl) return;

  const color = hslToHex(bgHsl);

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
