/**
 * Neural TTS for Helios tour clips (Microsoft Edge neural voices via edge-tts).
 * Not the browser SpeechSynthesis API.
 *
 *   py -3 -m pip install edge-tts
 *   npm run tour:voice
 *
 * Andrew + chat style: male, conversational. Rate stays near normal so it
 * does not sound like a GPS or a newsreader.
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUTORIAL_STEPS } from '../client/src/tutorial.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client', 'public', 'tour', 'voice');
const VOICE = process.env.TOUR_VOICE || 'en-US-AndrewNeural';
const RATE = process.env.TOUR_VOICE_RATE || '-3%';
const STYLE = process.env.TOUR_VOICE_STYLE || 'chat';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: opts.stdio || 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}

function pythonCmds() {
  if (process.platform === 'win32') {
    return [
      ['py', ['-3']],
      ['python', []],
      ['python3', []],
    ];
  }
  return [
    ['python3', []],
    ['python', []],
  ];
}

async function withPython(extraArgs, opts = {}) {
  let lastErr;
  for (const [cmd, prefix] of pythonCmds()) {
    try {
      await run(cmd, [...prefix, ...extraArgs], extraArgs.includes('-h') ? { stdio: 'ignore' } : opts);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('python not found');
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function spokenText(text) {
  return String(text)
    .replace(/\u2014/g, ', ')
    .replace(/\u2013/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSsml(text, { style } = { style: STYLE }) {
  const body = escapeXml(spokenText(text));
  const inner = style
    ? `<mstts:express-as style="${style}"><prosody rate="${RATE}">${body}</prosody></mstts:express-as>`
    : `<prosody rate="${RATE}">${body}</prosody>`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="${VOICE}">${inner}</voice></speak>`;
}

async function speakSsml(ssml, dest) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tour-voice-'));
  const ssmlPath = path.join(dir, 'clip.ssml');
  const pyPath = path.join(dir, 'speak.py');
  await writeFile(ssmlPath, ssml, 'utf8');
  await writeFile(
    pyPath,
    [
      'import asyncio, sys',
      'from pathlib import Path',
      'import edge_tts',
      'ssml = Path(sys.argv[1]).read_text(encoding="utf-8")',
      'voice = sys.argv[2]',
      'dest = sys.argv[3]',
      'asyncio.run(edge_tts.Communicate(ssml, voice).save(dest))',
      '',
    ].join('\n'),
    'utf8',
  );
  try {
    await withPython([pyPath, ssmlPath, VOICE, dest], { stdio: 'ignore' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  try {
    await withPython(['-m', 'edge_tts', '-h']);
  } catch {
    process.stderr.write('Installing edge-tts…\n');
    await withPython(['-m', 'pip', 'install', '--user', 'edge-tts']);
  }

  for (const step of TUTORIAL_STEPS) {
    if (!step.voice || !step.id) continue;
    const dest = path.join(OUT, `${step.id}.mp3`);
    process.stdout.write(`voice ${step.id} → ${path.relative(ROOT, dest)}\n`);
    try {
      await speakSsml(toSsml(step.voice, { style: STYLE }), dest);
    } catch (err) {
      process.stderr.write(`  chat style failed (${err.message || err}); retrying without style\n`);
      await speakSsml(toSsml(step.voice, { style: '' }), dest);
    }
  }
}

main().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
