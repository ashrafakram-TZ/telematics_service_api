import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { AppException } from '../exceptions/app.exception';
import { IS_PUBLIC } from './public.decorator';

export const API_KEY_HEADER = 'x-api-key';

export function matchesKey(given: string, keys: string[]): boolean {
  const candidate = Buffer.from(given);
  return keys.some((key) => {
    const expected = Buffer.from(key);
    return expected.length === candidate.length && timingSafeEqual(expected, candidate);
  });
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly keys: string[],
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const given = context.switchToHttp().getRequest<Request>().header(API_KEY_HEADER);
    if (!given) throw AppException.unauthorized('Send the API key in the X-Api-Key header', 'API_KEY_MISSING');
    if (!matchesKey(given, this.keys)) throw AppException.unauthorized('This API key is not valid', 'API_KEY_INVALID');
    return true;
  }
}
