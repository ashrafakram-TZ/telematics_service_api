import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { ApiEnvelope, Public } from '../../common';
import { MqttState, MqttStatusService } from '../mqtt/mqtt-status.service';

export class HealthDto {
  @ApiProperty({ enum: ['up', 'down'] })
  db: 'up' | 'down';

  @ApiProperty({ enum: ['up', 'down', 'disabled'] })
  mqtt: MqttState;
}

@ApiTags('Health')
@Controller({ path: 'health', version: [VERSION_NEUTRAL, '1'] })
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mqtt: MqttStatusService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Database and MQTT broker status (no API key needed)' })
  @ApiEnvelope(HealthDto)
  async check(): Promise<HealthDto> {
    const db = await this.dataSource
      .query('SELECT 1')
      .then(() => 'up' as const)
      .catch(() => 'down' as const);
    return { db, mqtt: this.mqtt.status() };
  }
}
