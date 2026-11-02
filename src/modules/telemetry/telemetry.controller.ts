import { Controller, Get, HttpStatus, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../../common';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';
import { Telemetry } from './entities/telemetry.entity';
import { TelemetryService } from './telemetry.service';

@ApiTags('Telemetry')
@ApiSecurity('api-key')
@ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
@Controller('devices/:id/telemetry')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Latest position of a device' })
  @ApiEnvelope(Telemetry)
  latest(@Param('id', ParseIntPipe) id: number) {
    return this.telemetry.latest(id);
  }

  @Get()
  @ApiOperation({ summary: 'Position history of a device, newest first (trip playback)' })
  @ApiEnvelope(Telemetry, { paginated: true })
  history(@Param('id', ParseIntPipe) id: number, @Query() query: TelemetryQueryDto) {
    return this.telemetry.history(id, query);
  }
}
