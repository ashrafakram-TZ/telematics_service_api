import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig, dbConfig } from './config/configuration';
import { mqttConfig } from './config/mqtt.config';
import { safetyConfig } from './config/safety.config';
import { tripsConfig } from './config/trips.config';
import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './modules/devices/devices.module';
import { HealthModule } from './modules/health/health.module';
import { MqttModule } from './modules/mqtt/mqtt.module';
import { ObdModule } from './modules/obd/obd.module';
import { SafetyModule } from './modules/safety/safety.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { TripsModule } from './modules/trips/trips.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate,
      load: [appConfig, dbConfig, mqttConfig, tripsConfig, safetyConfig],
    }),
    DatabaseModule,
    MqttModule,
    HealthModule,
    DevicesModule,
    TelemetryModule,
    ObdModule,
    TripsModule,
    SafetyModule,
  ],
})
export class AppModule {}
