import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExec, makeIssue } from "../test-helpers.ts";
import { validatePostPlan } from "./validators.ts";

beforeEach(() => {
  mockExec.mockReset();
  mockExec.mockReturnValue("");
});

describe("validatePostPlan", () => {
  const mockWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    mockWarn.mockClear();
  });

  it("warns when step:plan remains without step:implement or gate", () => {
    const issue = makeIssue({ labels: ["step:plan"] });
    mockExec.mockReturnValueOnce(JSON.stringify([issue]));

    validatePostPlan("beads-test-abc");

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("step:plan が残っています"),
    );
  });

  it("does not warn when step:implement was added", () => {
    const issue = makeIssue({ labels: ["step:plan", "step:implement"] });
    mockExec.mockReturnValueOnce(JSON.stringify([issue]));

    validatePostPlan("beads-test-abc");

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("does not warn when gate was created", () => {
    const issue = makeIssue({ labels: ["step:plan", "gate:plan-review"] });
    mockExec.mockReturnValueOnce(JSON.stringify([issue]));

    validatePostPlan("beads-test-abc");

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("does not warn when step:plan was removed", () => {
    const issue = makeIssue({ labels: ["step:implement"] });
    mockExec.mockReturnValueOnce(JSON.stringify([issue]));

    validatePostPlan("beads-test-abc");

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("does not warn when issue not found", () => {
    mockExec.mockReturnValueOnce("");

    validatePostPlan("beads-test-abc");

    expect(mockWarn).not.toHaveBeenCalled();
  });
});
