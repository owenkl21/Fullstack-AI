# Fishing App Phase 0 Foundations

This document captures baseline conventions and architecture decisions that unblock feature phases.

## Domain language glossary

- **Catch**: A logged fishing outcome by a user, with optional site/species/conditions metadata.
- **Fishing Site**: A fishable location users can create, review, and like.
- **Review**: A 1-5 star quality assessment of a fishing site, with optional written context.
- **Like**: Lightweight endorsement action against either a catch or a fishing site.
- **Comment**: A user message attached to a catch for discussion.
- **Follow**: A directed relationship from one user to another for feed personalization.
- **Feed Event**: A timeline item representing a user action (new catch, review, site creation).

## Auth baseline

- Authentication is enforced with Clerk middleware and a route-level `requireApiAuth` helper for protected routes.
- Public read routes are left open (`/` and `/api/hello`) while API write actions remain authenticated.

## Dev seed baseline

- Prisma seed script (`packages/server/prisma/seed.ts`) provides:
  - two users,
  - one site,
  - one species,
  - one catch linked to site + species.
- This seed data gives immediate fixtures for API and UI integration tests.

## Image storage conventions

- Use object storage (S3-compatible) with app-owned `storageKey` values stored in DB.
- Expose only signed URLs to clients when reading private media.
- Persist both `storageKey` and current URL for traceability and migration flexibility.
- Key naming convention:
  - `users/{userId}/catches/{catchId}/{index}.{ext}`
  - `users/{userId}/sites/{siteId}/{index}.{ext}`

## Observability baseline

- Add request lifecycle logs in Express (`[request:start]`, `[request:end]`).
- Enable Prisma query event logging in development for DB visibility.
- Keep a centralized error middleware that returns a stable JSON error shape.
