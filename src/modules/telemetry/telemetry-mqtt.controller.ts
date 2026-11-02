import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, MqttContext, Payload } from '@nestjs/microservices';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TELEMETRY_TOPIC } from '../mqtt/mqtt.constants';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { TelemetryService } from './telemetry.service';

@Controller()
export class TelemetryMqttController {
  private readonly logger = new Logger(TelemetryMqttController.name);

  constructor(private readonly telemetryService: TelemetryService) {}

  @EventPattern(TELEMETRY_TOPIC)
  async handle(@Payload() data: unknown, @Ctx() ctx: MqttContext): Promise<void> {
    const topic = ctx.getTopic();
    const imei = topic.split('/')[1];

    if (typeof data !== 'object' || data === null) {
      this.logger.warn(`${topic} rejected: payload is not a JSON object`);
      return;
    }

    const payload = plainToInstance(TelemetryPayloadDto, data);
    const [error] = await validate(payload, { whitelist: true });
    if (error) {
      const reason = Object.values(error.constraints ?? {})[0] ?? `${error.property} is invalid`;
      this.logger.warn(`${topic} rejected: ${reason} (received ${error.property}=${JSON.stringify(error.value)})`);
      return;
    }

    await this.telemetryService.ingest(imei, payload);
  }
}
