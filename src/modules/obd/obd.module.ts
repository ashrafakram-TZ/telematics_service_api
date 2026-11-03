import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesModule } from '../devices/devices.module';
import { Device } from '../devices/entities/device.entity';
import { ObdReading } from './entities/obd-reading.entity';
import { ObdMqttController } from './obd-mqtt.controller';
import { ObdController } from './obd.controller';
import { ObdService } from './obd.service';

@Module({
  imports: [TypeOrmModule.forFeature([ObdReading, Device]), DevicesModule],
  controllers: [ObdController, ObdMqttController],
  providers: [ObdService],
})
export class ObdModule {}
