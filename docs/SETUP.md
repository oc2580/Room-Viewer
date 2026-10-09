# Setting up Private Viewing Rooms on jackvettriano.studio

Everything below happens in the Wix Editor (Velo is already enabled on the site).
The five CMS collections are already created and are admin-only:
`PrintStories`, `PvrRooms`, `PvrRoomItems`, `PvrRequests`, `PvrEvents`
(their schema is recorded in `wix/cms-schema.json`).

## 1. Backend code

In the Editor's Code panel, under **Backend**, create these files and paste in
the contents from `wix/backend/`:

| File | What it does |
|---|---|
| `pvr.config.js` | Settings: hold length, voice ID, email template IDs |
| `pvr-lib.js` | Shared helpers (room payload, holds, images) |
| `pvr-notify.js` | Triggered-email notifications (optional) |
| `pvr.web.js` | Collector actions: requests, analytics |
| `pvr-director.web.js` | Director console actions (admin only) |
| `pvr-audio.js` | ElevenLabs text-to-speech into the Media Manager |
| `pvr-claude.web.js` | "Draft with Claude" for newly added prints (optional) |
| `pvr-seed.js` | The 68 starter scripts (generated - do not edit) |
| `pvr-jobs.js` + `jobs.config` | Hourly job that releases expired 48-hour holds |

`routers.js` is created by Wix in step 2; replace its contents with
`wix/backend/routers.js`.

**Packages** (Code panel > Packages & Apps > npm): install `@wix/media` and
`@wix/essentials` (needed for audio upload). Install `@anthropic-ai/sdk` only
if you want the "Draft with Claude" button.

## 2. The collector's room: `/pvr/<name>`

1. Pages > **Add router**, URL prefix `pvr`. Wix creates `routers.js` and a
   router page called `pvr-page`.
2. On `pvr-page`, delete the sample elements and add **Embed Code > Custom
   Element**. Choose *Velo file*, create `public/custom-elements/pvr-room.js`
   with the contents of `wix/public/custom-elements/pvr-room.js`, set the tag
   name to `pvr-room` and the element ID to `pvrRoom`. Stretch it to full width.
3. Paste `wix/pages/pvr-page.js` into the page code.
4. In the page's SEO settings, leave it out of search (the router also sends
   `noindex`).

Room URLs look like `https://www.jackvettriano.studio/pvr/johnson-k3f9q2m7x1`.
The random suffix is what keeps a room private, so share links one-to-one.

## 3. The director console

1. Pages > **Dashboard Pages** > Add, name it *Viewing Rooms*.
2. Add a Custom Element with source `public/custom-elements/pvr-director.js`
   (contents from `wix/public/custom-elements/pvr-director.js`), tag name
   `pvr-director`, ID `pvrDirector`, full width.
3. Paste `wix/pages/pvr-dashboard.js` into its page code.
4. Publish the site, open the dashboard page, go to **Story library** and click
   **Import stories**. All 68 scripts arrive as drafts.

## 4. Voice-over audio (ElevenLabs)

1. Create an ElevenLabs account and pick a stock narrator voice: a warm British
   or Scottish curator voice works well. Do **not** clone or imitate Jack
   Vettriano's own voice.
2. Dashboard > Developer Tools > **Secrets Manager**: add `ELEVENLABS_API_KEY`.
3. Put the voice's ID in `ELEVENLABS_VOICE_ID` in `pvr.config.js`.
4. In the Story library, approve a script (after checking it against the
   product page and its review notes), then click **Generate audio**. Each
   story takes about 20 seconds and is saved to the Media Manager.

Editing an approved script returns it to draft, and the old audio stops
playing until you regenerate it, so collectors never hear a script that no
longer matches the text.

## 5. Optional extras

- **Email alerts.** Create two Triggered Emails (Marketing > Triggered Emails):
  a *director alert* with variables `collectorName`, `printTitle`,
  `requestType`, `message`, and a *collector update* with `collectorName`,
  `printTitle`, `headline`, `reply`, `roomUrl`. Paste their IDs into
  `EMAIL_DIRECTOR_ALERT` and `EMAIL_COLLECTOR_UPDATE`. Without them, requests
  still appear in the console under **Requests**.
- **Draft with Claude.** Add `ANTHROPIC_API_KEY` to the Secrets Manager and
  install `@anthropic-ai/sdk`. Used when you add a new print to the library;
  drafts are always marked for review and never go live until approved.

## How a room works

1. **Rooms > New room**: collector name and email, a welcome note, an optional
   voice note (record in the browser or upload), and when the room closes.
2. **Add prints** from the live store (3-5 is ideal, up to 8). Reorder or
   remove them at any time; add a personal note and optionally a private
   offer price with an end date. **Save**, **Preview**, then **Go live** and
   copy the link.
3. The collector listens to each story, reads the transcript, opens the
   provenance details, sees the print at true scale on a sample wall or a
   photo of their own wall, and can request a 48-hour hold, ask a question or
   accept the private offer.
4. Requests appear in **Requests**. Confirming a hold reserves the print for 48
   hours across all rooms; it is released automatically. Payment and
   invoicing stay with the Studio (e.g. Wix Invoices or Pay Links).
5. The room's **Engagement** panel shows visits, time spent on each print,
   story plays and how far they listened, transcript reads and
   view-on-wall use.
