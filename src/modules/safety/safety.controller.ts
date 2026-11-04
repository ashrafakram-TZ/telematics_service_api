import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../../common';
import { SafetyEventDto, SafetyQueryDto } from './dto/safety-event.dto';
import { SafetyService } from './safety.service';

@ApiTags('Safety')
@ApiSecurity('api-key')
@ApiErrors(HttpStatus.UNAUTHORIZED)
@Controller('safety-events')
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}

  @Get()
  @ApiOperation({
    summary: 'Safety events (overspeed, harsh braking, long idle, route deviation), newest first',
    description:
      'Raised from GPS points and sent to the product API as alert.raised. Filter by device_id, trip_id, kind, severity, from and to.',
  })
  @ApiEnvelope(SafetyEventDto, { paginated: true })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  list(@Query() query: SafetyQueryDto) {
    return this.safety.list(query);
  }
}
