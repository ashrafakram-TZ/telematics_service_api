import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  AllExceptionsFilter,
  ApiKeyGuard,
  createValidationPipe,
  requestContextMiddleware,
  ResponseInterceptor,
} from './common';
import { AppConfig } from './config/configuration';

export const API_PREFIX = 'api';
export const DEFAULT_VERSION = '1';

export function setupApp(app: INestApplication): void {
  const config = app.get(ConfigService).getOrThrow<AppConfig>('app');
  const reflector = app.get(Reflector);
  app.use(requestContextMiddleware);
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: DEFAULT_VERSION });
  app.useGlobalGuards(new ApiKeyGuard(reflector, config.apiKeys));
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(reflector, config.timeZone));
}
