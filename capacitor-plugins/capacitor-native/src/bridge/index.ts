import { registerPlugin } from "@capacitor/core";
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
import { AonsokuNativeBridgeWeb } from "./web";

export const AonsokuNativeBridge = registerPlugin<AonsokuNativeBridgePlugin>(
  NATIVE_BRIDGE_PLUGIN_NAME,
  {
    web: () => new AonsokuNativeBridgeWeb(),
  },
);

export { AonsokuNativeBridgeWeb } from "./web";
export { NATIVE_BRIDGE_PLUGIN_NAME };
export type {
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
};
