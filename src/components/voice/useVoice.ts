import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/settings';
import { useUIStore } from '@/stores/ui';
import { runVoicePipeline } from './pipeline';

/* Minimal typings for the Web Speech API (not in lib.dom for all TS configs). */
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as new () => SpeechRecognitionLike) ??
    (w.webkitSpeechRecognition as new () => SpeechRecognitionLike) ?? null;
}

export interface VoiceState {
  supported: boolean;
  listening: boolean;
  /** 0..1 levels for the live waveform bars. */
  levels: number[];
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

const BAR_COUNT = 24;

export function useVoice(): VoiceState {
  const [listening, setListening] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(0.05));
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);
  const finalRef = useRef('');
  const listeningRef = useRef(false);
  const supported = getRecognitionCtor() !== null;

  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      cancelAnimationFrame(a.raf);
      a.stream.getTracks().forEach((t) => t.stop());
      void a.ctx.close().catch(() => undefined);
      audioRef.current = null;
    }
    setLevels(new Array(BAR_COUNT).fill(0.05));
  }, []);

  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const step = Math.floor(data.length / BAR_COUNT);
        const next: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          next.push(Math.max(0.05, (data[i * step] ?? 0) / 255));
        }
        setLevels(next);
        if (audioRef.current) audioRef.current.raf = requestAnimationFrame(tick);
      };
      audioRef.current = { ctx, stream, raf: requestAnimationFrame(tick) };
    } catch {
      setError('Microphone access denied. Grant permission to use voice commands.');
    }
  }, []);

  const stop = useCallback(() => {
    listeningRef.current = false;
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!window.isSecureContext) {
      setError('Voice needs a secure connection. On a phone, open the HTTPS address (Start-JARVIS-Phone) instead of the plain http:// one.');
      return;
    }
    if (!supported) {
      setError('Speech recognition is not supported in this browser. Chrome or Edge recommended.');
      return;
    }
    if (listeningRef.current) return;
    setError(null);
    finalRef.current = '';

    const Ctor = getRecognitionCtor()!;
    const rec = new Ctor();
    const { voiceLang, alwaysListening } = useSettingsStore.getState();
    rec.lang = voiceLang || 'en-IN';
    // iOS Safari's recognizer misbehaves with continuous mode (duplicate finals,
    // ghost restarts) — single-utterance mode there, continuous elsewhere.
    rec.continuous = !/iPhone|iPad|iPod/.test(navigator.userAgent);
    rec.interimResults = true;

    rec.onresult = (e) => {
      // Rebuild from the FULL results list every event. iOS Safari re-delivers final
      // results with resultIndex 0 — appending incrementally duplicates the transcript.
      let final = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      finalRef.current = final.trim();
      useUIStore.getState().setDeck({
        deckStatus: 'listening',
        transcript: finalRef.current,
        interim: interim.trim(),
      });
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone permission denied. Enable it in browser settings.');
        listeningRef.current = false;
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(`Voice error: ${e.error}`);
      }
    };

    rec.onend = () => {
      const text = finalRef.current.trim();
      const stillWanted = listeningRef.current;
      if (text) {
        listeningRef.current = false;
        setListening(false);
        stopAudio();
        void runVoicePipeline(text);
      } else if (stillWanted && alwaysListening) {
        // Always-listening mode: quietly restart on silence timeouts.
        try {
          rec.start();
          return;
        } catch {
          /* recognizer occasionally refuses immediate restarts; give up gracefully */
        }
        listeningRef.current = false;
        setListening(false);
        stopAudio();
      } else {
        listeningRef.current = false;
        setListening(false);
        stopAudio();
        if (useUIStore.getState().deckStatus === 'listening') useUIStore.getState().resetDeck();
      }
    };

    recRef.current = rec;
    listeningRef.current = true;
    setListening(true);
    useUIStore.getState().setDeck({ deckStatus: 'listening', transcript: '', interim: '' });
    try {
      rec.start();
    } catch {
      setError('Could not start the recognizer. Try again.');
      listeningRef.current = false;
      setListening(false);
      return;
    }
    void startAudio();
  }, [supported, startAudio, stopAudio]);

  const toggle = useCallback(() => {
    if (listeningRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => () => {
    recRef.current?.abort();
    stopAudio();
  }, [stopAudio]);

  return { supported, listening, levels, error, start, stop, toggle };
}
