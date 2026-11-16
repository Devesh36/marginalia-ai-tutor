import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LessonPlayer, type Voice } from '../lib/player';
import { boardAt, lessonSchema, timeline } from '../lib/lesson';
import { sample } from '../lib/sample';

class FakeVoice implements Voice {
  calls: {
    text: string;
    callbacks: Parameters<Voice['speak']>[1];
    rate: number;
  }[] = [];
  pauses = 0;
  resumes = 0;
  cancels = 0;
  speak(text: string, callbacks: Parameters<Voice['speak']>[1], rate: number) {
    this.calls.push({ text, callbacks, rate });
  }
  pause() {
    this.pauses++;
  }
  resume() {
    this.resumes++;
  }
  cancel() {
    this.cancels++;
  }
}
const setup = () => {
  const voice = new FakeVoice();
  return { voice, player: new LessonPlayer(timeline(sample.lesson), voice) };
};
test('sample validates and fits approximately two minutes', () => {
  assert.ok(lessonSchema.safeParse(sample.lesson).success);
  const steps = timeline(sample.lesson);
  const duration = steps.at(-1)!.start + steps.at(-1)!.duration;
  assert.ok(duration > 90 && duration < 160);
});
test('narration completion is the only event that advances to the next diagram', () => {
  const { player, voice } = setup();
  player.play();
  assert.equal(voice.calls[0].text, sample.lesson.scenes[0].beats[0].narration);
  voice.calls[0].callbacks.boundary(23);
  assert.equal(player.state.index, 0);
  assert.equal(player.state.charIndex, 23);
  voice.calls[0].callbacks.end();
  assert.equal(player.state.index, 1);
  assert.equal(voice.calls.length, 2);
});
test('pause and resume control the current utterance without replaying it', () => {
  const { player, voice } = setup();
  player.play();
  voice.calls[0].callbacks.boundary(25);
  player.pause();
  assert.equal(player.state.phase, 'paused');
  assert.equal(voice.pauses, 1);
  player.play();
  assert.equal(voice.resumes, 1);
  assert.equal(voice.calls.length, 1);
  assert.equal(player.state.charIndex, 25);
});
test('backward and forward seek reconstruct the complete board independently', () => {
  const { player } = setup();
  player.seek(10);
  player.seek(1);
  assert.deepEqual(
    boardAt(sample.lesson, player.state.index).elements.map((e) => e.id),
    ['input', 'a', 'neuron'],
  );
  player.seek(4);
  const board = boardAt(sample.lesson, player.state.index);
  assert.equal(board.sceneIndex, 1);
  assert.ok(board.elements.some((e) => e.id === 'equation'));
  assert.ok(!board.elements.some((e) => e.id === 'neuron'));
});
test('seeking while playing speaks the selected step; stale audio callbacks cannot advance it', () => {
  const { player, voice } = setup();
  player.play();
  const old = voice.calls[0].callbacks;
  player.seek(7);
  assert.equal(player.state.index, 7);
  assert.equal(player.state.phase, 'playing');
  old.end();
  old.boundary(90);
  old.error('stale');
  assert.equal(player.state.index, 7);
  assert.equal(player.state.charIndex, 0);
  assert.equal(player.state.error, null);
  assert.equal(voice.calls[1].text, timeline(sample.lesson)[7].narration);
});
test('seek while paused cancels the paused speech and stays stopped at the new step', () => {
  const { player, voice } = setup();
  player.play();
  player.pause();
  player.seek(4);
  assert.equal(player.state.phase, 'idle');
  player.play();
  assert.equal(voice.calls.length, 2);
  assert.equal(voice.resumes, 0);
});
test('restart cancels playback and returns to the first board', () => {
  const { player, voice } = setup();
  player.play();
  player.seek(8);
  const stale = voice.calls.at(-1)!.callbacks;
  player.restart();
  stale.end();
  assert.equal(player.state.index, 0);
  assert.equal(player.state.phase, 'idle');
  assert.equal(voice.calls.length, 2);
});
test('completion and replay return to the start', () => {
  const { player, voice } = setup();
  player.seek(timeline(sample.lesson).length - 1);
  player.play();
  voice.calls.at(-1)!.callbacks.end();
  assert.equal(player.state.phase, 'ended');
  player.play();
  assert.equal(player.state.index, 0);
  assert.equal(player.state.phase, 'playing');
});
test('speed changes restart only the current beat with the new rate', () => {
  const { player, voice } = setup();
  player.seek(3);
  player.play();
  player.setRate(1.5);
  assert.equal(player.state.index, 3);
  assert.equal(voice.calls.at(-1)!.rate, 1.5);
});
test('disposal rejects late events and cancels narration', () => {
  const { player, voice } = setup();
  let updates = 0;
  player.subscribe(() => updates++);
  player.play();
  const before = updates;
  player.dispose();
  voice.calls[0].callbacks.end();
  assert.equal(updates, before);
});
test('validation rejects missing references, duplicates, out-of-bounds elements, and short narration', () => {
  for (const mutate of [
    (x: typeof sample.lesson) => {
      x.scenes[0].beats[0].reveal = ['missing'];
    },
    (x: typeof sample.lesson) => {
      x.scenes[0].elements[1].id = 'input';
    },
    (x: typeof sample.lesson) => {
      x.scenes[0].elements[0].w = 840;
    },
    (x: typeof sample.lesson) => {
      for (const s of x.scenes) for (const b of s.beats) b.narration = 'Tiny sentence here.';
    },
  ]) {
    const lesson = structuredClone(sample.lesson);
    mutate(lesson);
    assert.equal(lessonSchema.safeParse(lesson).success, false);
  }
});

test('an end event queued just before pause does not restart narration', () => {
  const { player, voice } = setup();
  player.play();
  player.pause();
  voice.calls[0].callbacks.end();
  assert.equal(player.state.phase, 'paused');
  assert.equal(player.state.index, 0);
  assert.equal(voice.calls.length, 1);
  player.play();
  assert.equal(player.state.index, 1);
  assert.equal(voice.calls.length, 2);
});
