import { HttpException, HttpStatus } from '@nestjs/common';

export interface FieldError {
  field: string;
  message: string;
}

export interface AppExceptionBody {
  message: string;
  code?: string;
  errors?: FieldError[];
}

export class AppException extends HttpException {
  constructor(status: HttpStatus, message: string, code?: string, errors?: FieldError[]) {
    super({ message, code, errors } satisfies AppExceptionBody, status);
  }

  static badRequest(message = 'Bad request', code?: string): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, message, code);
  }

  static validation(errors: FieldError[]): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, errors[0]?.message ?? 'Invalid input', 'VALIDATION_FAILED', errors);
  }

  static unauthorized(message = 'Unauthorized', code?: string): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, message, code);
  }

  static forbidden(message = 'You do not have permission to do this', code?: string): AppException {
    return new AppException(HttpStatus.FORBIDDEN, message, code);
  }

  static notFound(message = 'Resource not found', code?: string): AppException {
    return new AppException(HttpStatus.NOT_FOUND, message, code);
  }

  static conflict(message = 'Conflict', code?: string): AppException {
    return new AppException(HttpStatus.CONFLICT, message, code);
  }

  static tooManyRequests(message = 'Too many requests', code?: string): AppException {
    return new AppException(HttpStatus.TOO_MANY_REQUESTS, message, code);
  }

  static unavailable(message = 'Service unavailable', code?: string): AppException {
    return new AppException(HttpStatus.SERVICE_UNAVAILABLE, message, code);
  }
}
