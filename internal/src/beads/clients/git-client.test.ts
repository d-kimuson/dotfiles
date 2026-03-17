import { describe, it, expect, beforeEach } from "vitest";
import { mockExec } from "../test-helpers.ts";
import { git } from "./git-client.ts";

beforeEach(() => {
  mockExec.mockReset();
  mockExec.mockReturnValue("");
});

describe("git.commitDocsIfDirty", () => {
  it("commits when docs/ has changes", () => {
    mockExec
      .mockReturnValueOnce("docs/CODING_GUIDELINE.md") // git diff --name-only docs/
      .mockReturnValueOnce("")  // git ls-files --others docs/
      .mockReturnValueOnce("")  // git add docs/
      .mockReturnValueOnce(""); // git commit

    expect(git.commitDocsIfDirty()).toBe(true);

    const calls = mockExec.mock.calls;
    expect(calls[2]).toEqual(["git", ["add", "docs/"], { encoding: "utf-8" }]);
    expect(calls[3]?.[0]).toBe("git");
    expect(calls[3]?.[1]).toEqual(expect.arrayContaining(["commit"]));
  });

  it("commits when docs/ has untracked files", () => {
    mockExec
      .mockReturnValueOnce("")  // git diff (no modified)
      .mockReturnValueOnce("docs/new-file.md") // git ls-files --others
      .mockReturnValueOnce("")  // git add
      .mockReturnValueOnce(""); // git commit

    expect(git.commitDocsIfDirty()).toBe(true);
  });

  it("throws when git add fails", () => {
    mockExec
      .mockReturnValueOnce("docs/CODING_GUIDELINE.md") // git diff
      .mockReturnValueOnce("")  // git ls-files --others
      .mockImplementationOnce(() => { throw new Error("git add failed"); }); // git add

    expect(() => git.commitDocsIfDirty()).toThrow("git add failed");
  });

  it("throws when git commit fails", () => {
    mockExec
      .mockReturnValueOnce("docs/CODING_GUIDELINE.md") // git diff
      .mockReturnValueOnce("")  // git ls-files --others
      .mockReturnValueOnce("")  // git add
      .mockImplementationOnce(() => { throw new Error("git commit failed"); }); // git commit

    expect(() => git.commitDocsIfDirty()).toThrow("git commit failed");
  });

  it("returns false when docs/ is clean", () => {
    mockExec
      .mockReturnValueOnce("")  // git diff
      .mockReturnValueOnce(""); // git ls-files --others

    expect(git.commitDocsIfDirty()).toBe(false);
    expect(mockExec).toHaveBeenCalledTimes(2);
  });
});

describe("git.uncommittedNonBeadsFiles", () => {
  it("filters out .beads/ files", () => {
    mockExec.mockReturnValue(
      "?? guideline.md\n?? .beads/last-touched\n M src/index.ts",
    );

    expect(git.uncommittedNonBeadsFiles()).toEqual([
      "?? guideline.md",
      " M src/index.ts",
    ]);
  });

  it("returns empty when clean", () => {
    mockExec.mockReturnValue("");
    expect(git.uncommittedNonBeadsFiles()).toEqual([]);
  });
});
