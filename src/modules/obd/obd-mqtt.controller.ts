import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, MqttContext, Payload } from '@nestjs/microservices';
import { OBD_TOPIC, vehicleIdFromTopic } from '../mqtt/mqtt.constants';
import { parsePayload } from '../mqtt/payload-parser';
import { ObdPayloadDto } from './dto/obd-payload.dto';
import { ObdService } from './obd.service';

@Controller()
export class ObdMqttController {
  private readonly logger = new Logger(ObdMqttController.name);

  constructor(private readonly obd: ObdService) {}

  @EventPattern(OBD_TOPIC)
  async handle(@Payload() data: unknown, @Ctx() ctx: MqttContext): Promise<void> {
    const topic = ctx.getTopic();
    const imei = vehicleIdFromTopic(OBD_TOPIC, topic);
    if (!imei) {
      this.logger.warn(`${topic} rejected: topic does not match ${OBD_TOPIC}`);
      return;
    }
    const result = parsePayload(ObdPayloadDto, data);
    if (!result.ok) {
      this.logger.warn(`${topic} rejected: ${result.reason}`);
      return;
    }
    await this.obd.ingest(imei, result.payload);
  }
}
