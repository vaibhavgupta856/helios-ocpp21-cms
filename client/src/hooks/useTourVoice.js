import { useCallback, useEffect, useRef } from 'react';
import { tourVoiceUrl } from '../tutorial.js';

const END_SLOP = 0.35;
const ADVANCE_MS = 1000;
const FALLBACK_MS = 12000;

function srcIsStep(audio, stepId) {
  const src = audio.currentSrc || audio.src || '';
  try {
    return decodeURIComponent(src).includes(`/tour/voice/${stepId}.mp3`);
  } catch {
    return src.includes(`${stepId}.mp3`);
  }
}

function nearEnd(audio) {
  const duration = audio.duration;
  if (audio.ended) return true;
  if (!Number.isFinite(duration) || duration <= 0) return false;
  return audio.currentTime >= Math.max(0, duration - END_SLOP);
}

/** Neural MP3 clips for the Helios tour. Not the browser SpeechSynthesis API. */
export function useTourVoice({ enabled, stepId, ready, muted, onAutoNext }) {
  const audioRef = useRef(null);
  const loadGenRef = useRef(0);
  const ignoreEndedRef = useRef(true);
  const advanceTimerRef = useRef(0);
  const safetyTimerRef = useRef(0);
  const scheduledRef = useRef(false);
  const mutedRef = useRef(muted);
  const onAutoNextRef = useRef(onAutoNext);
  mutedRef.current = muted;
  onAutoNextRef.current = onAutoNext;

  const clearAdvance = useCallback(() => {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = 0;
    }
    if (safetyTimerRef.current) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = 0;
    }
    scheduledRef.current = false;
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
    scheduledRef.current = false;
    clearAdvance();
    audio.muted = mutedRef.current;
    audio.pause();
    audio.src = tourVoiceUrl(playingStep);
    audio.load();

    const scheduleAdvance = () => {
      if (gen !== loadGenRef.current) return;
      if (scheduledRef.current) return;
      if (mutedRef.current) return;
      scheduledRef.current = true;
      ignoreEndedRef.current = true;
      if (safetyTimerRef.current) {
        window.clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = 0;
      }
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = 0;
        if (mutedRef.current) return;
        if (loadGenRef.current !== gen) return;
        onAutoNextRef.current?.();
      }, ADVANCE_MS);
    };

    const armSafety = () => {
      if (safetyTimerRef.current) window.clearTimeout(safetyTimerRef.current);
      const duration = audio.duration;
      const waitMs =
        Number.isFinite(duration) && duration > 0 ? Math.min(30000, (duration + 2.5) * 1000) : FALLBACK_MS;
      safetyTimerRef.current = window.setTimeout(() => {
        safetyTimerRef.current = 0;
        scheduleAdvance();
      }, waitMs);
    };

    const tryPlay = () => {
      if (gen !== loadGenRef.current) return;
      if (!srcIsStep(audio, playingStep)) return;
      armSafety();
      const playAttempt = audio.play();
      if (playAttempt?.then) {
        playAttempt
          .then(() => {
            if (gen === loadGenRef.current) ignoreEndedRef.current = false;
          })
          .catch(() => {
            if (gen === loadGenRef.current) scheduleAdvance();
          });
      }
    };

    const onPlaying = () => {
      if (gen !== loadGenRef.current) return;
      ignoreEndedRef.current = false;
      armSafety();
    };

    const onEnded = () => {
      if (gen !== loadGenRef.current) return;
      if (ignoreEndedRef.current) return;
      if (!srcIsStep(audio, playingStep)) return;
      scheduleAdvance();
    };

    const onTimeUpdate = () => {
      if (gen !== loadGenRef.current) return;
      if (ignoreEndedRef.current) return;
      if (!srcIsStep(audio, playingStep)) return;
      if (nearEnd(audio)) scheduleAdvance();
    };

    const onError = () => {
      if (gen !== loadGenRef.current) return;
      scheduleAdvance();
    };

    audio.addEventListener('canplaythrough', tryPlay, { once: true });
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('error', onError);
    if (audio.readyState >= 3) tryPlay();
    else armSafety();

    return () => {
      audio.removeEventListener('canplaythrough', tryPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('error', onError);
      if (loadGenRef.current === gen) loadGenRef.current += 1;
      ignoreEndedRef.current = true;
      clearAdvance();
      audio.pause();
    };
  }, [enabled, ready, stepId, clearAdvance]);

  return { audioRef, unlock, stop };
}
