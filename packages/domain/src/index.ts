export type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type UserId = Brand<string, 'UserId'>;
export type EntityId = Brand<string, 'EntityId'>;
export type IsoDate = Brand<string, 'IsoDate'>;

export type DomainError =
  | { readonly kind: 'validation'; readonly code: string; readonly field?: string }
  | { readonly kind: 'conflict'; readonly code: string }
  | { readonly kind: 'not-found'; readonly code: string }
  | { readonly kind: 'unavailable'; readonly code: string };

export type Result<Value, Error = DomainError> =
  { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: Error };

export const success = <Value>(value: Value): Result<Value, never> => ({ ok: true, value });
export const failure = <Error>(error: Error): Result<never, Error> => ({ ok: false, error });

export function asIsoDate(value: string): Result<IsoDate> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return failure({ kind: 'validation', code: 'invalid_iso_date', field: 'date' });
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    return failure({ kind: 'validation', code: 'invalid_iso_date', field: 'date' });
  }
  return success(value as IsoDate);
}
