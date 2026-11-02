import { ConfigType, registerAs } from '@nestjs/config';

const list = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const appConfig = registerAs('app', () => {
  const port = Number(process.env.PORT ?? 3001);
  return {
    env: process.env.NODE_ENV ?? 'development',
    host: process.env.HOST ?? '0.0.0.0',
    port,
    timeZone: process.env.APP_TIMEZONE ?? 'Asia/Kolkata',
    corsOrigins: list(process.env.CORS_ORIGINS),
    apiKeys: list(process.env.API_KEYS),
    onlineWindowSeconds: Number(process.env.ONLINE_WINDOW_SECONDS ?? 120),
  };
});

export const dbConfig = registerAs('db', () => ({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true',
  poolSize: Number(process.env.DB_POOL_SIZE ?? 10),
}));

export type AppConfig = ConfigType<typeof appConfig>;
export type DbConfig = ConfigType<typeof dbConfig>;
