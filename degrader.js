const fs = require('fs');
const wav = require('wav');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

// Input/output
const INPUT_FILE = 'input.flac';
const OUTPUT_FILE = 'output.wav';

// 🎚️ Dynamic gentle params
const SAMPLE_RATE = randChoice([30000, 32000, 36000, 41000, 44100]); // subtle variance
const SMEAR_BASE_CHANCE = 0.005; // base smear chance
const SMEAR_MODULATION_FREQ = 0.0001; // very slow LFO
const SMEAR_LENGTH_RANGE = [3, 10];
const SMEAR_REVERSE_CHANCE = 0.1;
const HISS_LEVEL = 0.0001; // barely audible

console.log(`🌬 Evolving Wonkify:
- Sample Rate: ${SAMPLE_RATE}
- Smear: LFO modulated ~${Math.round(SMEAR_BASE_CHANCE * 100)}%
`);

const rawStream = new PassThrough();
const pcmChunks = [];

ffmpeg(INPUT_FILE)
  .format('s16le')
  .audioChannels(1)
  .audioFrequency(SAMPLE_RATE)
  .on('error', err => console.error('ffmpeg error:', err))
  .pipe(rawStream);

rawStream.on('data', chunk => pcmChunks.push(chunk));

rawStream.on('end', () => {
  const input = Buffer.concat(pcmChunks);
  const processed = [];

  for (let i = 0; i < input.length; i += 2) {
    let sample = input.readInt16LE(i);
    processed.push(sample);
  }

  const final = [];

  for (let i = 0; i < processed.length; i++) {
    // Subtle hiss layer
    const hiss = Math.random() * HISS_LEVEL * 65536 - (HISS_LEVEL * 65536) / 2;
    let sample = processed[i] + hiss;

    final.push(sample);

    // Modulated smear probability using a sine-ish LFO shape
    const smearProb = SMEAR_BASE_CHANCE * (1 + Math.sin(i * SMEAR_MODULATION_FREQ)) / 2;

    if (Math.random() < smearProb) {
      const smearLen = randInt(SMEAR_LENGTH_RANGE[0], SMEAR_LENGTH_RANGE[1]);
      const smear = processed.slice(Math.max(0, i - smearLen), i + smearLen);
      final.push(...(Math.random() < SMEAR_REVERSE_CHANCE ? [...smear].reverse() : smear));
    }
  }

  const buffer = Buffer.alloc(final.length * 2);
  final.forEach((s, i) => buffer.writeInt16LE(clamp(s, -32768, 32767), i * 2));

  const out = fs.createWriteStream(OUTPUT_FILE);
  const writer = new wav.Writer({
    sampleRate: SAMPLE_RATE,
    bitDepth: 16,
    channels: 1,
  });

  writer.pipe(out);
  writer.end(buffer);

  console.log(`✅ Wrote evolving: ${OUTPUT_FILE}`);
});

// === Helpers ===
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}
