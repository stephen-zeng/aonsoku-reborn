import { WebPlugin } from "@capacitor/core";
import type {
  AonsokuNativeBridgePlugin,
  APIRequestOptions,
  APIResponse,
  HasCredentialsResult,
  LoginOptions,
  LoginResult,
  PingOptions,
  PingResult,
  ServerInfoOptions,
  ServerInfoResult,
  StoredCredentials,
  StoreCredentialsOptions,
} from "./definitions";
import { NATIVE_BRIDGE_PLUGIN_NAME } from "./definitions";

function unavailable(method: string) {
  return new Error(
    `${NATIVE_BRIDGE_PLUGIN_NAME}.${method} is only available in Capacitor iOS.`,
  );
}

export class AonsokuNativeBridgeWeb
  extends WebPlugin
  implements AonsokuNativeBridgePlugin
{
  storeCredentials(_options: StoreCredentialsOptions): Promise<void> {
    return Promise.reject(unavailable("storeCredentials"));
  }

  getCredentials(): Promise<StoredCredentials | null> {
    return Promise.reject(unavailable("getCredentials"));
  }

  clearCredentials(): Promise<void> {
    return Promise.reject(unavailable("clearCredentials"));
  }

  hasCredentials(): Promise<HasCredentialsResult> {
    return Promise.reject(unavailable("hasCredentials"));
  }

  login(_options: LoginOptions): Promise<LoginResult> {
    return Promise.reject(unavailable("login"));
  }

  ping(_options: PingOptions): Promise<PingResult> {
    return Promise.reject(unavailable("ping"));
  }

  queryServerInfo(_options: ServerInfoOptions): Promise<ServerInfoResult> {
    return Promise.reject(unavailable("queryServerInfo"));
  }

  request(_options: APIRequestOptions): Promise<APIResponse> {
    return Promise.reject(unavailable("request"));
  }
}
