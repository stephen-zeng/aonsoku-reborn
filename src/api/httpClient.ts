import omit from "lodash/omit";
import { markServerUnreachable } from "@/app/hooks/use-network-status";
import { useAppStore } from "@/store/app.store";
import type { CoverArt } from "@/types/coverArtType";
import { AppRequestError } from "./errors";
import {
  buildUrl,
  buildAvatarUrl as _buildAvatarUrl,
  buildCoverArtUrl as _buildCoverArtUrl,
  buildSongStreamUrl as _buildSongStreamUrl,
  type ServerAuthConfig,
} from "./urlBuilder";

export type { ServerAuthConfig } from "./urlBuilder";

export type QueryType = Record<string, string | number | undefined>;

export interface FetchOptions extends RequestInit {
  query?: QueryType;
}

function getAuthConfig(): ServerAuthConfig {
  const { url, username, password, authType, protocolVersion } =
    useAppStore.getState().data;
  return { url, username, password, authType, protocolVersion };
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
    } catch {
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
      markServerUnreachable();
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
  const url = buildUrl(
    path,
    getAuthConfig(),
    options.query as Record<string, string | number | undefined>,
  );

  try {
    const init = omit(options, "query");

    return await browserFetch<T>(url, init);
  } catch (error) {
    console.error("Error on httpClient request", error);

    throw error;
  }
}

export function getAvatarUrl(username: string, size?: string): string {
  return _buildAvatarUrl(getAuthConfig(), username, size);
}

export function getCoverArtUrl(
  id?: string,
  type: CoverArt = "album",
  size = "300",
): string {
  return _buildCoverArtUrl(getAuthConfig(), id, type, size);
}

export function getSongStreamUrl(
  id: string,
  maxBitRate?: string,
  format?: string,
) {
  return _buildSongStreamUrl(getAuthConfig(), id, maxBitRate, format);
}
