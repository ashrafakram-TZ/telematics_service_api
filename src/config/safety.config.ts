import { ConfigType, registerAs } from '@nestjs/config';

const number = (value: string | undefined, fallback: number) =>
  value === undefined || value.trim() === '' ? fallback : Number(value);

export const safetyConfig = registerAs('safety', () => ({
  speedLimitKmh: number(process.env.SAFETY_SPEED_LIMIT_KMH, 50),
  overspeedSeconds: number(process.env.SAFETY_OVERSPEED_SECONDS, 10),
  harshBrakeKmhPerS: number(process.env.SAFETY_HARSH_BRAKE_KMH_PER_S, 12),
  idleMinutes: number(process.env.SAFETY_IDLE_MINUTES, 5),
  deviationMetres: number(process.env.SAFETY_ROUTE_DEVIATION_M, 300),
  deviationSeconds: number(process.env.SAFETY_ROUTE_DEVIATION_SECONDS, 30),
  cooldownSeconds: number(process.env.SAFETY_COOLDOWN_SECONDS, 300),
}));

export type SafetyConfig = ConfigType<typeof safetyConfig>;
