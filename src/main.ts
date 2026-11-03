import 'dotenv/config';
import { networkInterfaces } from 'os';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { AppConfig } from './config/configuration';
import { MqttConfig } from './config/mqtt.config';
import { SUBSCRIBED_TOPICS } from './modules/mqtt/mqtt.constants';
import { setupSwagger } from './swagger';

function reachableHosts(host: string): string[] {
  if (host !== '::' && host !== '0.0.0.0') return [host];
  const lan = Object.values(networkInterfaces())
    .flatMap((nets) => nets ?? [])
    .filter((net) => net.family === 'IPv4' && !net.internal)
    .map((net) => net.address);
  return ['localhost', ...lan];
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);
  const appCfg = config.getOrThrow<AppConfig>('app');
  const mqttCfg = config.getOrThrow<MqttConfig>('mqtt');

  app.set('trust proxy', 1);
  setupApp(app);
  app.enableCors({
    origin: appCfg.corsOrigins.length ? appCfg.corsOrigins : appCfg.env !== 'production',
    exposedHeaders: ['X-Request-Id'],
  });
  app.enableShutdownHooks();
  if (appCfg.env !== 'production') setupSwagger(app);

  if (mqttCfg.enabled) {
    app.connectMicroservice<MicroserviceOptions>(
      {
        transport: Transport.MQTT,
        options: {
          url: mqttCfg.url,
          clientId: mqttCfg.clientId,
          username: mqttCfg.username,
          password: mqttCfg.password,
          reconnectPeriod: 5000,
        },
      },
      { inheritAppConfig: true },
    );
  }

  await app.listen(appCfg.port, appCfg.host);
  for (const host of reachableHosts(appCfg.host)) {
    logger.log(`HTTP listening on http://${host}:${appCfg.port}/api/v1`);
  }
  if (appCfg.env !== 'production') logger.log(`Swagger on http://localhost:${appCfg.port}/api/docs`);

  if (mqttCfg.enabled) {
    app
      .startAllMicroservices()
      .then(() => logger.log(`MQTT subscribed to ${SUBSCRIBED_TOPICS.join(', ')} on ${mqttCfg.url}`))
      .catch((error: Error) => logger.error(`MQTT failed to start: ${error.message}`));
  }
}

void bootstrap();
