import { Controller, Get, HttpStatus, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../../common';
import { ObdQueryDto } from './dto/obd-query.dto';
import { ObdReadingDto } from './dto/obd-reading.dto';
import { ObdService } from './obd.service';

@ApiTags('OBD')
@ApiSecurity('api-key')
@ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
@Controller('devices/:id/obd')
export class ObdController {
  constructor(private readonly obd: ObdService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Latest OBD reading of a device (404 NO_OBD_DATA when none yet)' })
  @ApiEnvelope(ObdReadingDto)
  latest(@Param('id', ParseIntPipe) id: number) {
    return this.obd.latest(id);
  }

  @Get()
  @ApiOperation({
    summary: 'OBD history of a device, newest first',
    description: 'Engine rpm, coolant, load, fuel, voltage, odometer and active DTC codes. Filter with from and to.',
  })
  @ApiEnvelope(ObdReadingDto, { paginated: true })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  history(@Param('id', ParseIntPipe) id: number, @Query() query: ObdQueryDto) {
    return this.obd.history(id, query);
  }
}
