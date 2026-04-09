import omit from "lodash/omit";
import { useAppStore } from "@/store/app.store";
import { CoverArt } from "@/types/coverArtType";
import { appName } from "@/utils/appName";
import { authQueryParams } from "./auth";
import { AppRequestError } from "./errors";

export type QueryType = Record<string, string | number | undefined>;

export interface FetchOptions extends RequestInit {
  query?: QueryType;
}

function queryParams() {
  const { username, password, authType, protocolVersion } =
    useAppStore.getState().data;

  return {
    ...authQueryParams(username, password, authType),
    v: protocolVersion || "1.16.0",
    c: appName,
    f: "json",
  };
}

function getUrl(path: string, options?: QueryType) {
  const serverUrl = useAppStore.getState().data.url;
  const params = new URLSearchParams(queryParams());

  if (options) {
    Object.keys(options).forEach((key) => {
      const query = options[key];

      if (query !== undefined) {
        params.append(key, query.toString());
      }
    });
  }

  const queries = params.toString();
  const pathWithoutSlash = path.startsWith("/") ? path.substring(1) : path;
  let url = `${serverUrl}/rest/${pathWithoutSlash}`;
  url += path.includes("?") ? "&" : "?";
  url += queries;

  return url;
}

async function browserFetch<T>(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new AppRequestError("http_error", `HTTP ${response.status}`, {
        status: response.status,
        url,
      });
    }

    let data: Record<string, unknown>;

    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch (_error) {
      throw new AppRequestError("parse_error", "Failed to parse response", {
        url,
      });
    }

    const parsed = data["subsonic-response"] as
      | (T & { status?: string; error?: { message?: string } })
      | undefined;

    if (!parsed) {
      throw new AppRequestError(
        "parse_error",
        "Missing subsonic response payload",
        { url },
      );
    }

    if (parsed.status === "failed") {
      throw new AppRequestError(
        "server_error",
        parsed.error?.message || "Server returned a failed response",
        { url },
      );
    }

    return {
      count: parseInt(response.headers.get("x-total-count") || "0", 10),
      data: parsed as T,
    };
  } catch (error) {
    if (error instanceof AppRequestError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new AppRequestError(
        "network_unreachable",
        "The configured server is unreachable",
        { url },
      );
    }

    throw new AppRequestError("server_error", "Unexpected request error", {
      url,
    });
  }
}

export async function httpClient<T>(
  path: string,
  options: FetchOptions,
): Promise<{ count: number; data: T }> {
  const url = getUrl(path, options.query);

  try {
    const init = omit(options, "query");

    return await browserFetch<T>(url, init);
  } catch (error) {
    console.error("Error on httpClient request", error);

    throw error;
  }
}

export function getCoverArtUrl(
  id?: string,
  type: CoverArt = "album",
  size = "300",
): string {
  if (!id) {
    // everything except artists uses the same default cover art
    type = type === "artist" ? "artist" : "album";
    return `/default_${type}_art.png`;
  }
  return getUrl("getCoverArt", {
    id,
    size,
  });
}

export function getSongStreamUrl(
  id: string,
  maxBitRate?: string,
  format?: string,
) {
  return getUrl("stream", {
    id,
    maxBitRate,
    format,
    estimateContentLength: "true",
  });
}

export function getDownloadUrl(id: string, maxBitRate = "0", format = "raw") {
  return getUrl("download", {
    id,
    maxBitRate,
    format,
  });
}
