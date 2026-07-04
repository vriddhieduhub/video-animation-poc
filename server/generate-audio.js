#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * generate-audio.js  —  Edge TTS audio cue generator (FREE, no API key)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Usage:
 *   npm run generate-audio
 *   npm run generate-audio -- --script server/audio-script.json
 *   npm run generate-audio -- --only scene_01_seq_01.mp3
 *   npm run generate-audio -- --voice en-GB-SoniaNeural
 *   npm run generate-audio -- --list-voices
 *
 * Output:  client/public/audio/<filename>.mp3
 *
 * Powered by Microsoft Edge TTS via edge-tts-node (free, no auth required).
 * Voices stream from the same speech service Edge browser uses internally.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createRequire } from 'module';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// edge-tts-node is CJS, require it via createRequire
const require = createRequire(import.meta.url);
const { MsEdgeTTS, OUTPUT_FORMAT } = require('edge-tts-node');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── CLI argument parsing ─────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const flag        = (name) => args.includes(name);
const opt         = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const SCRIPT_PATH  = opt('--script')  || path.join(__dirname, 'audio-script.json');
const ONLY_FILE    = opt('--only')    || null;
const VOICE_OVERRIDE = opt('--voice') || null;
const LIST_VOICES  = flag('--list-voices');

// ── Output directory ─────────────────────────────────────────────────────────
const OUT_DIR = path.join(ROOT, 'client', 'public', 'audio');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── List voices helper ────────────────────────────────────────────────────────
async function listVoices() {
  console.log('\n🔍 Fetching available Edge TTS voices...\n');
  const tts    = new MsEdgeTTS({});
  const voices = await tts.getVoices();
  const en     = voices.filter((v) => v.Locale.startsWith('en'));
  console.log(`Found ${voices.length} total voices, ${en.length} English:\n`);
  en.forEach((v) => {
    console.log(`  ${v.ShortName.padEnd(35)} ${v.Gender.padEnd(8)} ${v.Locale}`);
  });
  console.log('\nAll locale groups:');
  const locales = [...new Set(voices.map((v) => v.Locale))].sort();
  console.log(' ', locales.join('  '));
  console.log();
}

// ── Generate a single MP3 file ────────────────────────────────────────────────
async function generateOne(cue, defaults) {
  const voice  = VOICE_OVERRIDE || cue.voice || defaults.voice || 'en-US-AriaNeural';
  const rate   = cue.rate  ?? defaults.rate  ?? 0.95;
  const pitch  = cue.pitch ?? defaults.pitch ?? '+0Hz';

  const outPath = path.join(OUT_DIR, cue.out);

  // Skip if already exists and --force is not set
  if (fs.existsSync(outPath) && !flag('--force')) {
    console.log(`  ⏭  Skipping (exists): ${cue.out}  — use --force to re-generate`);
    return 'skipped';
  }

  process.stdout.write(`  ⏳  ${cue.out}  [${voice}]  rate=${rate} ...`);

  // Create a fresh TTS instance per cue — each needs its own WS connection.
  const tts = new MsEdgeTTS({});
  try {
    // setMetadata opens the WebSocket and configures the voice + format
    await tts.setMetadata(
      voice,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );

    await tts.toFile(outPath, cue.text, {
      rate,
      pitch,
      volume: 100,
    });

    const size = fs.statSync(outPath).size;
    console.log(` ✅  ${(size / 1024).toFixed(1)} KB`);
    return 'ok';
  } catch (err) {
    const msg = err && typeof err === 'object' ? (err.message || JSON.stringify(err)) : String(err);
    console.log(` ❌  ${msg}`);
    // Remove partial/zero-byte file if write failed
    try {
      if (fs.existsSync(outPath) && fs.statSync(outPath).size === 0) fs.unlinkSync(outPath);
    } catch (_) {}
    return 'error';
  } finally {
    try { tts.close(); } catch (_) {}
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (LIST_VOICES) {
    await listVoices();
    return;
  }

  // Load script definition
  if (!fs.existsSync(SCRIPT_PATH)) {
    console.error(`\n❌ Audio script not found: ${SCRIPT_PATH}`);
    console.error('   Create one or pass --script <path>\n');
    process.exit(1);
  }

  const script   = JSON.parse(fs.readFileSync(SCRIPT_PATH, 'utf-8'));
  const defaults = {
    voice: script.defaultVoice || 'en-US-AriaNeural',
    rate:  script.defaultRate  ?? 0.95,
    pitch: script.defaultPitch || '+0Hz',
  };

  let cues = script.cues || [];
  if (!Array.isArray(cues) || cues.length === 0) {
    console.error('\n❌ No cues found in script file.\n');
    process.exit(1);
  }

  // Filter to single file if --only is specified
  if (ONLY_FILE) {
    cues = cues.filter((c) => c.out === ONLY_FILE);
    if (cues.length === 0) {
      console.error(`\n❌ --only "${ONLY_FILE}" not found in script.\n`);
      process.exit(1);
    }
  }

  console.log(`\n🎙  Edge TTS Audio Generator`);
  console.log(`    Script : ${SCRIPT_PATH}`);
  console.log(`    Voice  : ${VOICE_OVERRIDE || defaults.voice}`);
  console.log(`    Rate   : ${defaults.rate}`);
  console.log(`    Output : ${OUT_DIR}`);
  console.log(`    Cues   : ${cues.length}`);
  console.log(`    Force  : ${flag('--force') ? 'yes (re-generating all)' : 'no (skip existing)'}`);
  console.log();

  let ok = 0, skipped = 0, failed = 0;

  for (const cue of cues) {
    if (!cue.out || !cue.text) {
      console.warn(`  ⚠  Skipping invalid cue: ${JSON.stringify(cue)}`);
      skipped++;
      continue;
    }

    const result = await generateOne(cue, defaults);
    if (result === 'ok')           ok++;
    else if (result === 'skipped') skipped++;
    else                           failed++;
  }

  console.log();
  console.log(`✅ Done — ${ok} generated, ${skipped} skipped, ${failed} failed`);
  console.log(`   Files saved to: ${OUT_DIR}`);
  console.log();
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
