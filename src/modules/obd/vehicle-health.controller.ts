import { Controller, Get, HttpStatus, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../../common';
import { FaultQueryDto, VehicleFaultDto, VehicleHealthDto } from './dto/vehicle-health.dto';
import { ObdService } from './obd.service';

@ApiTags('Vehicle health')
@ApiSecurity('api-key')
@ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
@Controller('devices/:id')
export class VehicleHealthController {
  constructor(private readonly obd: ObdService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Vehicle health card: latest engine readings, active fault codes with descriptions, and a status',
    description: 'status is good, warning, critical or unknown (no OBD yet). reasons lists what lowered it.',
  })
  @ApiEnvelope(VehicleHealthDto)
  health(@Param('id', ParseIntPipe) id: number) {
    return this.obd.health(id);
  }

  @Get('faults')
  @ApiOperation({
    summary: 'Fault code log, newest first',
    description:
      'One row per fault occurrence: when a code first appeared, was last reported and cleared. A new row sends vehicle.fault through the webhook. Filter with status (open, cleared), from and to.',
  })
  @ApiEnvelope(VehicleFaultDto, { paginated: true })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  faults(@Param('id', ParseIntPipe) id: number, @Query() query: FaultQueryDto) {
    return this.obd.faultLog(id, query);
  }
}
