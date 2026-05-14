import { describe, expect, it } from "vitest";
import { AuthType } from "@/types/serverConfig";
import { authQueryParams } from "./auth";

describe("authQueryParams", () => {
  it("returns token auth params for AuthType.TOKEN", () => {
    const result = authQueryParams("admin", "secret123", AuthType.TOKEN);
    expect(result).toEqual({
      u: "admin",
      t: "secret123",
      s: "40n50kuPl4y3r",
    });
  });

  it("returns password auth params for AuthType.PASSWORD", () => {
    const result = authQueryParams("admin", "mypassword", AuthType.PASSWORD);
    expect(result).toEqual({
      u: "admin",
      p: "mypassword",
    });
  });

  it("throws for null auth type", () => {
    expect(() => authQueryParams("admin", "pass", null)).toThrow(
      "Invalid/unspecified auth type",
    );
  });

  it("handles empty username gracefully", () => {
    const result = authQueryParams("", "pass", AuthType.PASSWORD);
    expect(result).toEqual({ u: "", p: "pass" });
  });

  it("handles undefined-like values by defaulting to empty string", () => {
    const result = authQueryParams(
      null as unknown as string,
      null as unknown as string,
      AuthType.PASSWORD,
    );
    expect(result).toEqual({ u: "", p: "" });
  });
});
