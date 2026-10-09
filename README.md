# Room-Viewer: the Interactive Gallery for Jack Vettriano Studio

An immersive gallery page for every visitor to jackvettriano.studio. Each print
has a narrated story, its provenance, and a true-scale "see it on your wall"
view. Visitors can take guided audio tours, shortlist and compare prints, share
a shortlist, add to the basket, reserve a print for 48 hours, make an offer, or
ask the Studio a question.

Behind it, the Studio console turns that activity into sales: a ranked list of
leads with what each person looked at, a requests inbox with counter-offers,
tour and story management, and insights on which prints hold attention.

## Try it offline

Open `demo/gallery-demo.html` in any browser; no website or account needed.
Switch between the **Visitor's gallery** and the **Studio console** from the top
bar. Reserve a print or make an offer as a visitor, answer it in the console,
then go back to the gallery to see the reply or accept the counter-offer. **Be a
new visitor** starts a fresh visitor; **Reset demo** clears everything. Stories
are read by the computer's own voice; print images load when you are online.

## What's here

| Path | Contents |
|---|---|
| `content/stories/*.md` | Curator voice-over scripts for all 68 priced prints, with themes, edition facts and review notes |
| `data/catalogue.json` | The priced prints pulled from the Wix store |
| `data/stories.json` | Scripts compiled by `tools/build-stories.mjs` |
| `wix/backend/` | Velo backend: gallery and console web methods, ElevenLabs audio, Claude drafting, reservation expiry |
| `wix/public/custom-elements/` | `<jv-gallery>` (visitors) and `<jv-console>` (Studio) |
| `wix/pages/` | Page code for the Gallery page and the dashboard page |
| `wix/cms-schema.json` | CMS collections (already created on the site) |
| `demo/gallery-demo.html` | Offline demo of both screens working together |
| `docs/SETUP.md` | Step-by-step installation in the Wix Editor |

## Working on the scripts

Edit a file in `content/stories/`, then run:

```sh
node tools/build-stories.mjs   # validate, rebuild data/stories.json and the backend seed
node tools/build-demo.mjs      # rebuild demo/gallery-demo.html
```

Scripts use only facts from the Studio's own product copy, never quote a price
(prices and offers are shown on screen), and stay drafts until the Studio
approves them. Narration uses a stock ElevenLabs voice, not an imitation of the
artist.
