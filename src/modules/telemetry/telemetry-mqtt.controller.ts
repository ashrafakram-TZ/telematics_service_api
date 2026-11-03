import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, MqttContext, Payload } from '@nestjs/microservices';
import { GPS_TOPIC, TELEMETRY_TOPIC, vehicleIdFromTopic } from '../mqtt/mqtt.constants';
import { parsePayload } from '../mqtt/payload-parser';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { TelemetryService } from './telemetry.service';

@Controller()
export class TelemetryMqttController {
  private readonly logger = new Logger(TelemetryMqttController.name);

  constructor(private readonly telemetryService: TelemetryService) {}

  @EventPattern(TELEMETRY_TOPIC)
  handle(@Payload() data: unknown, @Ctx() ctx: MqttContext): Promise<void> {
    return this.ingest(TELEMETRY_TOPIC, data, ctx.getTopic());
  }

  @EventPattern(GPS_TOPIC)
  handleGps(@Payload() data: unknown, @Ctx() ctx: MqttContext): Promise<void> {
    return this.ingest(GPS_TOPIC, data, ctx.getTopic());
  }

  private async ingest(filter: string, data: unknown, topic: string): Promise<void> {
    const imei = vehicleIdFromTopic(filter, topic);
    if (!imei) {
      this.logger.warn(`${topic} rejected: topic does not match ${filter}`);
      return;
    }
    const result = parsePayload(TelemetryPayloadDto, data);
    if (!result.ok) {
      this.logger.warn(`${topic} rejected: ${result.reason}`);
      return;
    }
    await this.telemetryService.ingest(imei, result.payload);
  }
}
