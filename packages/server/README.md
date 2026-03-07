# server

## Setup

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Database setup (MySQL)

Prisma commands such as `db pull`/`introspect` fail with `Unknown database "fishing_app"` when the database in `DATABASE_URL` does not exist yet.

1. Copy `.env.example` to `.env` and update credentials if needed.
2. Create the database and apply the schema:

```bash
bun run prisma:setup
```

If you only need to create the database without seeding data:

```bash
bun run prisma:db:create
```

### Prisma connection troubleshooting

If requests to `/api/users/me` are slow and logs show `pool timeout: failed to retrieve a connection from pool`, verify these first:

1. Use `127.0.0.1` instead of `localhost` in `DATABASE_URL` to avoid IPv6/local resolver issues on some environments.
2. Ensure your DB type and Prisma driver mode match:
   - **MySQL**: keep `PRISMA_USE_MARIADB_ADAPTER=false` (default).
   - **MariaDB**: set `PRISMA_USE_MARIADB_ADAPTER=true`.
3. Confirm the same `DATABASE_URL` used by the server process can connect (host, port, user, password, db name).

Example:

```env
DATABASE_URL="mysql://root:password@127.0.0.1:3306/fishing_app"
PRISMA_USE_MARIADB_ADAPTER=false
```

## Integrating `getFishingConditions` (architecture-first)

This codebase already follows a `route -> controller -> service -> repository` flow for chat features.
A clean fishing feature should follow the same layering so HTTP details, business logic, and external API clients stay separated.

### 1) Create feature folders and files

Inside `packages/server`, add a small feature module:

```text
controllers/fishing.controller.ts
services/fishing.service.ts
clients/geocoding.client.ts
clients/weather.client.ts
clients/tides.client.ts
schemas/fishing.schema.ts
```

Why this shape:

- `controller`: validates/parses request + maps errors to HTTP status codes.
- `service`: orchestrates geocoding + weather + tides calls.
- `clients`: each external API has one focused adapter.
- `schemas`: shared request validation for strong API boundaries.

### 2) Add request schema first (contract-driven)

Create `schemas/fishing.schema.ts`:

```ts
import z from 'zod';

export const fishingConditionsSchema = z.object({
  locationName: z.string().trim().min(1).max(120),
});

export type FishingConditionsRequest = z.infer<typeof fishingConditionsSchema>;
```

### 3) Move geocoding logic into a client

Create `clients/geocoding.client.ts` and keep your existing implementation mostly intact:

```ts
import axios from 'axios';

export interface Coordinates {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
}

export async function getCoordinates(locationName: string): Promise<Coordinates> {
  const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: {
      name: locationName,
      count: 1,
      language: 'en',
      format: 'json',
    },
  });

  if (!data.results?.length) {
    throw new Error(`No location found for "${locationName}"`);
  }

  const place = data.results[0];

  return {
    latitude: place.latitude,
    longitude: place.longitude,
    name: place.name,
    country: place.country,
  };
}
```

### 4) Add weather and tides clients

Create two dedicated clients so URL and API-specific response handling are isolated.

`clients/weather.client.ts`:

```ts
export async function getCurrentWeather(latitude: number, longitude: number) {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&current=temperature_2m,wind_speed_10m,precipitation` +
    `&timezone=auto`;

  const response = await fetch(weatherUrl);

  if (!response.ok) {
    throw new Error('Failed to fetch weather');
  }

  return response.json();
}
```

`clients/tides.client.ts`:

```ts
export async function getTideExtremes(
  latitude: number,
  longitude: number,
  worldTidesKey: string
) {
  const tideUrl =
    `https://www.worldtides.info/api/v3` +
    `?extremes` +
    `&lat=${latitude}` +
    `&lon=${longitude}` +
    `&key=${worldTidesKey}`;

  const response = await fetch(tideUrl);

  if (!response.ok) {
    throw new Error('Failed to fetch tides');
  }

  return response.json();
}
```

### 5) Implement orchestration in service layer

Create `services/fishing.service.ts`:

```ts
import { getCoordinates } from '../clients/geocoding.client';
import { getCurrentWeather } from '../clients/weather.client';
import { getTideExtremes } from '../clients/tides.client';

export const fishingService = {
  async getFishingConditions(locationName: string) {
    const worldTidesKey = process.env.WORLD_TIDES_API_KEY;

    if (!worldTidesKey) {
      throw new Error('Missing WORLD_TIDES_API_KEY');
    }

    const coords = await getCoordinates(locationName);

    const [weather, tides] = await Promise.all([
      getCurrentWeather(coords.latitude, coords.longitude),
      getTideExtremes(coords.latitude, coords.longitude, worldTidesKey),
    ]);

    return {
      location: coords,
      weather,
      tides,
    };
  },
};
```

### 6) Add controller for request validation and HTTP mapping

Create `controllers/fishing.controller.ts`:

```ts
import type { Request, Response } from 'express';
import { fishingConditionsSchema } from '../schemas/fishing.schema';
import { fishingService } from '../services/fishing.service';

export const fishingController = {
  async getConditions(req: Request, res: Response) {
    const parseResult = fishingConditionsSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json(parseResult.error.format());
    }

    try {
      const result = await fishingService.getFishingConditions(parseResult.data.locationName);
      return res.json(result);
    } catch (error) {
      console.error('Failed to process /api/fishing/conditions request:', error);
      return res.status(500).json({
        error: 'An error occurred while loading fishing conditions.',
      });
    }
  },
};
```

### 7) Register route without coupling internals

In `routes.ts`, wire the endpoint:

```ts
import { fishingController } from './controllers/fishing.controller';

router.post('/api/fishing/conditions', fishingController.getConditions);
```

### 8) Environment variables and runtime config

Add this to your `.env`:

```env
WORLD_TIDES_API_KEY=your_world_tides_api_key
```

Keep all secret keys server-side (never in client code).

### 9) Optional but recommended hardening

- Add per-client timeouts and retries (especially WorldTides).
- Normalize API errors into typed errors (`ExternalApiError`, `NotFoundError`) for better controller mapping.
- Add response DTO transformation in service so clients receive stable fields even if upstream APIs change.

### 10) Quick curl smoke test

```bash
curl -X POST http://localhost:3000/api/fishing/conditions \
  -H "Content-Type: application/json" \
  -d '{"locationName":"San Diego"}'
```

If successful, the response should include `location`, `weather`, and `tides`.

## Phase 0 foundations checklist

- Domain model baseline is defined in `prisma/schema.prisma`.
- Auth baseline is Clerk middleware + route-level `requireApiAuth` gate.
- Dev environment can be seeded via Prisma.
- Observability includes request lifecycle logs, Prisma query logs (development), and centralized error middleware.
- Image storage uses object storage keys + signed URL conventions (see `docs/phase-0-foundations.md`).

## Prisma commands

```bash
bun run --cwd packages/server prisma generate
bun run --cwd packages/server prisma db seed
```

`prisma db seed` runs `packages/server/prisma/seed.ts`.


## Clerk user sync webhook

This backend now exposes a Clerk webhook endpoint at `POST /api/webhooks/clerk` to keep the local `User` table in sync when users are created, updated, or deleted in Clerk.

Add your webhook signing secret in `.env`:

```env
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

In the Clerk dashboard, configure a webhook pointing to your server URL plus `/api/webhooks/clerk` and subscribe to at least:

- `user.created`
- `user.updated`
- `user.deleted`
