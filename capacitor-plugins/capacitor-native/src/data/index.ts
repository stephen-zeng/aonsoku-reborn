import { registerPlugin } from "@capacitor/core";
import type { AonsokuNativeDataPlugin } from "./definitions";
import { NATIVE_DATA_PLUGIN_NAME } from "./definitions";

export * from "./definitions";

export const AonsokuNativeData = registerPlugin<AonsokuNativeDataPlugin>(
  NATIVE_DATA_PLUGIN_NAME,
);
