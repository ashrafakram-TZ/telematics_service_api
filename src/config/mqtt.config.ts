import { ConfigType, registerAs } from '@nestjs/config';

export const mqttConfig = registerAs('mqtt', () => ({
  enabled: process.env.MQTT_ENABLED === 'true',
  url: process.env.MQTT_URL ?? '',
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
  clientId: process.env.MQTT_CLIENT_ID ?? '',
}));

export type MqttConfig = ConfigType<typeof mqttConfig>;
