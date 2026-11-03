import { Body, Controller, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors, ResponseMessage } from '../../common';
import { PhonePositionResultDto } from './dto/phone-position-result.dto';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { TelemetryService } from './telemetry.service';

@ApiTags('Telemetry')
@ApiSecurity('api-key')
@ApiErrors(HttpStatus.UNAUTHORIZED)
@Controller('devices/:id/positions')
export class PositionsController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage('Position received')
  @ApiOperation({
    summary: 'Phone GPS fallback for a device',
    description:
      'Same payload as the MQTT GPS topic. Stored with source "phone", updates live status and runs the trip engine, ' +
      'but only when the tracker has not sent its own GPS in the last 60 seconds (otherwise accepted=false).',
  })
  @ApiEnvelope(PhonePositionResultDto, { status: HttpStatus.ACCEPTED, message: 'Position received' })
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  create(@Param('id', ParseIntPipe) id: number, @Body() payload: TelemetryPayloadDto) {
    return this.telemetry.ingestFromPhone(id, payload);
  }
}
