import { repository, version } from "@/../package.json";

export const appName = "Aonsoku";

export const buildHash: string = __BUILD_HASH__;

export function getAppInfo() {
  return {
    name: appName,
    version,
    buildHash,
    url: repository.url,
  };
}

export const lrclibClient = `${appName} v${version} (${repository.url})`;
