import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesModule } from '../devices/devices.module';
import { Telemetry } from './entities/telemetry.entity';
import { TelemetryMqttController } from './telemetry-mqtt.controller';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetry]), DevicesModule],
  controllers: [TelemetryController, TelemetryMqttController],
  providers: [TelemetryService],
})
export class TelemetryModule {}
