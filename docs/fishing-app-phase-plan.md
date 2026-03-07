# Fishing App Phase Plan (UI + Data + AI)

## 1) Product decomposition into phases

### Phase 0 — Foundations (before feature work)
- Define core domain language: **Catch**, **Fishing Site**, **Review**, **Like**, **Comment**, **Follow**, **Feed Event**.
- Set up auth baseline (email/OAuth) and a seeded dev environment.
- Add image storage choice and conventions (e.g., object storage + signed URLs).
- Add observability baseline (request logs, DB query logging in dev, error tracking).

### Phase 1 — Core logging workflows
- Log a catch with optional relationships:
  - optional site
  - optional gear
  - optional species
  - optional weather/water metadata
- Log a fishing site with metadata, map location, and images.
- Catch and site detail pages (minimum useful read views).

### Phase 2 — Community interactions
- Like fishing sites.
- Like catches.
- Comment on catches.
- Review fishing sites.
- Follow/unfollow users.

### Phase 3 — Feed and discovery
- Community feed page with mixed event types (new catches, new site reviews, site additions).
- Basic ranking and filtering (following feed vs global feed; recent vs trending).
- Search and filter for sites/catches.

### Phase 4 — AI Q&A from your own data
- Build retrieval pipeline over structured DB + generated summaries.
- Expose AI assistant routes that answer fish and spot questions with citations to app data.
- Add feedback loop for answer quality.

---

## 2) UI plan (by feature area)

## 2.1 IA / Navigation
- Top nav:
  - Feed
  - Explore Sites
  - Explore Catches
  - Log Catch
  - Log Site
  - Profile
- Profile tabs:
  - Catches
  - Sites
  - Reviews
  - Followers / Following
- Site detail route: `/sites/:siteId`
- Catch detail route: `/catches/:catchId`

## 2.2 Core screens and components

### A) Log Catch screen
- Form sections:
  - Required: title or species + date/time (default now)
  - Optional: site selector (search existing or "no site")
  - Optional: gear inputs (rod, reel, line, lure/bait)
  - Optional: fish metrics (length, weight, count)
  - Optional: conditions (weather, water temp, depth)
  - Optional: notes + image uploads
- UX constraints:
  - Never require site.
  - Save draft locally before submit.
  - Validation with clear optional/required labels.

### B) Log Site screen
- Form sections:
  - Required: site name
  - Optional: coordinates/map pin, water type, access info
  - Optional: best seasons, species typically found, hazard notes
  - Optional: image uploads

### C) Site Detail screen
- Header: site name, location, creator, aggregate rating, likes.
- Tabs/sections:
  - Overview (metadata)
  - Catches at site (cards/list)
  - Reviews (sortable by newest/helpful)
  - Photos gallery
- Actions:
  - Like/unlike site
  - Add review
  - Log catch prefilled with this site

### D) Catch Detail screen
- Header: species/title, angler, date/time, site link (if available).
- Sections:
  - Fish metrics
  - Gear used
  - Conditions
  - Notes and image gallery
  - Comment thread
- Actions:
  - Like/unlike catch
  - Add comment

### E) Feed screen
- Feed modes:
  - Following
  - Global
- Event card types:
  - New catch
  - New site
  - New site review
- Card actions:
  - Like catch/site (as applicable)
  - Comment (for catch)
  - Follow/unfollow from profile preview
- Ranking options:
  - Latest
  - Trending (weighted by likes/comments/reviews recency)

### F) Profile + social graph
- Profile header with follow/unfollow CTA.
- Stats: catches, sites added, reviews written.
- Activity snippets to drive discovery.

## 2.3 UI implementation sequence (small shippable slices)
1. **Slice 1:** Log Catch + Catch Detail (no social interactions).
2. **Slice 2:** Log Site + Site Detail with catches list.
3. **Slice 3:** Likes + comments + reviews.
4. **Slice 4:** Follow/unfollow + following/global feed.
5. **Slice 5:** Filtering/search + UX polish.

---

## 3) Prisma / DB model plan

## 3.1 Core entities
- `User`
- `Catch`
- `FishingSite`
- `Review`
- `Comment`
- `Follow`
- `Like` (or split likes by entity)
- `Image`
- `Gear` (optional normalized table) or embedded JSON on catch
- `Species` (optional but recommended)

## 3.2 Recommended schema shape

### User
- `id`, `username`, `displayName`, `bio`, `avatarUrl`, timestamps.

### FishingSite
- `id`, `createdById` (User FK), `name`, `description`, `latitude`, `longitude`, `waterType`, `accessNotes`, timestamps.
- Denormalized counters for performance:
  - `likeCount`
  - `reviewCount`
  - `catchCount`

### Catch
- `id`, `createdById` (User FK), `siteId` (nullable FK), `speciesId` (nullable FK),
- `title`, `notes`, `caughtAt`,
- `weight`, `length`, `count`,
- optional condition fields (`weather`, `waterTemp`, `depth`, etc.), timestamps.
- Denormalized counters:
  - `likeCount`
  - `commentCount`

### Review
- `id`, `siteId`, `userId`, `rating` (1-5), `body`, timestamps.
- Unique constraint: one review per user per site (optional policy).

### Comment
- `id`, `catchId`, `userId`, `body`, timestamps.

### Follow
- `followerId`, `followingId`, timestamps.
- Composite unique key: (`followerId`, `followingId`).

### Likes
Two options:
1. `CatchLike` and `SiteLike` tables (simple and explicit).
2. Generic `Like` table with polymorphic target (more flexible but more complex).

