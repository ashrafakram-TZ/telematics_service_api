import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { SchemaObject, ReferenceObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

interface EnvelopeOptions {
  status?: HttpStatus;
  description?: string;
  paginated?: boolean;
  isArray?: boolean;
  message?: string;
}

function dataSchema(model: Type | undefined, options: EnvelopeOptions): SchemaObject | ReferenceObject {
  if (!model) return { type: 'object', nullable: true, example: null };
  const ref = { $ref: getSchemaPath(model) };
  if (options.paginated) {
    return {
      type: 'object',
      properties: {
        items: { type: 'array', items: ref },
        total: { type: 'integer', example: 42 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        total_pages: { type: 'integer', example: 3 },
        has_next: { type: 'boolean', example: true },
      },
    };
  }
  return options.isArray ? { type: 'array', items: ref } : ref;
}

export function ApiEnvelope(model?: Type, options: EnvelopeOptions = {}): MethodDecorator & ClassDecorator {
  const status = options.status ?? HttpStatus.OK;
  return applyDecorators(
    ...(model ? [ApiExtraModels(model)] : []),
    ApiResponse({
      status,
      description: options.description,
      schema: {
        type: 'object',
        required: ['status', 'message', 'data'],
        properties: {
          status: { type: 'integer', example: status },
          message: { type: 'string', example: options.message ?? 'OK' },
          data: dataSchema(model, options),
        },
      },
    }),
  );
}

export class ApiErrorBody {
  status: number;
  error: string;
  message: string;
  errors?: { field: string; message: string }[];
}

const errorSchema = (status: number, error: string, message: string): SchemaObject => ({
  type: 'object',
  required: ['status', 'error', 'message'],
  properties: {
    status: { type: 'integer', example: status },
    error: { type: 'string', example: error },
    message: { type: 'string', example: message },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: { field: { type: 'string', example: 'mobile' }, message: { type: 'string', example: message } },
      },
    },
  },
});

export function ApiErrors(...statuses: HttpStatus[]): MethodDecorator & ClassDecorator {
  const examples: Partial<Record<HttpStatus, [string, string]>> = {
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED', 'mobile must be a valid 10-digit Indian mobile number'],
    [HttpStatus.UNAUTHORIZED]: ['API_KEY_INVALID', 'This API key is not valid'],
    [HttpStatus.FORBIDDEN]: ['FORBIDDEN', 'You do not have permission to do this'],
    [HttpStatus.NOT_FOUND]: ['NOT_FOUND', 'Resource not found'],
    [HttpStatus.CONFLICT]: ['DUPLICATE', 'mobile already exists'],
    [HttpStatus.TOO_MANY_REQUESTS]: ['OTP_RATE_LIMITED', 'Too many OTP requests. Try again in 15 minutes.'],
  };
  return applyDecorators(
    ...statuses.map((status) => {
      const [error, message] = examples[status] ?? [HttpStatus[status], 'Error'];
      return ApiResponse({ status, description: error, schema: errorSchema(status, error, message) });
    }),
  );
}
