export const TELEMETRY_TOPIC = process.env.MQTT_TOPIC_FILTER || 'telematics/+/telemetry';
export const GPS_TOPIC = process.env.MQTT_GPS_TOPIC || 'fleet/+/gps';
export const OBD_TOPIC = process.env.MQTT_OBD_TOPIC || 'fleet/+/obd';
export const SUBSCRIBED_TOPICS = [TELEMETRY_TOPIC, GPS_TOPIC, OBD_TOPIC];

export function vehicleIdFromTopic(filter: string, topic: string): string | null {
  const filterParts = filter.split('/');
  const topicParts = topic.split('/');
  if (filterParts.length !== topicParts.length) return null;
  const index = filterParts.indexOf('+');
  if (index < 0) return null;
  const matches = filterParts.every((part, i) => part === '+' || part === topicParts[i]);
  const id = topicParts[index];
  return matches && id ? id : null;
}
