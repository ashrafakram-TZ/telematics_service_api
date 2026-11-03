import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors, ResponseMessage } from '../../common';
import { CreateTripDto } from './dto/create-trip.dto';
import { EndTripDto } from './dto/end-trip.dto';
import { TripQueryDto } from './dto/trip-query.dto';
import { TripStateDto, TripWebhookEventDto } from './dto/trip-state.dto';
import { TripsService } from './trips.service';

@ApiTags('Trips')
@ApiSecurity('api-key')
@ApiExtraModels(TripWebhookEventDto)
@ApiErrors(HttpStatus.UNAUTHORIZED)
@Controller('trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post()
  @ResponseMessage('Trip started')
  @ApiOperation({
    summary: 'Create and start a trip for a device',
    description:
      'Emits trip.started. The engine then runs on every GPS point of the device and emits stop.approaching, ' +
      'stop.arrived, stop.departed and trip.ended through the webhook. Errors: 404 DEVICE_NOT_FOUND, ' +
      '409 TRIP_ALREADY_ACTIVE (device busy), 409 TRIP_REF_ACTIVE, 400 DUPLICATE_STOP_SEQUENCE / DUPLICATE_STOP_REF.',
  })
  @ApiEnvelope(TripStateDto, { status: HttpStatus.CREATED, message: 'Trip started' })
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  create(@Body() dto: CreateTripDto) {
    return this.trips.create(dto);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Trip ended')
  @ApiOperation({
    summary: 'End a trip by hand',
    description: 'Emits trip.ended. Ending a trip that has already ended returns it unchanged and emits nothing.',
  })
  @ApiEnvelope(TripStateDto, { message: 'Trip ended' })
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  end(@Param('id', ParseIntPipe) id: number, @Body() dto: EndTripDto) {
    return this.trips.end(id, dto.reason);
  }

  @Get()
  @ApiOperation({ summary: 'List trips, newest first', description: 'Filter by status, device_id and ref.' })
  @ApiEnvelope(TripStateDto, { paginated: true })
  @ApiErrors(HttpStatus.BAD_REQUEST)
  list(@Query() query: TripQueryDto) {
    return this.trips.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Trip state: position, stop statuses and ETAs' })
  @ApiEnvelope(TripStateDto)
  @ApiErrors(HttpStatus.NOT_FOUND)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.trips.findOne(id);
  }
}
