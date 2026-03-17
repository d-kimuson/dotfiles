import { describe, it, expect, beforeEach } from "vitest";
import { mockExec, makeIssue } from "../test-helpers.ts";
import { beadsClient } from "./beads-client.ts";

beforeEach(() => {
  mockExec.mockReset();
  mockExec.mockReturnValue("");
});

describe("beadsClient.ready", () => {
  it("returns parsed issues", () => {
    const issues = [makeIssue()];
    mockExec.mockReturnValue(JSON.stringify(issues));

    expect(beadsClient.ready({ label: "implement" })).toEqual(issues);
  });

  it("returns empty array on failure", () => {
    mockExec.mockImplementation(() => {
      throw new Error("fail");
    });

    expect(beadsClient.ready({ label: "implement" })).toEqual([]);
  });
});

describe("beadsClient.show", () => {
  it("returns first element from array response", () => {
    const issue = makeIssue();
    mockExec.mockReturnValue(JSON.stringify([issue]));

    expect(beadsClient.show("beads-test-abc")).toEqual(issue);
  });

  it("returns undefined on failure", () => {
    mockExec.mockImplementation(() => {
      throw new Error("fail");
    });

    expect(beadsClient.show("beads-test-abc")).toBeUndefined();
  });
});

describe("beadsClient.update", () => {
  it("builds command with all options", () => {
    beadsClient.update("beads-test-abc", {
      status: "in_progress",
      addLabels: ["implement"],
      removeLabels: ["plan"],
    });

    expect(mockExec).toHaveBeenCalledWith(
      "bd",
      ["update", "beads-test-abc", "--status", "in_progress", "--add-label", "implement", "--remove-label", "plan"],
      { encoding: "utf-8" },
    );
  });

  it("includes --assignee when specified", () => {
    beadsClient.update("beads-test-abc", {
      status: "in_progress",
      assignee: "bd-pdm",
    });

    expect(mockExec).toHaveBeenCalledWith(
      "bd",
      ["update", "beads-test-abc", "--status", "in_progress", "--assignee", "bd-pdm"],
      { encoding: "utf-8" },
    );
  });

  it("passes acceptance with single quotes without shell escaping", () => {
    beadsClient.update("beads-test-abc", {
      acceptance: "it's done",
    });

    expect(mockExec).toHaveBeenCalledWith(
      "bd",
      ["update", "beads-test-abc", "--acceptance", "it's done"],
      { encoding: "utf-8" },
    );
  });

  it("throws when bd update fails", () => {
    mockExec.mockImplementationOnce(() => {
      throw new Error("bd update failed");
    });

    expect(() =>
      beadsClient.update("beads-test-abc", { status: "in_progress" }),
    ).toThrow("bd update failed");
  });
});
