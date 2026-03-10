# fullstack-ai

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Google Maps setup (fishing site pin picker)

Set a Google Maps JavaScript API key for the client app:

```bash
# packages/client/.env.local
VITE_GOOGLE_MAPS_API_KEY=your_key_here
```

Without this key, the site log/edit forms still work but the interactive draggable map pin is disabled.

This project was created using `bun init` in bun v1.3.10. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
