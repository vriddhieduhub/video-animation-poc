#!/usr/bin/env node
/**
 * Quick helper: list all available Edge TTS voices.
 * Usage: node server/list-voices.js [locale-prefix]
 * Example: node server/list-voices.js en-US
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MsEdgeTTS } = require('edge-tts-node');

const filter = process.argv[2] || '';
const tts    = new MsEdgeTTS({});
const voices = await tts.getVoices();

const list = filter
  ? voices.filter((v) => v.Locale.toLowerCase().startsWith(filter.toLowerCase()))
  : voices;

console.log(`\n${'Voice Name'.padEnd(40)} ${'Gender'.padEnd(10)} Locale`);
console.log('─'.repeat(70));
list.forEach((v) => {
  console.log(`${v.ShortName.padEnd(40)} ${v.Gender.padEnd(10)} ${v.Locale}`);
});
console.log(`\nTotal: ${list.length} voice(s)${filter ? ` matching "${filter}"` : ''}\n`);

tts.close();
