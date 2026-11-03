import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';

export type ParseResult<T> = { ok: true; payload: T } | { ok: false; reason: string };

function firstReason(error: ValidationError): string {
  const constraint = Object.values(error.constraints ?? {})[0];
  if (constraint) return `${constraint} (received ${error.property}=${JSON.stringify(error.value)})`;
  const child = error.children?.[0];
  return child ? firstReason(child) : `${error.property} is invalid`;
}

export function parsePayload<T extends object>(cls: ClassConstructor<T>, data: unknown): ParseResult<T> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, reason: 'payload is not a JSON object' };
  }
  const payload = plainToInstance(cls, data);
  const [error] = validateSync(payload, { whitelist: true });
  if (error) return { ok: false, reason: firstReason(error) };
  return { ok: true, payload };
}
