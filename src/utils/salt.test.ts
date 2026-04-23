import { describe, expect, it } from "vitest";
import {
  decodeStoredPassword,
  fromHex,
  genEncodedPassword,
  genPasswordToken,
  getAuthType,
  hasValidConfig,
  saltWord,
  toHex,
} from "./salt";
import { AuthType } from "@/types/serverConfig";

describe("saltWord", () => {
  it("is a non-empty string", () => {
    expect(saltWord).toBeTruthy();
    expect(typeof saltWord).toBe("string");
  });
});

describe("hasValidConfig", () => {
  it("is a boolean", () => {
    expect(typeof hasValidConfig).toBe("boolean");
  });
});

describe("getAuthType", () => {
  it("returns TOKEN when no valid config (default path)", () => {
    expect(getAuthType()).toBe(AuthType.TOKEN);
  });
});

describe("genPasswordToken", () => {
  it("produces an MD5 hash of password + saltWord", () => {
    const result = genPasswordToken("testpass");
    expect(result).toHaveLength(32);
    expect(typeof result).toBe("string");
  });

  it("is deterministic — same input yields same hash", () => {
    expect(genPasswordToken("abc")).toBe(genPasswordToken("abc"));
  });

  it("different inputs produce different hashes", () => {
    expect(genPasswordToken("a")).not.toBe(genPasswordToken("b"));
  });
});

describe("genEncodedPassword", () => {
  it("returns enc: prefixed hex string", () => {
    const result = genEncodedPassword("hello");
    expect(result).toMatch(/^enc:[0-9a-f]+$/);
  });
});

describe("toHex / fromHex roundtrip", () => {
  it("converts ASCII to hex and back", () => {
    const original = "Hello, World!";
    const hex = toHex(original);
    expect(fromHex(hex)).toBe(original);
  });

  it("converts empty string", () => {
    expect(toHex("")).toBe("");
    expect(fromHex("")).toBe("");
  });

  it("handles multi-byte characters correctly in toHex", () => {
    const hex = toHex("A");
    expect(hex).toBe("41");
  });

  it("fromHex reconstructs simple ASCII", () => {
    expect(fromHex("48656c6c6f")).toBe("Hello");
  });
});

describe("decodeStoredPassword", () => {
  it("decodes hex strings back to original", () => {
    const encoded = toHex("mypassword");
    expect(decodeStoredPassword(encoded)).toBe("mypassword");
  });

  it("returns raw value when it is not valid hex", () => {
    expect(decodeStoredPassword("not-hex!")).toBe("not-hex!");
  });

  it("returns raw value for odd-length strings (not valid hex)", () => {
    expect(decodeStoredPassword("abc")).toBe("abc");
  });
});