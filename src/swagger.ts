import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const DESCRIPTION = `
Vehicle tracking service. Tracker devices publish GPS/OBD data over MQTT; this service stores it and serves it over HTTP.

**Who calls it**: the School API (and later any other product) server to server. Browsers and mobile apps never call it directly.

**Auth**: send \`X-Api-Key: <key>\` on every call. Keys come from \`API_KEYS\` in .env. \`/api/health\` needs no key.

**Base URL**: \`/api/v1\`. **Success**: \`{ "status": 200, "message": "OK", "data": ... }\`. **Error**: \`{ "status": 401, "error": "API_KEY_INVALID", "message": "..." }\`.

**MQTT** (the \`+\` segment is the device IMEI):
- \`fleet/<imei>/gps\` (and the older \`telematics/<imei>/telemetry\`): \`{ "ts": 1793600000, "lat": 13.08, "lng": 80.21, "spd": 32, "hdg": 270, "ign": 1, "odo": 12045.2, "fuel": 64, "bat": 88, "volt": 12.6, "evt": "harsh_brake" }\`
- \`fleet/<imei>/obd\`: \`{ "ts": 1793600000, "rpm": 1450, "spd": 34, "coolant": 89.5, "load": 42, "throttle": 18, "fuel": 63.4, "volt": 13.9, "odo": 48213.7, "dtc": ["P0301"] }\`

**Trips**: \`POST /trips\` starts a trip with its stops and destination (stop references, names and coordinates only, never student data). The engine runs on every GPS point and sends events to \`TRIP_WEBHOOK_URL\`: \`trip.started\`, \`trip.position\` (at most one per 2 s per trip), \`stop.approaching\`, \`stop.arrived\`, \`stop.departed\`, \`trip.ended\`. Each POST carries \`X-Telematics-Event: <type>\` and \`X-Telematics-Signature: sha256=<hex HMAC-SHA256 of the raw body with TRIP_WEBHOOK_SECRET>\`; the body is the TripWebhookEventDto schema below. Queued events retry after 1 s, 5 s and 15 s, in order per trip.

**Phone GPS fallback**: \`POST /devices/{id}/positions\` takes the GPS payload above and is used only when the tracker sent no GPS in the last 60 s.
`;

export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Telematics Service')
      .setDescription(DESCRIPTION)
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', name: 'X-Api-Key', in: 'header' }, 'api-key')
      .addTag('Devices', 'Tracker devices and live vehicle status')
      .addTag('Telemetry', 'GPS positions and history')
      .addTag('Trips', 'Trips with stops: ETAs, geofence events and the signed webhook')
      .addTag('OBD', 'Engine data from the OBD port: rpm, coolant, load, fuel, DTC fault codes')
      .addTag('Health', 'Service status')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}
