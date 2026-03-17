import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExec } from "./test-helpers.ts";
import { execOrThrow, execSafe } from "./exec.ts";

beforeEach(() => {
  mockExec.mockReset();
  mockExec.mockReturnValue("");
});

describe("execOrThrow", () => {
  it("returns trimmed stdout on success", () => {
    mockExec.mockReturnValueOnce("  hello world  ");
    expect(execOrThrow("echo", ["hello"])).toBe("hello world");
  });

  it("throws on command failure", () => {
    mockExec.mockImplementationOnce(() => {
      throw new Error("command failed");
    });
    expect(() => execOrThrow("bad-cmd", [])).toThrow("command failed");
  });
});

describe("execSafe", () => {
  const mockWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    mockWarn.mockClear();
  });

  it("returns trimmed stdout on success", () => {
    mockExec.mockReturnValueOnce("  output  ");
    expect(execSafe("echo", ["ok"])).toBe("output");
  });

  it("returns empty string and logs warning on failure", () => {
    mockExec.mockImplementationOnce(() => {
      throw new Error("cmd failed");
    });

    expect(execSafe("bad-cmd", [])).toBe("");
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("Command failed (safe)"),
    );
  });
});
