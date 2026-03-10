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

## Google Weather API setup (catch weather snapshot)

The server weather endpoint (`/api/weather/current`) calls Google Weather API from the backend and requires a **server-side** key:

```bash
# packages/server/.env.local
GOOGLE_WEATHER_API_KEY=your_server_key_here
```

Notes:
- Enable the **Weather API** for this key in Google Cloud.
- If your key is restricted, allow server-to-server requests (IP/app restriction), not browser referrer-only usage.
- A key that only works for Maps JavaScript in the browser can return weather lookup failures on the server.
