import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const DESCRIPTION = `
Vehicle tracking service. Tracker devices publish GPS/OBD data over MQTT; this service stores it and serves it over HTTP.

**Who calls it**: the School API (and later any other product) server to server. Browsers and mobile apps never call it directly.

**Auth**: send \`X-Api-Key: <key>\` on every call. Keys come from \`API_KEYS\` in .env. \`/api/health\` needs no key.

**Base URL**: \`/api/v1\`. **Success**: \`{ "status": 200, "message": "OK", "data": ... }\`. **Error**: \`{ "status": 401, "error": "API_KEY_INVALID", "message": "..." }\`.

**MQTT**: topic \`telematics/<imei>/telemetry\`, payload \`{ "ts": 1793600000, "lat": 13.08, "lng": 80.21, "spd": 32, "hdg": 270, "ign": 1, "odo": 12045.2, "fuel": 64 }\`.
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
      .addTag('Health', 'Service status')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}
