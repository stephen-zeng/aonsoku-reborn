import { describe, expect, it } from "vitest";
import { formatBytes } from "./formatBytes";

describe("formatBytes", () => {
  it("returns 0 Bytes for zero", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500.00 Bytes");
  });

  it("formats KiB", () => {
    expect(formatBytes(1024)).toBe("1.00 KiB");
  });

  it("formats MiB", () => {
    expect(formatBytes(1048576)).toBe("1.00 MiB");
  });

  it("formats GiB", () => {
    expect(formatBytes(1073741824)).toBe("1.00 GiB");
  });

  it("respects custom decimals", () => {
    expect(formatBytes(1536, 0)).toBe("2 KiB");
  });

  it("handles negative decimals as at least 0", () => {
    const result = formatBytes(1024, -1);
    expect(result).toBe("1 KiB");
  });

  it("formats fractional KiB", () => {
    expect(formatBytes(1536)).toBe("1.50 KiB");
  });
});