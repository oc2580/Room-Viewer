// Interactive Gallery - site configuration.
// Secrets (API keys) live in the Wix Secrets Manager, never in this file.

export const COLLECTIONS = {
  stories: 'PrintStories',
  tours: 'GalleryTours',
  leads: 'GalleryLeads',
  requests: 'GalleryRequests',
  events: 'GalleryEvents',
};

export const GALLERY_URL = 'https://www.jackvettriano.studio/gallery';
export const STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';

export const HOLD_HOURS = 48;
export const MAX_TOUR_PRINTS = 10;
export const MAX_REQUESTS_PER_VISITOR_PER_DAY = 10;
export const MAX_MESSAGE_LENGTH = 2000;
// Products cheaper than this (cards, books) are left out of the gallery.
export const MIN_PRINT_PRICE = 100;
// Offers below this share of the list price are declined politely in the
// form itself, so the Studio only sees serious offers. Set to 0 to allow any.
export const MIN_OFFER_SHARE = 0.7;

export const THEMES = [
  'By the sea', 'After dark', 'Romance', 'Quiet moments',
  'Style & society', 'Portraits', 'Final editions', 'Rare editions',
];

// Engagement points used to rank leads in the console.
export const LEAD_POINTS = {
  print_open: 1, print_dwell_minute: 1, audio_play: 2, audio_complete: 4,
  transcript_open: 1, provenance_open: 2, view_in_room: 4, shortlist_add: 5,
  tour_complete: 3, add_to_basket: 8, request: 15,
};

export const SECRET_ELEVENLABS_KEY = 'ELEVENLABS_API_KEY';
export const SECRET_ANTHROPIC_KEY = 'ANTHROPIC_API_KEY';

// ElevenLabs stock narrator voice: "George", a warm British storyteller chosen
// by audition. Do not use a clone or imitation of Jack Vettriano's own voice.
export const ELEVENLABS_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
export const ELEVENLABS_MODEL_ID = 'eleven_v4';

// Triggered email IDs (Marketing > Triggered Emails). Leave empty to skip
// email; requests still appear in the console.
export const EMAIL_STUDIO_ALERT = '';
export const EMAIL_VISITOR_UPDATE = '';
export const STUDIO_EMAIL = 'info@jackvettriano.studio';

export const EVENT_TYPES = [
  'gallery_open', 'print_open', 'print_dwell', 'audio_play', 'audio_progress',
  'transcript_open', 'provenance_open', 'view_in_room', 'shortlist_add',
  'shortlist_remove', 'shortlist_share', 'tour_start', 'tour_complete',
  'add_to_basket', 'filter',
];
