import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { RESPONSE_MESSAGE } from '../decorators/response-message.decorator';
import { zoneDates } from '../utils/timezone';

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T | null;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  constructor(
    private readonly reflector: Reflector,
    private readonly timeZone: string,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    if (context.getType() !== 'http') return next.handle();

    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE, [context.getHandler(), context.getClass()]) ?? 'OK';
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) return data;
        return {
          status: response.statusCode,
          message,
          data: (zoneDates(data, this.timeZone) as T) ?? null,
        };
      }),
    );
  }
}
