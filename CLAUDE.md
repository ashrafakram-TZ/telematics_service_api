# CLAUDE.md — Telematics Service

Standalone NestJS 10 service that ingests tracker data over MQTT and serves vehicle status over HTTP. Its own repo, own PostgreSQL database (`telematics_service`), own Swagger (`:3001/api/docs`). The School API (`C:/Users/DELL/Telematics`) is a client: it calls this service with an API key. Read `README.md` before changing anything a client sees.

## Commands

```bash
npm run start:dev       # http://localhost:3001/api/v1, Swagger at /api/docs
npm run lint && npm test && npm run build
npm run migration:generate -- src/database/migrations/Name
npm run migration:run
npm run simulate -- 860000000000001 5
```

## Hard rules

- **No code comments.**
- **No school data here.** No students, routes, stops or users. Product logic stays in the product API; this service only knows devices and positions.
- **Every route needs `X-Api-Key`** except those marked `@Public()` (only health). Keys come from `API_KEYS` in `.env`, never from code.
- Integer primary keys (telemetry uses bigint), snake_case columns and JSON, `timestamptz` everywhere.
- Responses `{ status, message, data }`; errors through `AppException` with a stable SCREAMING_SNAKE_CASE code. No try/catch in controllers.
- Never hardcode hosts, keys or passwords. Add new settings to `env.validation.ts` and `.env.example`. Never commit `.env`.
- Schema changes only through migrations (`synchronize: false`).

## Structure

`src/common` is shared plumbing (envelope, filter, guard, list helpers). Features go in `src/modules/<feature>/` with `entities/`, `dto/`, service, controller and `*.spec.ts`. Every controller gets `@ApiTags`, `@ApiSecurity('api-key')`, `@ApiOperation` and `@ApiEnvelope`.
