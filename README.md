# Room-Viewer: Private Viewing Rooms for Jack Vettriano Studio

A white-glove sales experience embedded in the Studio's Wix site. A director
curates a handful of prints for one collector and sends a private link
(`jackvettriano.studio/pvr/<name>-<code>`). Inside the room, every print has a
narrated story, its provenance, a true-scale "see it on your wall" view, and
buttons to request a 48-hour hold, ask a question or accept a private offer.

## What's here

| Path | Contents |
|---|---|
| `content/stories/*.md` | Curator voice-over scripts for all 68 priced prints, with edition facts and review notes |
| `data/catalogue.json` | The priced prints pulled from the Wix store |
| `data/stories.json` | Scripts compiled for import (`node tools/build-stories.mjs`) |
| `wix/backend/` | Velo backend: router, web methods, ElevenLabs audio, hold expiry, Claude drafting |
| `wix/public/custom-elements/` | `<pvr-room>` (collector) and `<pvr-director>` (Studio console) |
| `wix/pages/` | Page code for the router page and the dashboard page |
| `wix/cms-schema.json` | CMS collections (already created on the site) |
| `preview/` | Self-contained demos of both screens with sample data |
| `docs/SETUP.md` | Step-by-step installation in the Wix Editor |

## Working on the scripts

Edit a file in `content/stories/`, then run:

```sh
node tools/build-stories.mjs          # validate + rebuild data/stories.json and the seed
node tools/build-preview.mjs          # rebuild preview/index.html
node tools/build-director-preview.mjs # rebuild preview/director.html
```

Scripts use only facts from the Studio's own product copy, never quote a price
(prices and private offers are shown on screen), and stay drafts until the
Studio approves them. Narration uses a stock ElevenLabs voice, not an imitation
of the artist.
