import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesModule } from '../devices/devices.module';
import { Device } from '../devices/entities/device.entity';
import { SafetyModule } from '../safety/safety.module';
import { TripsModule } from '../trips/trips.module';
import { Telemetry } from './entities/telemetry.entity';
import { TelemetryMqttController } from './telemetry-mqtt.controller';
import { PositionsController } from './positions.controller';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetry, Device]), DevicesModule, TripsModule, SafetyModule],
  controllers: [TelemetryController, PositionsController, TelemetryMqttController],
  providers: [TelemetryService],
})
export class TelemetryModule {}
