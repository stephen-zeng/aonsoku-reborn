import { describe, expect, it } from "vitest";
import {
  AppRequestError,
  isAppRequestError,
  isReachabilityError,
} from "./errors";

describe("AppRequestError", () => {
  it("sets kind, message, and name", () => {
    const err = new AppRequestError("http_error", "Bad request");
    expect(err.name).toBe("AppRequestError");
    expect(err.kind).toBe("http_error");
    expect(err.message).toBe("Bad request");
  });

  it("captures status and url from options", () => {
    const err = new AppRequestError("http_error", "Not found", {
      status: 404,
      url: "https://example.com/api",
    });
    expect(err.status).toBe(404);
    expect(err.url).toBe("https://example.com/api");
  });

  it("defaults status and url to undefined", () => {
    const err = new AppRequestError("parse_error", "Parse failed");
    expect(err.status).toBeUndefined();
    expect(err.url).toBeUndefined();
  });

  it("is an instance of Error", () => {
    const err = new AppRequestError("network_unreachable", "Offline");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppRequestError);
  });
});

describe("isAppRequestError", () => {
  it("returns true for AppRequestError", () => {
    const err = new AppRequestError("server_error", "fail");
    expect(isAppRequestError(err)).toBe(true);
  });

  it("returns false for plain Error", () => {
    expect(isAppRequestError(new Error("fail"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isAppRequestError(null)).toBe(false);
    expect(isAppRequestError("string")).toBe(false);
    expect(isAppRequestError(42)).toBe(false);
  });
});

describe("isReachabilityError", () => {
  it("returns true for network_unreachable AppRequestError", () => {
    const err = new AppRequestError("network_unreachable", "Offline");
    expect(isReachabilityError(err)).toBe(true);
  });

  it("returns false for other AppRequestError kinds", () => {
    const err = new AppRequestError("http_error", "Bad");
    expect(isReachabilityError(err)).toBe(false);
  });

  it("returns false for non-AppRequestError", () => {
    expect(isReachabilityError(new Error("Offline"))).toBe(false);
  });
});
