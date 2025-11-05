// packages/cli/src/__tests__/helpers/assertions.ts

import { expect } from "vitest";


export function expectOk(result: { code: number; stderr: string }, stderrMustBeEmpty = true): void {
expect(result.code).toBe(0);
if (stderrMustBeEmpty) expect(result.stderr.trim()).toBe('');
}


export function expectFail(result: { code: number }): void {
expect(result.code).not.toBe(0);
}


export function expectStdoutIncludes(result: { stdout: string }, needle: string | RegExp): void {
if (typeof needle === 'string') {
expect(result.stdout).toContain(needle);
} else {
expect(result.stdout).toMatch(needle);
}
}


export function expectStderrIncludes(result: { stderr: string }, needle: string | RegExp): void {
if (typeof needle === 'string') {
expect(result.stderr).toContain(needle);
} else {
expect(result.stderr).toMatch(needle);
}
}