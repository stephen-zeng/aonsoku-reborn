import { MD5 } from "crypto-js";
import { AuthType } from "@/types/serverConfig";

export const saltWord = "40n50kuPl4y3r";

const configSource =
  typeof window !== "undefined"
    ? (window as Record<string, unknown>)
    : ({} as Record<string, unknown>);

const SERVER_URL = configSource.SERVER_URL as string | undefined;
const HIDE_SERVER = configSource.HIDE_SERVER as string | boolean | undefined;
const APP_USER = configSource.APP_USER as string | undefined;
const APP_PASSWORD = configSource.APP_PASSWORD as string | undefined;
const APP_AUTH_TYPE = configSource.APP_AUTH_TYPE as string | undefined;

export const hasValidConfig = Boolean(
  SERVER_URL && HIDE_SERVER && APP_USER && APP_PASSWORD && APP_AUTH_TYPE,
);

export function getAuthType() {
  if (!hasValidConfig) return AuthType.TOKEN;

  if (APP_AUTH_TYPE === "token") return AuthType.TOKEN;
  if (APP_AUTH_TYPE === "password") return AuthType.PASSWORD;

  return AuthType.TOKEN;
}

export function genUser() {
  if (!hasValidConfig) return "";

  return APP_USER as string;
}

export function genPassword() {
  if (!hasValidConfig) return "";

  const authType = getAuthType();
  const password = APP_PASSWORD as string;

  if (authType === AuthType.TOKEN) return genPasswordToken(password);
  if (authType === AuthType.PASSWORD) return genEncodedPassword(password);

  return "";
}

export function genPasswordToken(password: string) {
  return MD5(`${password}${saltWord}`).toString();
}

export function genEncodedPassword(password: string) {
  return `enc:${toHex(password)}`;
}

export function toHex(s: string) {
  return s
    .split("")
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
}

export function fromHex(hex: string) {
  const result = new Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    result[i >> 1] = String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }
  return result.join("");
}

function isHexString(value: string): boolean {
  return value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value);
}

export function decodeStoredPassword(raw: string): string {
  return isHexString(raw) ? fromHex(raw) : raw;
}
