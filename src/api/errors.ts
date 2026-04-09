export type AppRequestErrorKind =
  | "network_unreachable"
  | "http_error"
  | "parse_error"
  | "server_error";

interface AppRequestErrorOptions {
  status?: number;
  url?: string;
}

export class AppRequestError extends Error {
  kind: AppRequestErrorKind;
  status?: number;
  url?: string;

  constructor(
    kind: AppRequestErrorKind,
    message: string,
    options: AppRequestErrorOptions = {},
  ) {
    super(message);
    this.name = "AppRequestError";
    this.kind = kind;
    this.status = options.status;
    this.url = options.url;
  }
}

export function isAppRequestError(error: unknown): error is AppRequestError {
  return error instanceof AppRequestError;
}

export function isReachabilityError(error: unknown): boolean {
  return isAppRequestError(error) && error.kind === "network_unreachable";
}
