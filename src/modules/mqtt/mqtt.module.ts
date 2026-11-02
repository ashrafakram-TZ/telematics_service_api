import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { mqttConfig } from '../../config/mqtt.config';
import { MqttStatusService } from './mqtt-status.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(mqttConfig)],
  providers: [MqttStatusService],
  exports: [MqttStatusService],
})
export class MqttModule {}