For speed and simplicity, start with split tables:
- `CatchLike(catchId, userId)`
- `SiteLike(siteId, userId)`
- Composite unique keys per table.

### Image
- `id`, `url`, `storageKey`, `uploadedById`, timestamps.
- Junction tables:
  - `CatchImage(catchId, imageId, position)`
  - `SiteImage(siteId, imageId, position)`

### Species (optional but valuable)
- `id`, `commonName`, `scientificName`, `aliases`, `regionTags`.

## 3.3 Query/index plan
- Indexes:
  - `Catch(createdById, caughtAt desc)`
  - `Catch(siteId, caughtAt desc)`
  - `Review(siteId, createdAt desc)`
  - `Comment(catchId, createdAt asc)`
  - `Follow(followerId)` and `Follow(followingId)`
- Feed query support:
  - Materialized feed table later if needed (`FeedEvent`) once scale requires.

## 3.4 Data integrity rules
- Allow `Catch.siteId = null`.
- Enforce not-null on ownership fields (`createdById`, etc.).
- Cascade deletes carefully:
  - If user deleted, soft-delete preferred.
  - If site deleted, preserve catches with `siteId` set null or archive policy.
- Prefer soft-delete columns (`deletedAt`) for user-generated content.

## 3.5 Migration sequence
1. Add core tables: `User`, `FishingSite`, `Catch`.
2. Add interaction tables: `Comment`, `Review`, `Follow`, `CatchLike`, `SiteLike`.
3. Add media tables: `Image`, junction tables.
4. Add optional normalization: `Species`, `Gear`.
5. Backfill denormalized counters + add DB triggers/app-level counter updates.

---

## 4) API/Service architecture plan

### 4.1 Modules
- `auth`
- `users`
- `sites`
- `catches`
- `reviews`
- `comments`
- `likes`
- `follows`
- `feed`
- `ai`

### 4.2 Endpoint examples
- `POST /catches`
- `GET /catches/:id`
- `POST /sites`
- `GET /sites/:id`
- `POST /sites/:id/reviews`
- `POST /catches/:id/comments`
- `POST /catches/:id/likes`, `DELETE /catches/:id/likes`
- `POST /sites/:id/likes`, `DELETE /sites/:id/likes`
- `POST /users/:id/follow`, `DELETE /users/:id/follow`
- `GET /feed?mode=following|global&sort=latest|trending`

### 4.3 Access control
- Auth required for create/like/comment/follow actions.
- Public read for feed and details (depending on privacy settings).
- Ownership checks for edit/delete.

---

## 5) AI plan: learn from DB data for fish + fishing-spot questions

## 5.1 Goal
Enable users to ask things like:
- "Best spots for pike in spring near me?"
- "What bait is working at Site X recently?"
- "What time of day has best catch rate for perch this month?"

## 5.2 Practical architecture (RAG over app data)
1. **Structured analytics layer (SQL first):**
   - Build curated SQL views for high-value facts:
     - catch frequency by species/site/time window
     - average weight/length by species/site
     - top gear per species/site
     - sentiment/rating trends for sites
2. **Unstructured retrieval layer (vector):**
   - Embed review text, catch notes, comments, and site descriptions.
   - Store embeddings in a vector store (e.g., pgvector in Postgres).
3. **Answer orchestration:**
   - For each question:
     - run intent classification (species/site/gear/timing/safety)
     - query SQL views for numeric facts
     - retrieve relevant text chunks
     - synthesize response with citations to source rows/entities

## 5.3 Data pipeline steps
- Event-driven jobs on create/update:
  - `CatchCreated`, `ReviewCreated`, `CommentCreated`, `SiteUpdated`.
- Worker tasks:
  - sanitize and chunk text
  - generate embeddings
  - update vector index
  - refresh aggregate tables/materialized views

## 5.4 AI safety and quality rules
- Always return confidence hints and timeframe (e.g., "based on last 90 days").
- Cite whether answer is from:
  - user-generated local data
  - global species knowledge (if external model knowledge used)
- Avoid overclaiming where data is sparse.
- Add guardrails for sensitive location privacy.

## 5.5 Feedback loop for continuous improvement
- Add thumbs up/down on AI answers.
- Store anonymized Q/A telemetry:
  - question type
  - retrieval sources used
  - user feedback
- Periodically evaluate:
  - factuality against SQL truth sets
  - helpfulness and coverage per intent category

## 5.6 Implementation sequence for AI
1. Ship read-only "Insights" endpoints from SQL aggregates (no LLM yet).
2. Add vector retrieval for reviews/notes.
3. Add LLM synthesis with strict prompt templates and citations.
4. Add feedback-driven tuning and prompt iteration.

---

## 6) Suggested execution backlog (2-week sprint style)

### Sprint 1
- Prisma models for `FishingSite`, `Catch`, and `Image` basics.
- `POST/GET` for sites and catches.
- Log Catch + Log Site UI forms.
- Catch and Site detail pages (basic).

### Sprint 2
- `CatchLike`, `SiteLike`, `Comment`, `Review`, `Follow` models and endpoints.
- Detail-page interactions (like/comment/review/follow).
- Initial feed endpoint + feed UI (latest only).

### Sprint 3
- Feed ranking + profile pages.
- Aggregate SQL views for "insights".
- AI v1 RAG with citations from DB-backed sources.

---

## 7) Definition of done per feature
- Schema migration created and applied.
- API route + validation + authorization complete.
- UI form/page complete with loading/error states.
- Telemetry added (at least basic events).
- Tests:
  - unit tests for service logic
  - integration tests for route + DB behavior
- Docs updated with API and data model notes.
