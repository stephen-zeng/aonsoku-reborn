import { removeSlashFromUrl } from "./removeSlashFromUrl";

export function normalizeServerUrl(url: string) {
  return removeSlashFromUrl(url.trim());
}

export function isValidServerUrl(url: string) {
  try {
    const parsed = new URL(url);

    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
}
