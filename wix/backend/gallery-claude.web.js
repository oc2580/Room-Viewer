// "Draft with Claude": writes a first-draft curator script for a print that
// has just been added to the story library. Kept in its own file so the rest
// of the gallery backend works even if @anthropic-ai/sdk is not installed.
import { Permissions, webMethod } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';
import Anthropic from '@anthropic-ai/sdk';
import { COLLECTIONS, SECRET_ANTHROPIC_KEY, THEMES } from 'backend/gallery.config';
import { cleanText } from 'backend/gallery-lib';

const AUTH = { suppressAuth: true };

const SYSTEM = `You write the narration for Jack Vettriano Studio's Interactive Gallery: a short voice-over a visitor hears while looking at one print.

Voice: a warm, knowledgeable curator speaking to one collector. Third person about the artist. British English. Spoken rhythm: short paragraphs, sentences that read naturally aloud, no lists, no headings, no stage directions.

Length: 150 to 200 words (60 to 80 seconds spoken).

Shape: open on the image or its title; then what the painting suggests and where it sits in Vettriano's work; then what makes this edition collectable (edition size, signature or Estate stamp, paper or finish, Artist's Proof); close with where it lives well in a home or why a collector would want it.

Accuracy rules - these matter more than style:
- Use only facts stated in the product copy you are given. Do not add dates, exhibitions, sitters, owners, prices or anecdotes from memory.
- Never mention the price; it is shown on screen and may be a private offer.
- Do not describe parts of the image the copy does not describe.
- Write numbers as words, as a narrator would say them.
- If the copy is thin or contradicts itself, keep the script to what is certain and explain the problem in reviewNotes.

Choose the gallery themes that genuinely fit the painting from the allowed list (one to three; none if nothing fits).

Also extract the edition facts from the copy for the provenance panel. Use an empty string when the copy does not say. Sizes are "width x height" in centimetres.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['transcript', 'themes', 'edition', 'medium', 'signed', 'imageSizeCm', 'mountSizeCm', 'framedSizeCm', 'reviewNotes'],
  properties: {
    themes: { type: 'array', items: { type: 'string', enum: THEMES } },
    transcript: { type: 'string' },
    edition: { type: 'string' },
    medium: { type: 'string' },
    signed: { type: 'boolean' },
    imageSizeCm: { type: 'string' },
    mountSizeCm: { type: 'string' },
    framedSizeCm: { type: 'string' },
    reviewNotes: { type: 'string' },
  },
};

function htmlToText(html) {
  return String(html || '')
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const draftStoryWithClaude = webMethod(Permissions.Admin, async (storyId) => {
  const story = await wixData.get(COLLECTIONS.stories, storyId, AUTH);
  if (!story) throw new Error('Story not found.');
  const productRes = await wixData.query('Stores/Products').eq('_id', story.productId).find(AUTH);
  const product = productRes.items[0];
  if (!product) throw new Error('Product not found in the store.');

  // Two approved scripts show the house style better than any description.
  const examples = await wixData.query(COLLECTIONS.stories)
    .eq('status', 'approved').isNotEmpty('transcript').limit(2).find(AUTH);
  const exampleText = examples.items
    .map((s) => `<example title="${s.title}">\n${s.transcript}\n</example>`).join('\n\n');

  const client = new Anthropic({ apiKey: await getSecret(SECRET_ANTHROPIC_KEY) });
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: SCHEMA },
    },
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `${exampleText ? `Approved scripts for reference:\n\n${exampleText}\n\n` : ''}Write the script for this print.\n\n<product_title>${product.name}</product_title>\n<product_copy>\n${htmlToText(product.description)}\n</product_copy>`,
    }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to draft this script. Please write it by hand.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('The draft was cut off. Please try again.');
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const draft = JSON.parse(text);

  const transcript = cleanText(draft.transcript, 8000);
  const words = transcript.split(/\s+/).filter(Boolean).length;
  return wixData.update(COLLECTIONS.stories, {
    ...story,
    transcript,
    themes: (draft.themes || []).filter((t) => THEMES.includes(t)).slice(0, 3).join(', '),
    edition: cleanText(draft.edition, 300),
    medium: cleanText(draft.medium, 300),
    signed: !!draft.signed,
    imageSizeCm: cleanText(draft.imageSizeCm, 40),
    mountSizeCm: cleanText(draft.mountSizeCm, 40),
    framedSizeCm: cleanText(draft.framedSizeCm, 40),
    reviewNotes: cleanText(`Drafted by Claude - check every fact against the product copy before approving. ${draft.reviewNotes || ''}`, 2000),
    wordCount: words,
    estDurationSec: Math.round((words / 150) * 60),
    status: 'draft',
  }, AUTH);
});
