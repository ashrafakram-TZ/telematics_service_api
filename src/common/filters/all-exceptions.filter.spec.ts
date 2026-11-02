import { ArgumentsHost, Logger } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { QueryFailedError } from 'typeorm';
import { AppException } from '../exceptions/app.exception';
import { flattenValidationErrors } from '../pipes/validation.pipe';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn<void, [Record<string, unknown>]>();
  const status = jest.fn<{ json: typeof json }, [number]>(() => ({ json }));
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/test' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status: status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
}

describe('AllExceptionsFilter', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('uses the AppException code as error', () => {
    const { status, body } = run(AppException.unauthorized('Incorrect OTP', 'OTP_INVALID'));
    expect(status).toBe(401);
    expect(body).toEqual({ status: 401, error: 'OTP_INVALID', message: 'Incorrect OTP' });
  });

  it('includes field errors for validation', () => {
    const { body } = run(AppException.validation([{ field: 'mobile', message: 'mobile is invalid' }]));
    expect(body).toEqual({
      status: 400,
      error: 'VALIDATION_FAILED',
      message: 'mobile is invalid',
      errors: [{ field: 'mobile', message: 'mobile is invalid' }],
    });
  });

  it('turns a unique violation into a 409 naming the field', () => {
    const error = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('dup'), { code: '23505', detail: 'Key (mobile)=(9) exists' }),
    );
    const { status, body } = run(error);
    expect(status).toBe(409);
    expect(body).toEqual({ status: 409, error: 'DUPLICATE', message: 'mobile already exists' });
  });

  it('hides unknown errors behind a 500', () => {
    const { status, body } = run(new Error('boom'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
  });
});

describe('flattenValidationErrors', () => {
  it('flattens nested errors into dotted fields', () => {
    const child = Object.assign(new ValidationError(), {
      property: 'platform',
      constraints: { isIn: 'platform is invalid' },
    });
    const parent = Object.assign(new ValidationError(), { property: 'client', children: [child] });
    expect(flattenValidationErrors([parent])).toEqual([{ field: 'client.platform', message: 'platform is invalid' }]);
  });
});
