import { useCallback, useEffect, useRef } from 'react';
import { tourVoiceUrl } from '../tutorial.js';

const MIN_DURATION = 0.8;
const END_SLOP = 0.35;
const ADVANCE_MS = 1000;

function isGenuineEnd(audio) {
  const duration = audio.duration;
  if (!Number.isFinite(duration) || duration <= MIN_DURATION) return false;
  return audio.currentTime >= duration - END_SLOP;
}

function srcIsStep(audio, stepId) {
  const src = audio.currentSrc || audio.src || '';
  try {
    return decodeURIComponent(src).includes(`/tour/voice/${stepId}.mp3`);
  } catch {
    return src.includes(`${stepId}.mp3`);
  }
}

/** Neural MP3 clips for the Helios tour. Not the browser SpeechSynthesis API. */
export function useTourVoice({ enabled, stepId, ready, muted, onAutoNext }) {
  const audioRef = useRef(null);
  const loadGenRef = useRef(0);
  const ignoreEndedRef = useRef(true);
  const advanceTimerRef = useRef(0);
  const mutedRef = useRef(muted);
  const onAutoNextRef = useRef(onAutoNext);
  mutedRef.current = muted;
  onAutoNextRef.current = onAutoNext;

  const clearAdvance = useCallback(() => {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = 0;
    }
  }, []);

  const stop = useCallback(
    (opts = {}) => {
      const audio = audioRef.current;
      loadGenRef.current += 1;
      ignoreEndedRef.current = true;
      clearAdvance();
      if (!audio) return;
      audio.pause();
      if (opts.clearSrc) {
        audio.removeAttribute('src');
        audio.load();
      }
    },
    [clearAdvance]
  );

  const unlock = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    ignoreEndedRef.current = true;
    audio.muted = true;
    audio.src = tourVoiceUrl('welcome');
    try {
      await audio.play();
    } catch {
      /* autoplay unlock is best-effort */
    }
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
    audio.removeAttribute('src');
    audio.load();
    audio.muted = mutedRef.current;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = muted;
    if (muted) clearAdvance();
  }, [muted, clearAdvance]);

  useEffect(() => {
    if (!enabled) stop({ clearSrc: true });
  }, [enabled, stop]);

  useEffect(() => {
    if (!enabled || !ready || !stepId) return undefined;

    const audio = audioRef.current;
    if (!audio) return undefined;

    const gen = ++loadGenRef.current;
    const playingStep = stepId;
    ignoreEndedRef.current = true;
    clearAdvance();
    audio.muted = mutedRef.current;
    audio.pause();
    audio.src = tourVoiceUrl(playingStep);
    audio.load();

    const tryPlay = () => {
      if (gen !== loadGenRef.current) return;
      if (!srcIsStep(audio, playingStep)) return;
      const playAttempt = audio.play();
      if (playAttempt?.then) {
        playAttempt
          .then(() => {
            if (gen === loadGenRef.current) ignoreEndedRef.current = false;
          })
          .catch(() => {
            if (gen === loadGenRef.current) ignoreEndedRef.current = false;
          });
      }
    };

    const onPlaying = () => {
      if (gen !== loadGenRef.current) return;
      ignoreEndedRef.current = false;
    };

    const onEnded = () => {
      if (gen !== loadGenRef.current) return;
      if (ignoreEndedRef.current) return;
      if (!srcIsStep(audio, playingStep)) return;
      if (!isGenuineEnd(audio)) return;
      if (mutedRef.current) return;
      clearAdvance();
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = 0;
        if (mutedRef.current) return;
        if (loadGenRef.current !== gen) return;
        onAutoNextRef.current?.();
      }, ADVANCE_MS);
    };

    audio.addEventListener('canplaythrough', tryPlay, { once: true });
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('ended', onEnded);
    if (audio.readyState >= 3) tryPlay();

    return () => {
      audio.removeEventListener('canplaythrough', tryPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('ended', onEnded);
      if (loadGenRef.current === gen) loadGenRef.current += 1;
      ignoreEndedRef.current = true;
      clearAdvance();
      audio.pause();
    };
  }, [enabled, ready, stepId, clearAdvance]);

  return { audioRef, unlock, stop };
}
