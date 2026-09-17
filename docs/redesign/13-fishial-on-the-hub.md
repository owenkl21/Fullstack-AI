# The fish namer, running on the hub

The app names a fish from its photograph by asking a small service that runs
on the hub PC (the Ryzen box with the RX 9070 XT). The service wraps Fishial's
open recognition model. Nothing about the model lives in this repo; only the
contract the server speaks to it.

## The contract

`POST {FISHIAL_URL}/identify` with a JSON body:

```json
{ "image": "<base64 of the photo>", "mediaType": "image/jpeg" }
```

and an optional `Authorization: Bearer {FISHIAL_TOKEN}` header. It answers:

```json
{ "candidates": [ { "name": "Galjoen", "confidence": 0.91 },
                  { "name": "Blacktail", "confidence": 0.07 } ] }
```

Names may be common or scientific; the server matches them to the species
table either way and hands the app the best two. Anything it cannot match is
shown to the angler as what the namer said, so they can pick or type.

## On the hub

1. Fishial's model and code: https://github.com/fishial/fish-identification
   (the "Fish Detector" and "Fish Classifier" weights are on the releases page).
   Put it under `C:\hub\fishial\` on the box; WSL2 with ROCm is already set
   up for WhisperX, and the same environment runs this.
2. Wrap it in a small FastAPI app that exposes `/identify` as above. Decode
   the base64, run the detector, crop to the best box, run the classifier,
   return the top five labels with their softmax scores. Keep the model
   loaded between requests. Bind to `127.0.0.1:8765`.
3. Expose it to Railway. The hub is on the tailnet and Railway is not, so
   use a Tailscale Funnel on the hub: `tailscale funnel 8765` gives a public
   `https://<box>.<tailnet>.ts.net` address. Put a bearer token in front of
   it in the FastAPI app and set the same value as `FISHIAL_TOKEN`.
4. On Railway, set `FISHIAL_URL=https://<box>.<tailnet>.ts.net` and
   `FISHIAL_TOKEN=<the token>` on the `server` service. Until they are set the
   app simply does not offer a name, and nothing else changes.

## What the app does with it

After a photo goes up on either log form, the app asks for the top two names
and offers them as "Is this a Galjoen, or a Blacktail?" with "Neither". The
angler's answer is what is saved; a guess is never written to a catch on its
own. With several photos, only the first is asked about.

## The competition reader is different

Reading a length or a weight off a photograph of the fish on a tape or a
scale is done by Claude Haiku 4.5 through the Anthropic API, not by the hub.
It needs `ANTHROPIC_API_KEY` on the `server` service. It costs well under a
cent a photograph and is only called when an angler logs a catch for a
competition. Without the key the competition entry still saves, unread.
