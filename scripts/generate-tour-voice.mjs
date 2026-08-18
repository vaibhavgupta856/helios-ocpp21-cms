/**
 * Neural TTS for Helios tour clips (Microsoft Edge neural voices via edge-tts).
 * Not the browser SpeechSynthesis API.
 *
 *   py -3 -m pip install edge-tts
 *   npm run tour:voice
 *
 * Pass plain text only. edge-tts reads SSML tags aloud.
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
const PITCH = process.env.TOUR_VOICE_PITCH || '-1Hz';

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

function spokenText(text) {
  return String(text)
    .replace(/\u2014/g, ', ')
    .replace(/\u2013/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function speakText(text, dest) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tour-voice-'));
  const textPath = path.join(dir, 'clip.txt');
  await writeFile(textPath, spokenText(text), 'utf8');
  try {
    await withPython([
      '-m',
      'edge_tts',
      '--voice',
      VOICE,
      `--rate=${RATE}`,
      `--pitch=${PITCH}`,
      '--file',
      textPath,
      '--write-media',
      dest,
    ]);
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

  const args = process.argv.slice(2).filter((a) => a && !a.startsWith('--'));
  const force = process.argv.includes('--force');
  const { access } = await import('node:fs/promises');
  const exists = async (p) => {
    try {
      await access(p);
      return true;
    } catch {
      return false;
    }
  };

  for (const step of TUTORIAL_STEPS) {
    if (!step.voice || !step.id) continue;
    if (args.length && !args.includes(step.id)) continue;
    const dest = path.join(OUT, `${step.id}.mp3`);
    if (!force && !args.length && (await exists(dest))) {
      process.stdout.write(`skip ${step.id} (exists)\n`);
      continue;
    }
    process.stdout.write(`voice ${step.id} → ${path.relative(ROOT, dest)}\n`);
    await speakText(step.voice, dest);
  }
}

main().catch((err) => {
  process.stderr.write(`${err.message || err}\n`);
  process.exit(1);
});
