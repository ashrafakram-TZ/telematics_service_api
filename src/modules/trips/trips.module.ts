import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesModule } from '../devices/devices.module';
import { SafetyEvent } from '../safety/entities/safety-event.entity';
import { Telemetry } from '../telemetry/entities/telemetry.entity';
import { TripEvent } from './entities/trip-event.entity';
import { TripStop } from './entities/trip-stop.entity';
import { Trip } from './entities/trip.entity';
import { TripPlaybackService } from './trip-playback.service';
import { TripWebhookService } from './trip-webhook.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, TripStop, TripEvent, Telemetry, SafetyEvent]), DevicesModule],
  controllers: [TripsController],
  providers: [TripsService, TripWebhookService, TripPlaybackService],
  exports: [TripsService, TripWebhookService],
})
export class TripsModule {}
