// Private Viewing Rooms - site configuration.
// Secrets (API keys) live in the Wix Secrets Manager, never in this file.

export const COLLECTIONS = {
  stories: 'PrintStories',
  rooms: 'PvrRooms',
  items: 'PvrRoomItems',
  requests: 'PvrRequests',
  events: 'PvrEvents',
};

export const ROUTER_PAGE = 'pvr-page';
export const ROOM_URL_PREFIX = '/pvr/';

export const HOLD_HOURS = 48;
export const DEFAULT_ROOM_DAYS = 14;
export const MAX_ROOM_ITEMS = 8;
export const MAX_REQUESTS_PER_ROOM_PER_DAY = 20;
export const MAX_MESSAGE_LENGTH = 2000;
// Products cheaper than this (cards, books) are left out of the room builder.
export const MIN_PRINT_PRICE = 100;

// Secrets Manager names.
export const SECRET_ELEVENLABS_KEY = 'ELEVENLABS_API_KEY';
export const SECRET_ANTHROPIC_KEY = 'ANTHROPIC_API_KEY';

// ElevenLabs stock narrator voice. Pick a warm British/Scottish curator voice
// from the ElevenLabs voice library and paste its ID here. Do not use a clone
// or imitation of Jack Vettriano's own voice.
export const ELEVENLABS_VOICE_ID = 'REPLACE_WITH_VOICE_ID';
export const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';

// Triggered email IDs (Dashboard > Settings > Triggered Emails). Leave empty
// to skip email; requests still appear in the director console.
export const EMAIL_DIRECTOR_ALERT = '';
export const EMAIL_COLLECTOR_UPDATE = '';
export const DIRECTOR_EMAIL = 'info@jackvettriano.studio';

export const EVENT_TYPES = [
  'room_open', 'print_dwell', 'audio_play', 'audio_progress',
  'transcript_open', 'view_in_room', 'provenance_open',
];
