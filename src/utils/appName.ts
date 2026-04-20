import { repository, version } from "@/../package.json";

export const appName = "Aonsoku";

const globalValues = globalThis as Record<string, unknown>;

export const buildHash: string =
  typeof globalValues.__BUILD_HASH__ === "string"
    ? (globalValues.__BUILD_HASH__ as string)
    : "dev";

export const buildTime: number =
  typeof globalValues.__BUILD_TIME__ === "number"
    ? (globalValues.__BUILD_TIME__ as number)
    : 0;
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
