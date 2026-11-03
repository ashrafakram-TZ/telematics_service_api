import { ConfigType, registerAs } from '@nestjs/config';

export const tripsConfig = registerAs('trips', () => ({
  webhookUrl: (process.env.TRIP_WEBHOOK_URL ?? '').trim(),
  webhookSecret: process.env.TRIP_WEBHOOK_SECRET ?? '',
}));

export type TripsConfig = ConfigType<typeof tripsConfig>;
