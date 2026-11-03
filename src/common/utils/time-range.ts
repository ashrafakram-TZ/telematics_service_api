import { Between, FindOperator, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

export function timeRange(from?: string, to?: string): FindOperator<Date> | undefined {
  if (from && to) return Between(new Date(from), new Date(to));
  if (from) return MoreThanOrEqual(new Date(from));
  if (to) return LessThanOrEqual(new Date(to));
  return undefined;
}
