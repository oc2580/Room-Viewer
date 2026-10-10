# Setting up the Interactive Gallery on jackvettriano.studio

Everything below happens in the Wix Editor (Velo is already enabled on the site).
These CMS collections already exist and are admin-only (visitors can never read
them directly; every request goes through the backend code):
`PrintStories` (shown as "PVR Print Stories"), `GalleryTours`, `GalleryLeads`,
`GalleryRequests`, `GalleryEvents`. Their fields are recorded in
`wix/cms-schema.json`.

## 1. Packages

Code panel > Packages & Apps > npm, install:

- `@wix/stores`, `@wix/ecom`, `@wix/media`, `@wix/essentials` (prices of framed
  and unframed options, Add to basket, audio uploads)
- `@anthropic-ai/sdk` only if you want the "Draft with Claude" button

## 2. Backend code

Under **Backend**, create these files and paste in the contents from `wix/backend/`:

| File | What it does |
|---|---|
| `gallery.config.js` | Settings: reservation length, offer floor, voice ID, email template IDs, lead scoring |
| `gallery-lib.js` | Shared helpers |
| `gallery.web.js` | Visitor actions: gallery data, framing prices, reservations, offers, questions, counter-offer replies, analytics |
| `gallery-console.web.js` | Studio console actions (admin only) |
| `gallery-notify.js` | Triggered-email notifications (optional) |
| `gallery-audio.js` | ElevenLabs text-to-speech into the Media Manager |
| `gallery-claude.web.js` | "Draft with Claude" for newly added prints (optional) |
| `gallery-seed.js` | The 68 starter scripts and 5 starter tours (generated; do not edit) |
| `gallery-jobs.js` + `jobs.config` | Hourly job that releases expired 48-hour reservations |

## 3. The Gallery page (`/gallery`)

1. Add a blank page called **Gallery** with the URL `/gallery`, and add it to
   the site menu.
2. Add **Embed Code > Custom Element**. Choose *Velo file*, create
   `public/custom-elements/jv-gallery.js` with the contents of
   `wix/public/custom-elements/jv-gallery.js`, set the tag name to `jv-gallery`
   and the element ID to `jvGallery`. Stretch it to full width.
3. Paste `wix/pages/gallery-page.js` into the page code.

Links you can share:
`/gallery?tour=by-the-sea` starts a tour,
`/gallery?print=<product id>` opens a print, and shortlists shared by visitors
arrive as `/gallery?shortlist=...`.

## 4. The Studio console

1. Pages > **Dashboard Pages** > Add, name it *Gallery*.
2. Add a Custom Element with source `public/custom-elements/jv-console.js`
   (contents from `wix/public/custom-elements/jv-console.js`), tag name
   `jv-console`, ID `jvConsole`, full width.
3. Paste `wix/pages/gallery-console.js` into its page code.
4. Publish, open the dashboard page, go to **Story library** and click
   **Import**. The 68 scripts and 5 tours arrive as drafts.
5. Approve the scripts you have checked (each one then appears in the
   gallery), and publish the tours you want on the page.

## 5. Voice-over audio (ElevenLabs)

The narrator is **George**, a stock ElevenLabs voice (warm British
storyteller) chosen by audition; it is already set in `ELEVENLABS_VOICE_ID`
in `gallery.config.js`, using the `eleven_v4` model. Do **not** clone or
imitate Jack Vettriano's own voice.

1. Dashboard > Developer Tools > **Secrets Manager**: add `ELEVENLABS_API_KEY`
   (needs a paid ElevenLabs plan; all 68 stories take about 67,000 credits).
2. In the Story library, click **Generate audio** on each approved story
   (about 20 seconds each). Stories that already have recorded audio keep it
   until their script changes.

Until a story has audio, visitors can read it as text. Editing an approved
script takes it out of the gallery until you approve it again, and old audio
stops playing, so visitors never hear a script that no longer matches the text.

## 6. Privacy and the cookie banner

The gallery records engagement (prints opened, time spent, stories played,
wall views, shortlists) only for visitors who allow **analytics** cookies in the
site's cookie banner (Settings > Privacy & Cookies). Visitors who decline still
get every feature; they just don't appear in Insights until they send a request.

When a visitor sends a reservation, offer or question, they give their name and
email, and the request form tells them the Studio will use it to reply. Add a
line to the site's privacy policy explaining that gallery activity is linked to
an enquiry so the Studio can advise the visitor.

## 7. Optional: email alerts

Create two Triggered Emails (Marketing > Triggered Emails):

- a **Studio alert** with variables `visitorName`, `visitorEmail`,
  `printTitle`, `requestType`, `message`
- a **visitor update** with `visitorName`, `printTitle`, `headline`, `reply`,
  `galleryUrl`

Paste their IDs into `EMAIL_STUDIO_ALERT` and `EMAIL_VISITOR_UPDATE`. Without
them, requests still appear in the console under **Requests**, and replies
still appear in the visitor's **My requests**.

## How selling works

| Visitor does | What happens |
|---|---|
| **Add to basket** | Goes into the normal Wix basket and checkout, with the framed or unframed option chosen |
| **Reserve for 48 hours** | You confirm or decline in the console. A confirmed reservation shows the print as reserved to everyone else, and is released automatically after 48 hours |
| **Make an offer** | Offers below 70% of the list price are turned away in the form (change `MIN_OFFER_SHARE`). You accept, decline or send a counter-offer; the visitor accepts or declines the counter in My requests, and you confirm the sale |
| **Ask a question / Ask about my shortlist** | You reply in the console; the reply shows in their gallery and by email |
| **Shortlist, compare, share** | Kept on their device; a shared link opens the same shortlist for someone else |

Payment for offers and reservations stays with the Studio, for example Wix
Invoices or Pay Links.

The **Leads** tab ranks visitors who have sent a request by what they did in
the gallery, shows what they looked at and shortlisted, and suggests a next
step. **Insights** shows which prints and tours hold attention.
