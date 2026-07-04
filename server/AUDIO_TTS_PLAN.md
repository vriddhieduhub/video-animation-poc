# 🎙️ Audio TTS Generation Plan
## Declarative Whiteboard Animation Suite

---

## 🎯 Goal

Given a script (plain text per scene element), automatically generate
`scene_XX_seq_YY.mp3` files that match the audio cue paths referenced in the
HTML config, so the entire audio pipeline is fully automated.

---

## 📦 Recommended Node.js Library

### **Option 1 — `@google-cloud/text-to-speech`** *(Best quality, requires GCP account)*

```bash
npm install @google-cloud/text-to-speech
```

**Pros:**
- WaveNet & Neural2 voices — most natural-sounding
- Supports SSML (pauses, emphasis, pitch)
- 1 million characters/month free tier

**Cons:** Requires a GCP service account JSON key

---

### **Option 2 — `elevenlabs`** *(Best voice cloning, streaming API)*

```bash
npm install elevenlabs
```

**Pros:**
- Extremely realistic voices
- Clone a custom voice in minutes
- Streaming audio for long texts

**Cons:** Paid after 10,000 chars/month

---

### **Option 3 — `@aws-sdk/client-polly`** *(AWS Polly — robust, enterprise)*

```bash
npm install @aws-sdk/client-polly
```

**Pros:**
- Neural voices in 30+ languages
- Reliable at scale
- SSML support

**Cons:** Requires AWS credentials

---

### **Option 4 — `openai` (TTS)** *(Easiest to integrate, uses existing OpenAI key)*

```bash
npm install openai
```

**Pros:**
- `tts-1` and `tts-1-hd` models
- 6 voices (alloy, echo, fable, onyx, nova, shimmer)
- Single API call → MP3 blob
- Works with an existing ChatGPT API key

**Cons:** $15/1M chars for tts-1-hd

**→ Recommended for this project due to simplest integration**

---

## 🛠️ Implementation Plan

### File: `server/tts-generator.js`

```js
// server/tts-generator.js
// Usage: node server/tts-generator.js --config client/src/config/scene.html
//        Reads the config HTML, extracts all text + audio paths,
//        calls OpenAI TTS for each unique text blob, saves MP3s to /public/audio/

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { DOMParser } from '@xmldom/xmldom';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateAudio(text, outputPath, voice = 'nova') {
  const response = await openai.audio.speech.create({
    model:  'tts-1-hd',
    voice,
    input:  text,
    response_format: 'mp3',
    speed:  0.95,
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Written: ${outputPath}`);
}

async function processConfig(configPath) {
  const html   = fs.readFileSync(configPath, 'utf-8');
  const parser = new DOMParser();
  const doc    = parser.parseFromString(`<root>${html}</root>`, 'text/html');

  const tasks = [];
  doc.querySelectorAll('[data-timelinesequenceid]').forEach((el) => {
    const text = el.textContent?.trim();
    if (!text) return;

    // Find the next sibling audio element for this seqId
    const seqId   = el.getAttribute('data-timelinesequenceid');
    const sceneEl = el.closest('[data-sceneid]');
    const sceneId = sceneEl?.getAttribute('data-sceneid') || '01';

    const audioEl = sceneEl?.querySelector(
      `audio[data-audiotimelineseqid="${seqId}"]`
    );
    if (!audioEl) return; // no audio cue for this element

    const audioSrc  = audioEl.getAttribute('src'); // e.g. /audio/scene_01_seq_01.mp3
    const outputPath = path.join('client', 'public', audioSrc.replace(/^\//, ''));

    tasks.push({ text, outputPath });
  });

  console.log(`Found ${tasks.length} audio cues to generate.`);
  for (const { text, outputPath } of tasks) {
    await generateAudio(text, outputPath);
  }
}

const configArg = process.argv.find((a) => a.startsWith('--config='))
  ?.split('=')[1] || 'client/src/config/scene.html';

processConfig(configArg).catch(console.error);
```

### package.json script to add

```json
{
  "scripts": {
    "generate-audio": "node server/tts-generator.js --config=client/src/config/scene.html"
  }
}
```

### Required additional packages

```bash
npm install openai @xmldom/xmldom
# or for Google Cloud:
npm install @google-cloud/text-to-speech
```

---

## 📁 Output Directory Convention

All generated MP3 files go to:

```
client/public/audio/
├── scene_01_seq_01.mp3
├── scene_01_seq_03.mp3
├── scene_01_seq_04.mp3
├── scene_02_seq_01.mp3
...
```

These are then served by Vite's dev server at `/audio/scene_XX_seq_YY.mp3`.

---

## ⏱️ Audio Duration → Slot Duration Synchronization

The `AudioManager.preload()` method already handles this:

1. For each audio file, it creates an `Audio` element and waits for `loadedmetadata`.
2. It returns a `{ src → duration }` map.
3. `applyAudioDurations()` in `configParser.js` extends each element's `slotDuration`
   to `max(BASE_SEQ_DURATION, audioDuration + 0.3s)`.
4. This means: **if TTS audio is 5.2s, the slot becomes 5.5s automatically.**
   The next animation element will not begin until the audio finishes.

---

## 🎵 SSML Tips for Whiteboard Style

For Google TTS / AWS Polly, wrap text in SSML for better pacing:

```xml
<speak>
  <prosody rate="slow" pitch="+2st">
    Welcome to the MCP Tutorial.
    <break time="500ms"/>
    Model Context Protocol is an open standard.
  </prosody>
</speak>
```

---

## ✅ End-to-End Workflow Summary

```
1. Write scene HTML config  →  client/src/config/scene.html
2. Run: npm run generate-audio
         ↓
   OpenAI TTS generates MP3s → client/public/audio/
3. Open browser: npm run dev
4. Hit ▶ Play Preview — audio plays in sync automatically
5. Hit 📁 Select Folder & Export
         ↓
   frame_00001.jpg … frame_NNNNN.jpg → your chosen folder
   audio_manifest.json               → your chosen folder
6. Copy MP3 files to export folder
7. Run FFmpeg command shown at bottom of UI
         ↓
   output.mp4 — high-quality 60fps MP4 with synchronized audio
```
