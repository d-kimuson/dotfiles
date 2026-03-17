import { vi } from "vitest";
import { execFile, execFileSync } from "node:child_process";
import type { Issue } from "./types.ts";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "MOCK-UUID"),
}));

export const mockExec = vi.mocked(execFileSync);
export const mockExecFile = vi.mocked(execFile);

export const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: "beads-test-abc",
  title: "Test issue",
  description: "A test issue",
  status: "open",
  priority: "P2",
  type: "task",
  labels: ["step:implement"],
  ...overrides,
});

/** Configure mockExecFile to call the callback with given stdout */
export const mockExecFileResolve = (stdout: string): void => {
  mockExecFile.mockImplementationOnce(
    ((_cmd: unknown, _args: unknown, _opts: unknown, cb: (err: null, result: { stdout: string; stderr: string }) => void) => {
      cb(null, { stdout, stderr: "" });
    }) as typeof execFile,
  );
};

/** Configure mockExecFile to call the callback with an error */
export const mockExecFileReject = (message: string): void => {
  mockExecFile.mockImplementationOnce(
    ((_cmd: unknown, _args: unknown, _opts: unknown, cb: (err: Error) => void) => {
      cb(new Error(message));
    }) as typeof execFile,
  );
};
