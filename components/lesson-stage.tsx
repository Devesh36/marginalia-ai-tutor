'use client';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowDown,
  BookOpen,
  Check,
  CircleHelp,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Whiteboard } from './whiteboard';
import { boardAt, timeline, type LessonEnvelope } from '@/lib/lesson';
import { browserVoice, captionVoice, LessonPlayer, type PlayerState } from '@/lib/player';
const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function LessonStage({
  envelope,
  notes,
  pauseRef,
}: {
  envelope: LessonEnvelope;
  notes: boolean;
  pauseRef: React.RefObject<() => void>;
}) {
  const { lesson } = envelope;
  const steps = timeline(lesson);
  const [state, setState] = useState<PlayerState>({
    phase: 'idle',
    index: 0,
    charIndex: 0,
    error: null,
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const playerRef = useRef<LessonPlayer | null>(null);
  const [silent, setSilent] = useState(false);
  const [rate, setRate] = useState(1);
  const [answer, setAnswer] = useState<number | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  useEffect(() => {
    const player = new LessonPlayer(timeline(lesson), silent ? captionVoice() : browserVoice());
    player.rate = rate;
    playerRef.current = player;
    player.seek(stateRef.current.index);
    setState(player.state);
    const unsub = player.subscribe(setState);
    pauseRef.current = () => player.pause();
    const visibility = () => {
      if (document.hidden) player.pause();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      unsub();
      player.dispose();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [lesson, silent, pauseRef]);
  const board = boardAt(lesson, state.index);
  const current = steps[state.index];
  const duration = steps.at(-1)!.start + steps.at(-1)!.duration;
  const elapsed = current.start + current.duration * (state.charIndex / current.narration.length);
  const playing = state.phase === 'playing';
  const toggle = () => {
    if (playing) playerRef.current?.pause();
    else playerRef.current?.play();
  };
  return (
    <>
      <div className="chapter-tabs" aria-label="Lesson chapters">
        {lesson.scenes.map((scene, index) => {
          const step = steps.findIndex((s) => s.sceneIndex === index);
          return (
            <button
              key={index}
              className={board.sceneIndex === index ? 'active' : ''}
              aria-current={board.sceneIndex === index ? 'step' : undefined}
              onClick={() => playerRef.current?.seek(step)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {scene.title}
            </button>
          );
        })}
      </div>
      <section className="board-card" aria-label="Interactive lesson">
        <div className="board-topline">
          <span className="chapter-label">
            CHAPTER {String(board.sceneIndex + 1).padStart(2, '0')}{' '}
            <span>/ {String(lesson.scenes.length).padStart(2, '0')}</span>
          </span>
          <span className="lesson-source">
            {envelope.provider === 'sample'
              ? 'Authored sample'
              : envelope.provider === 'codex'
                ? 'Generated with local Codex'
                : 'Generated with Gemini'}
          </span>
        </div>
        <h3 className="scene-title">{board.scene.title}</h3>
        <Whiteboard
          key={board.sceneIndex}
          elements={board.elements}
          focus={board.focus}
          label={`${board.scene.title}. ${board.elements
            .filter((e) => e.label)
            .map((e) => e.label.replaceAll('\n', ' '))
            .join('. ')}`}
          onAnnotate={() => playerRef.current?.pause()}
        />
        <div className="caption-box">
          <span className={`narrator-symbol ${playing ? 'speaking' : ''}`}>
            <Volume2 size={17} />
          </span>
          <p>{current.narration}</p>
          <span className="caption-step">
            {state.index + 1}/{steps.length}
          </span>
        </div>
        <div className="player">
          <div className="timeline-row">
            <span>{formatTime(elapsed / rate)}</span>
            <input
              aria-label="Seek lesson step"
              type="range"
              min="0"
              max={steps.length - 1}
              step="1"
              value={state.index}
              aria-valuetext={`Step ${state.index + 1} of ${steps.length}: ${board.scene.title}`}
              style={
                {
                  '--progress': `${(state.index / (steps.length - 1)) * 100}%`,
                } as React.CSSProperties
              }
              onChange={(e) => playerRef.current?.seek(Number(e.target.value))}
            />
            <span>~{formatTime(duration / rate)}</span>
          </div>
          <div className="playback-controls">
            <div className="playback-left">
              <button
                className="icon-button"
                title="Restart lesson"
                aria-label="Restart lesson"
                onClick={() => {
                  playerRef.current?.restart();
                  setShowQuiz(false);
                }}
              >
                <RotateCcw size={18} />
              </button>
              <button
                className="play-button"
                aria-label={
                  playing
                    ? 'Pause lesson'
                    : state.phase === 'paused'
                      ? 'Resume lesson'
                      : state.phase === 'ended'
                        ? 'Replay lesson'
                        : 'Play lesson'
                }
                onClick={toggle}
              >
                {playing ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
                <span>
                  {playing
                    ? 'Pause'
                    : state.phase === 'paused'
                      ? 'Resume'
                      : state.phase === 'ended'
                        ? 'Replay'
                        : 'Play lesson'}
                </span>
              </button>
              <span className="playback-status">
                {state.phase === 'ended'
                  ? 'A little clearer now?'
                  : silent
                    ? 'Captions mode'
                    : 'Listen. Watch. Connect.'}
              </span>
            </div>
            <div className="playback-right">
              <select
                aria-label="Playback speed"
                value={rate}
                onChange={(e) => {
                  setRate(Number(e.target.value));
                  playerRef.current?.setRate(Number(e.target.value));
                }}
              >
                <option value="0.8">0.8×</option>
                <option value="1">1×</option>
                <option value="1.2">1.2×</option>
                <option value="1.5">1.5×</option>
              </select>
              <button
                className="icon-button"
                aria-label={silent ? 'Enable voice narration' : 'Switch to captions only'}
                title={silent ? 'Enable voice narration' : 'Switch to captions only'}
                aria-pressed={silent}
                onClick={() => setSilent((s) => !s)}
              >
                {silent ? <VolumeX size={19} /> : <Volume2 size={19} />}
              </button>
            </div>
          </div>
          <p className="seek-note">
            Seek moves to an explanation step. Duration is estimated; the voice sets the pace.
          </p>
        </div>
      </section>
      {state.error && (
        <div className="error-card" role="alert">
          <CircleHelp size={17} />
          <p>{state.error}</p>
          <button className="text-button" onClick={() => setSilent(true)}>
            Use captions
          </button>
        </div>
      )}
      <div className="lesson-bottom">
        <span>
          <span className="pencil-glyph">↳</span> Draw on the board to make an idea your own.
        </span>
        <button
          className="text-button"
          onClick={() => {
            playerRef.current?.pause();
            setShowQuiz((s) => !s);
          }}
          aria-expanded={showQuiz}
        >
          {showQuiz ? 'Hide check-in' : 'A quick check-in'}
          <ArrowDown size={14} />
        </button>
      </div>
      {(showQuiz || state.phase === 'ended') && (
        <section className="quiz-card">
          <span className="eyebrow">LET’S SEE WHAT CLICKED</span>
          <h3>{lesson.quiz.question}</h3>
          <div className="quiz-choices">
            {lesson.quiz.choices.map((choice, index) => (
              <button
                key={index}
                className={
                  answer === index ? (answer === lesson.quiz.answer ? 'correct' : 'incorrect') : ''
                }
                onClick={() => setAnswer(index)}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                {choice}
                {answer === index && answer === lesson.quiz.answer && <Check size={17} />}
              </button>
            ))}
          </div>
          {answer !== null && (
            <p role="status">
              <strong>{answer === lesson.quiz.answer ? 'That’s it. ' : 'Not quite. '}</strong>
              {lesson.quiz.explanation}
            </p>
          )}
        </section>
      )}
      {notes && (
        <section className="notes-panel">
          <div className="notes-title">
            <BookOpen size={17} />
            <h3>Your lesson, in words</h3>
          </div>
          {lesson.scenes.map((scene, si) => (
            <div key={si}>
              <h4>
                {String(si + 1).padStart(2, '0')} · {scene.title}
              </h4>
              {scene.beats.map((beat, bi) => (
                <button
                  key={bi}
                  onClick={() =>
                    playerRef.current?.seek(
                      steps.findIndex((s) => s.sceneIndex === si && s.beatIndex === bi),
                    )
                  }
                >
                  {beat.narration}
                </button>
              ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
