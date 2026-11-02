import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig, dbConfig } from './config/configuration';
import { mqttConfig } from './config/mqtt.config';
import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './modules/devices/devices.module';
import { HealthModule } from './modules/health/health.module';
import { MqttModule } from './modules/mqtt/mqtt.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate, load: [appConfig, dbConfig, mqttConfig] }),
    DatabaseModule,
    MqttModule,
    HealthModule,
    DevicesModule,
    TelemetryModule,
  ],
})
export class AppModule {}
