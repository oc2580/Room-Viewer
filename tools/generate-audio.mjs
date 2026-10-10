// Generates story narration with ElevenLabs.
//
//   node tools/generate-audio.mjs audition            3 candidate voices reading one story
//   node tools/generate-audio.mjs all [--voice=<id>]  every story (default voice: George)
//   node tools/generate-audio.mjs one <slug> [--voice=<id>]
//   add --dry-run to see what would be generated without calling the API
//
// Needs ELEVENLABS_API_KEY in the environment. Writes MP3s to audio/ and a
// manifest (audio/manifest.json) recording which voice and script produced
// each file, so changed scripts are regenerated and unchanged ones skipped.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// ELEVENLABS_API_BASE is only for testing against a local stand-in server.
const API = process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io';
const MODEL = 'eleven_v4';
const AUDITION_SLUG = 'young-hearts';
const SETTINGS = { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true };

const args = process.argv.slice(2);
const mode = args[0];
const GEORGE = 'JBFqnCBsd6RMkjVDRZzb'; // chosen narrator
const flag = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];
const dryRun = args.includes('--dry-run');
const key = process.env.ELEVENLABS_API_KEY;
const outDir = join(root, 'audio');
const manifestPath = join(outDir, 'manifest.json');

if (!['audition', 'all', 'one'].includes(mode)) {
  console.error('Usage: node tools/generate-audio.mjs audition | all [--voice=<id>] | one <slug> [--voice=<id>] [--dry-run]');
  process.exit(1);
}
if (!key && !dryRun) {
  console.error('ELEVENLABS_API_KEY is not set. Add it to the environment and start a new session.');
  process.exit(1);
}

const stories = JSON.parse(readFileSync(join(root, 'data/stories.json'), 'utf8'));
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

// Blank lines between paragraphs give the narrator a natural pause.
export function narrationText(transcript) {
  return transcript.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).join('\n\n');
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { 'xi-api-key': key, ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

async function speak(voiceId, text, file) {
  const res = await api(`/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
  });
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const norm = (v) => String(v || '').toLowerCase();

// Candidates from the account's own voices first, then the public voice library.
async function findCandidates() {
  const own = (await (await api('/v1/voices')).json()).voices || [];
  const pool = own.map((v) => ({ id: v.voice_id, name: v.name, accent: norm(v.labels && v.labels.accent), gender: norm(v.labels && v.labels.gender),
    age: norm(v.labels && v.labels.age), use: norm(v.labels && (v.labels.use_case || v.labels['use case'])), desc: norm(v.labels && v.labels.description), source: 'your voices' }));
  for (const accent of ['scottish', 'british']) {
    try {
      const res = await api(`/v1/shared-voices?page_size=30&accent=${accent}&language=en&sort=usage_character_count_1y`);
      for (const v of (await res.json()).voices || []) {
        pool.push({ id: v.voice_id, name: v.name, accent: norm(v.accent), gender: norm(v.gender), age: norm(v.age), use: norm(v.use_case),
          desc: norm(v.descriptive || v.description), source: 'voice library', publicOwnerId: v.public_owner_id });
      }
    } catch (err) {
      console.warn(`Voice library search for ${accent} voices failed: ${err.message}`);
    }
  }
  const storyish = (v) => /narrat|story|audiobook|documentary|informative/.test(`${v.use} ${v.desc}`);
  const pick = (test, label) => {
    const list = pool.filter(test);
    const best = list.find(storyish) || list[0];
    return best ? { ...best, label } : null;
  };
  return [
    pick((v) => /scot/.test(v.accent) && v.gender === 'male', 'Scottish male'),
    pick((v) => /british|english|uk/.test(v.accent) && v.gender === 'male' && !/young/.test(v.age), 'British male'),
    pick((v) => /british|english|uk|scot/.test(v.accent) && v.gender === 'female', 'British female'),
  ].filter(Boolean);
}

function loadManifest() {
  return existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  if (mode === 'audition') {
    const story = stories.find((s) => s.slug === AUDITION_SLUG);
    if (dryRun) { console.log(`Would audition 3 voices reading "${story.title}" (${story.wordCount} words).`); return; }
    const candidates = await findCandidates();
    if (!candidates.length) throw new Error('No suitable voices found.');
    mkdirSync(join(outDir, 'audition'), { recursive: true });
    for (const c of candidates) {
      const file = join(outDir, 'audition', `${c.label.toLowerCase().replace(/\s+/g, '-')}.mp3`);
      if (c.source === 'voice library' && c.publicOwnerId) {
        // Library voices may need adding to the account before they can speak.
        try {
          const added = await (await api(`/v1/voices/add/${c.publicOwnerId}/${c.id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_name: `JVS ${c.label} - ${c.name}` }),
          })).json();
          if (added.voice_id) c.id = added.voice_id;
        } catch (err) {
          console.warn(`Could not add ${c.name} to your voices (${err.message}); trying it directly.`);
        }
      }
      await speak(c.id, narrationText(story.transcript), file);
      console.log(`${c.label}: ${c.name} (${c.source}, id ${c.id}) -> ${file}`);
    }
    writeFileSync(join(outDir, 'audition', 'voices.json'), JSON.stringify(candidates, null, 2));
    return;
  }

  const voice = flag('voice') || GEORGE;
  const targets = mode === 'one' ? stories.filter((s) => s.slug === args[1]) : stories;
  if (!targets.length) throw new Error(`No story with slug ${args[1]}`);
  const manifest = loadManifest();
  let made = 0;
  for (const s of targets) {
    const text = narrationText(s.transcript);
    const h = hash(`${voice}|${MODEL}|${JSON.stringify(SETTINGS)}|${text}`);
    if (manifest[s.slug] && manifest[s.slug].hash === h && existsSync(join(outDir, `${s.slug}.mp3`))) continue;
    if (dryRun) { console.log(`would generate ${s.slug} (${s.wordCount} words)`); made += 1; continue; }
    await speak(voice, text, join(outDir, `${s.slug}.mp3`));
    manifest[s.slug] = { hash: h, voice, model: MODEL, words: s.wordCount, generatedAt: new Date().toISOString() };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    made += 1;
    console.log(`${made}/${targets.length} ${s.slug}`);
  }
  console.log(`${made} file${made === 1 ? '' : 's'} ${dryRun ? 'to generate' : 'generated'}; ${targets.length - made} already up to date.`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
