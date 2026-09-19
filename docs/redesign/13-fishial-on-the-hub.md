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

and an `Authorization: Bearer {FISHIAL_TOKEN}` header. It answers:

```json
{ "candidates": [ { "name": "Lithognathus lithognathus", "commonName": "White steenbras", "confidence": 0.75 },
                  { "name": "Rhabdosargus holubi", "commonName": "Cape stumpnose", "confidence": 0.44 } ],
  "fishFound": true, "fishCount": 1 }
```

`name` is the classifier's scientific name; `commonName` is the English
Wikipedia title for that species where there is one, else null. The server
matches each guess to the species table by common or scientific name and
offers the best two. A guess the table does not have is offered anyway, by
its common name, and becomes a species if the angler takes it, so the catch
can still be scored. `GET /health` answers with the same header.

## On the hub (done 19 September 2026)

1. Fishial's code now lives at github.com/Wye-Foundation/Fishial-Fish-Identification
   (MIT). The weights are zips on `storage.googleapis.com/fishial-ml-resources`:
   `detector_v26_n3.zip` (YOLO26 nano, an Ultralytics `.pt`) and
   `classification_model_v0.10.2.zip` (DinoV2, 866 species, a TorchScript
   bundle with the vendor's own `inference.py` beside it). Both unpacked under
   `D:\hub\fishial\weights`.
2. The service is `/home/owen/fishial/server.py` (FastAPI, one photo through
   the GPU at a time, models kept loaded, warmed on start), in its own venv on
   the same ROCm torch wheels WhisperX uses. It runs as the user systemd unit
   `fishial` on port 8765 and takes about 0.6 s a photo with 700 MiB of VRAM,
   so it sits beside the chat model. CPU was tried and is 5 s a stage.
   `~/fishial/README.md` on the hub has the commands.
3. Reaching it from Railway: not Tailscale (Owen's call). A Cloudflare quick
   tunnel runs as the user unit `cloudflared` beside it. Its address is a
   random `*.trycloudflare.com` name that changes whenever cloudflared
   restarts; when that happens `FISHIAL_URL` on Railway has to be set again
   and the server redeployed (setting a variable does not redeploy on its
   own). The permanent fix is a domain in Owen's Cloudflare account and a
   named tunnel; the account had none on 19 September.
4. On Railway, `FISHIAL_URL` and `FISHIAL_TOKEN` are set on the `server`
   service. Until they are set the app simply does not offer a name.

## What the app does with it

After a photo goes up on either log form, the app asks for the top two names
and offers them as "Is this a Galjoen, or a Blacktail?" with "Neither, I will
type it". The angler's answer is what is saved; a guess is never written to a
catch on its own. A name the table does not have yet (the classifier knows
866 species, the table started with 24) is offered all the same and is added
as a species when taken. With several photos, only the first is asked about.

## It learns from what the angler settles on (19 September 2026)

The classifier is an embedding model: it turns the fish crop into a 768-float
vector and scores species by cosine similarity to a centroid per species.
That makes learning cheap, with no retraining:

- **Every saved catch teaches the hub.** After a catch is created or edited
  the server posts its first photograph and its species to `POST /learn`
  (`{ image, mediaType, catchId, userId, species: { id, commonName,
  scientificName } }`), never awaited by the request. The hub finds the fish,
  embeds the crop and keeps the vector in `D:\hub\fishial\gallery\gallery.jsonl`
  under the species the angler chose, with the crop beside it as a jpeg for a
  real retraining one day. It also notes what `/identify` had guessed for that
  photograph, so the gallery doubles as a record of the namer's misses. A
  catch with no species, or a photo with no fish in it, teaches nothing. An
  edit that changes the species replaces the earlier lesson (keyed by catch).
- **Every question consults the gallery.** `/identify` scores the new photo
  against the confirmed examples as well as the model's centroids and merges
  the two. A learned species is offered once it has `FISHIAL_LEARN_MIN`
  confirmed examples (2) and the new photo is at least `FISHIAL_LEARN_SIM`
  (0.5 cosine) like one of them. It comes back with the app's own `speciesId`,
  `learned: true` and the example count, and the form marks it "learned".
- **So a fish the model has never heard of** (bigmouth yellowfish, say, which
  is not among the 866) starts being offered after two confirmed catches of it.
- **Guarding against bad labels.** Two examples before a name is offered, a
  similarity floor, and the gallery keeps who taught what, so a wrong lesson
  can be found and removed by catch id. Sibling species that look alike on a
  phone photo (smallmouth and bigmouth yellowfish) may still be confused; the
  gallery gives the right name a chance it otherwise never has.

Also fixed the same day: the classifier expects RGB and had been fed
OpenCV's BGR, so every colour was swapped. Scores on the test photos went up
with the fix (the kob photo is now Argyrosomus japonicus on top).

## The competition reader is different

Reading a length or a weight off a photograph of the fish on a tape or a
scale is done by Claude Haiku 4.5 through the Anthropic API, not by the hub.
It needs `ANTHROPIC_API_KEY` on the `server` service. It costs well under a
cent a photograph and is only called when an angler logs a catch for a
competition. Without the key the competition entry still saves, unread.
