import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesModule } from '../devices/devices.module';
import { Device } from '../devices/entities/device.entity';
import { TripsModule } from '../trips/trips.module';
import { ObdReading } from './entities/obd-reading.entity';
import { VehicleFault } from './entities/vehicle-fault.entity';
import { ObdMqttController } from './obd-mqtt.controller';
import { ObdController } from './obd.controller';
import { ObdService } from './obd.service';
import { VehicleHealthController } from './vehicle-health.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ObdReading, Device, VehicleFault]), DevicesModule, TripsModule],
  controllers: [ObdController, VehicleHealthController, ObdMqttController],
  providers: [ObdService],
})
export class ObdModule {}
