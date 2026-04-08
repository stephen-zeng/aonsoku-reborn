import { repository, version } from "@/../package.json";

export const appName = "Aonsoku";

export const buildHash: string = __BUILD_HASH__;
export const buildTime: number = __BUILD_TIME__;
const formattedBuildTime =
  buildTime > 0 ? new Date(buildTime).toLocaleString() : "dev";

export function getAppInfo() {
  return {
    name: appName,
    version,
    buildHash,
    buildTime: formattedBuildTime,
    url: repository.url,
  };
}

export const lrclibClient = `${appName} v${version} (${repository.url})`;
