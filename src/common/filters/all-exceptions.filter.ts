import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { EMPTY, Observable } from 'rxjs';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { RequestContext } from '../context/request-context';
import { FieldError } from '../exceptions/app.exception';

export interface ErrorBody {
  status: number;
  error: string;
  message: string;
  errors?: FieldError[];
}

interface ErrorResult {
  status: number;
  message: string;
  code?: string;
  errors?: FieldError[];
}

interface PgError {
  code?: string;
  detail?: string;
  column?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): Observable<never> | void {
    if (host.getType() !== 'http') {
      this.logger.error(`Dropped ${host.getType()} message: ${this.describe(exception)}`, (exception as Error)?.stack);
      return EMPTY;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const result = this.resolve(exception);
    const route = `${request.method} ${request.originalUrl}`;
    const requestId = RequestContext.get()?.requestId;
    const tag = requestId ? ` [${requestId}]` : '';

    if (result.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${route} ${result.status}${tag} ${this.describe(exception)}`, (exception as Error)?.stack);
    } else {
      this.logger.warn(`${route} ${result.status}${tag} ${result.message}`);
    }

    const body: ErrorBody = {
      status: result.status,
      error: result.code ?? this.code(result.status),
      message: result.message,
    };
    if (result.errors?.length) body.errors = result.errors;
    response.status(result.status).json(body);
  }

  private resolve(exception: unknown): ErrorResult {
    if (exception instanceof HttpException) return this.httpError(exception);
    if (exception instanceof QueryFailedError) return this.queryError(exception.driverError as PgError);
    if (exception instanceof EntityNotFoundError)
      return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' };
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }

  private httpError(exception: HttpException): ErrorResult {
    const status = exception.getStatus();
    const body = exception.getResponse();
    if (typeof body === 'string') return { status, message: body };
    const { message, code, errors } = body as { message?: unknown; code?: unknown; errors?: unknown };
    return {
      status,
      message: Array.isArray(message) ? String(message[0]) : typeof message === 'string' ? message : exception.message,
      code: typeof code === 'string' ? code : undefined,
      errors: Array.isArray(errors) ? (errors as FieldError[]) : undefined,
    };
  }

  private queryError(error: PgError): ErrorResult {
    switch (error.code) {
      case '23505': {
        const field = /Key \(([^)]+)\)=/.exec(error.detail ?? '')?.[1] ?? 'Value';
        return { status: HttpStatus.CONFLICT, message: `${field} already exists`, code: 'DUPLICATE' };
      }
      case '23503':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Referenced record not found or in use',
          code: 'REFERENCE_ERROR',
        };
      case '22P02':
        return { status: HttpStatus.BAD_REQUEST, message: 'Invalid input' };
      case '23502':
        return { status: HttpStatus.BAD_REQUEST, message: `${error.column ?? 'Field'} is required` };
      default:
        return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
    }
  }

  private code(status: number): string {
    return HttpStatus[status] ?? (status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  }

  private describe(exception: unknown): string {
    return exception instanceof Error ? exception.message : String(exception);
  }
}
