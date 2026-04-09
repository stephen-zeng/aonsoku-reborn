import { AuthType } from "@/types/serverConfig";
import { saltWord } from "@/utils/salt";

export type AuthParams =
  | { u: string; t: string; s: string }
  | { u: string; p: string };

export function authQueryParams(
  username: string,
  password: string,
  authType: AuthType | null,
): AuthParams {
  if (authType === AuthType.TOKEN) {
    return {
      u: username ?? "",
      t: password ?? "",
      s: saltWord,
    };
  }

  if (authType === AuthType.PASSWORD) {
    return {
      u: username ?? "",
      p: password ?? "",
    };
  }

  throw new Error("Invalid/unspecified auth type");
}
