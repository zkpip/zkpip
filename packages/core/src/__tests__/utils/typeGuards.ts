export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type ValidateFn = ((data: unknown) => boolean) & { errors?: unknown };
