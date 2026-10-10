// Text-to-speech for story scripts via ElevenLabs, stored in the Media Manager.
import { getSecret } from 'wix-secrets-backend';
import { files } from '@wix/media';
import { auth } from '@wix/essentials';
import {
  SECRET_ELEVENLABS_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL_ID,
} from 'backend/gallery.config';

export async function synthesiseStory(story) {
  if (!ELEVENLABS_VOICE_ID || ELEVENLABS_VOICE_ID.startsWith('REPLACE')) {
    throw new Error('Set ELEVENLABS_VOICE_ID in backend/gallery.config.js first.');
  }
  const apiKey = await getSecret(SECRET_ELEVENLABS_KEY);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        // Paragraph breaks become short spoken pauses.
        text: String(story.transcript).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).join(' <break time="0.8s" /> '),
        model_id: ELEVENLABS_MODEL_ID,
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
      }),
    }
  );
  if (!res.ok) throw new Error(`ElevenLabs error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const audio = Buffer.from(await res.arrayBuffer());

  const fileName = `gallery-story-${story.slug || story.productId}.mp3`;
  const generate = auth.elevate(files.generateFileUploadUrl);
  const { uploadUrl } = await generate('audio/mpeg', { fileName });
  const upload = await fetch(`${uploadUrl}?filename=${encodeURIComponent(fileName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'audio/mpeg' },
    body: audio,
  });
  if (!upload.ok) throw new Error(`Media upload failed (${upload.status}).`);
  const { file } = await upload.json();
  return file.url;
}
