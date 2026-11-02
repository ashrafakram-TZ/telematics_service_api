import { Body, Controller, Delete, Get, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors, ResponseMessage } from '../../common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { DeviceQueryDto } from './dto/device-query.dto';
import { DeviceStatusDto, FleetSummaryDto } from './dto/device-status.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Device } from './entities/device.entity';

@ApiTags('Devices')
@ApiSecurity('api-key')
@ApiErrors(HttpStatus.UNAUTHORIZED)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get('live')
  @ApiOperation({
    summary: 'Live status of every active vehicle: moving, idle or offline, with the last position',
    description: 'The School API calls this to show buses on the map.',
  })
  @ApiEnvelope(FleetSummaryDto)
  live() {
    return this.devices.live();
  }

  @Get()
  @ApiOperation({
    summary: 'List devices',
    description: 'search matches name, IMEI and vehicle number. sort: created_at, name, imei, last_seen_at',
  })
  @ApiEnvelope(Device, { paginated: true })
  findAll(@Query() query: DeviceQueryDto) {
    return this.devices.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One device' })
  @ApiEnvelope(Device)
  @ApiErrors(HttpStatus.NOT_FOUND)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.devices.findOne(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Live status and last position of one vehicle' })
  @ApiEnvelope(DeviceStatusDto)
  @ApiErrors(HttpStatus.NOT_FOUND)
  status(@Param('id', ParseIntPipe) id: number) {
    return this.devices.status(id);
  }

  @Post()
  @ResponseMessage('Device created')
  @ApiOperation({ summary: 'Register a tracker device' })
  @ApiEnvelope(Device, { status: HttpStatus.CREATED, message: 'Device created' })
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  create(@Body() dto: CreateDeviceDto) {
    return this.devices.create(dto);
  }

  @Patch(':id')
  @ResponseMessage('Device updated')
  @ApiOperation({ summary: 'Update a device' })
  @ApiEnvelope(Device, { message: 'Device updated' })
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDeviceDto) {
    return this.devices.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Device deleted')
  @ApiOperation({ summary: 'Remove a device' })
  @ApiErrors(HttpStatus.NOT_FOUND)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.devices.remove(id);
  }
}
