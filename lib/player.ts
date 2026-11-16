import type { TimelineStep } from './lesson';

export type PlayerState = {
  phase: 'idle' | 'playing' | 'paused' | 'ended' | 'error';
  index: number;
  charIndex: number;
  error: string | null;
};
export interface Voice {
  speak(
    text: string,
    callbacks: {
      boundary: (char: number) => void;
      end: () => void;
      error: (message: string) => void;
    },
    rate: number,
  ): void;
  pause(): void;
  resume(): void;
  cancel(): void;
}

/** Narration is the clock. Only the utterance's end event advances the board. */
export class LessonPlayer {
  state: PlayerState = { phase: 'idle', index: 0, charIndex: 0, error: null };
  private generation = 0;
  private endedWhilePaused = false;
  private listeners = new Set<(state: PlayerState) => void>();
  rate = 1;
  constructor(
    readonly steps: TimelineStep[],
    private voice: Voice,
  ) {}
  subscribe(listener: (state: PlayerState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private update(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }
  private speak() {
    this.endedWhilePaused = false;
    const token = ++this.generation;
    this.voice.cancel();
    this.update({ phase: 'playing', charIndex: 0, error: null });
    this.voice.speak(
      this.steps[this.state.index].narration,
      {
        boundary: (charIndex) => {
          if (token === this.generation) this.update({ charIndex });
        },
        end: () => {
          if (token !== this.generation) return;
          if (this.state.phase === 'paused') {
            this.endedWhilePaused = true;
            return;
          }
          this.advance();
        },
        error: (error) => {
          if (token === this.generation) this.update({ phase: 'error', error });
        },
      },
      this.rate,
    );
  }
  private advance() {
    if (this.state.index === this.steps.length - 1)
      this.update({ phase: 'ended', charIndex: this.steps[this.state.index].narration.length });
    else {
      this.update({ index: this.state.index + 1 });
      this.speak();
    }
  }
  play() {
    if (this.state.phase === 'playing') return;
    if (this.state.phase === 'paused') {
      if (this.endedWhilePaused) {
        this.endedWhilePaused = false;
        this.advance();
        return;
      }
      this.update({ phase: 'playing' });
      this.voice.resume();
      return;
    }
    if (this.state.phase === 'ended') this.update({ index: 0 });
    this.speak();
  }
  pause() {
    if (this.state.phase === 'playing') {
      this.update({ phase: 'paused' });
      this.voice.pause();
    }
  }
  seek(index: number) {
    const playing = this.state.phase === 'playing';
    ++this.generation;
    this.voice.cancel();
    this.update({
      index: Math.max(0, Math.min(this.steps.length - 1, Math.round(index))),
      charIndex: 0,
      phase: 'idle',
      error: null,
    });
    if (playing) this.speak();
  }
  restart() {
    ++this.generation;
    this.voice.cancel();
    this.update({ index: 0, charIndex: 0, phase: 'idle', error: null });
  }
  setRate(rate: number) {
    this.rate = rate;
    this.seek(this.state.index);
  }
  dispose() {
    ++this.generation;
    this.voice.cancel();
    this.listeners.clear();
  }
}

export function browserVoice(): Voice {
  let utterance: SpeechSynthesisUtterance | null = null;
  return {
    speak(text, callbacks, rate) {
      if (!('speechSynthesis' in window)) {
        callbacks.error(
          'Voice is unavailable in this browser. Use captions mode, or open Chrome, Edge, or Safari.',
        );
        return;
      }
      const synth = window.speechSynthesis;
      synth.resume();
      utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = rate;
      const voices = synth.getVoices().filter((v) => v.lang.startsWith('en'));
      utterance.voice =
        voices.find((v) => v.localService && /Samantha|Daniel|Karen|Natural/.test(v.name)) ??
        voices.find((v) => v.localService) ??
        voices[0] ??
        null;
      utterance.onboundary = (e) => callbacks.boundary(e.charIndex);
      utterance.onend = callbacks.end;
      utterance.onerror = (e) =>
        callbacks.error(
          `Voice playback stopped (${e.error}). Press play to retry, or use captions mode.`,
        );
      synth.speak(utterance);
    },
    pause: () => window.speechSynthesis?.pause(),
    resume: () => window.speechSynthesis?.resume(),
    cancel: () => {
      if (utterance) {
        utterance.onend = null;
        utterance.onerror = null;
        utterance.onboundary = null;
      }
      window.speechSynthesis?.cancel();
      utterance = null;
    },
  };
}

/** Explicit silent mode uses a reading clock; it is never presented as audio playback. */
export function captionVoice(): Voice {
  let timer: ReturnType<typeof setInterval> | undefined;
  let tick = () => {};
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
  };
  return {
    speak(text, callbacks, rate) {
      stop();
      let elapsed = 0;
      const duration = Math.max(2, text.trim().split(/\s+/).length / 2.3 / rate) * 1000;
      tick = () => {
        elapsed += 100;
        callbacks.boundary(Math.min(text.length, Math.floor((elapsed / duration) * text.length)));
        if (elapsed >= duration) {
          stop();
          callbacks.end();
        }
      };
      timer = setInterval(tick, 100);
    },
    pause: stop,
    resume: () => {
      stop();
      timer = setInterval(tick, 100);
    },
    cancel: stop,
  };
}
