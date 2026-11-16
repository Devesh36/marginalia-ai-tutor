'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Headphones,
  LoaderCircle,
  MessageCircle,
  Play,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { Whiteboard } from '@/components/whiteboard';
import { boardAt, lessonSchema, type LessonEnvelope, type Provider } from '@/lib/lesson';
import { LessonStage } from '@/components/lesson-stage';
import { sample } from '@/lib/sample';

type Message = { role: 'user' | 'assistant'; content: string };
const suggestions = [
  'How do neural networks learn?',
  'Why is the sky blue?',
  'Explain compound interest',
];

export default function Home() {
  const [envelope, setEnvelope] = useState<LessonEnvelope | null>(null);
  const [provider, setProvider] = useState<Provider>('gemini');
  const [available, setAvailable] = useState({ codex: false, gemini: false });
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState<'lesson' | 'answer' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followups, setFollowups] = useState<string[]>([]);
  const [notes, setNotes] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const pauseRef = useRef<() => void>(() => {});
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((data) => {
        setAvailable(data.available);
        setProvider(data.defaultProvider);
        setStatusLoaded(true);
      })
      .catch(() => {
        setError('Could not connect to the tutor server. Refresh the page to try again.');
      });
    return () => requestRef.current?.abort();
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy, error]);
  function reset() {
    ++requestId.current;
    requestRef.current?.abort();
    pauseRef.current();
    setEnvelope(null);
    setMessages([]);
    setInput('');
    setError(null);
    setFollowups([]);
    setBusy(null);
    setNotes(false);
    inputRef.current?.focus();
  }
  function loadSample() {
    ++requestId.current;
    requestRef.current?.abort();
    pauseRef.current();
    setBusy(null);
    setError(null);
    setFollowups([]);
    setNotes(false);
    setEnvelope({ ...sample, createdAt: new Date().toISOString() });
    setMessages([
      {
        role: 'assistant',
        content:
          'This is an authored sample about neural networks. Try the voice, timeline, and drawing tools. New lessons and follow-up answers use your selected AI provider.',
      },
    ]);
    setInput('');
  }
  async function send(topic = input) {
    const text = topic.trim();
    if (busy || text.length < (envelope ? 2 : 3)) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const id = ++requestId.current;
    pauseRef.current();
    setError(null);
    setBusy(envelope ? 'answer' : 'lesson');
    try {
      const response = await fetch(envelope ? '/api/followup' : '/api/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(
          envelope
            ? {
                question: text,
                provider,
                lesson: envelope.lesson,
                history: messages.slice(-10),
              }
            : { topic: text, provider },
        ),
      });
      const data = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok)
        throw new Error(data.error || 'Could not complete this request. Please try again.');
      if (envelope) {
        setMessages((m) => [
          ...m,
          { role: 'user', content: text },
          { role: 'assistant', content: data.answer },
        ]);
        setFollowups(data.suggestions);
      } else {
        const lesson = lessonSchema.parse(data.lesson);
        setEnvelope({ ...data, lesson });
        setNotes(false);
        setMessages([
          { role: 'user', content: text },
          {
            role: 'assistant',
            content: `Your lesson is ready. We’ll work through ${lesson.scenes.length} short chapters, one idea at a time. Press play whenever you’re ready.`,
          },
        ]);
        setFollowups([
          'Explain it with a different example',
          'What is the most common misconception?',
        ]);
      }
      setInput('');
    } catch (e) {
      if (id === requestId.current && !controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      if (id === requestId.current) setBusy(null);
    }
  }
  const ready = statusLoaded && available[provider];
  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="/" className="brand" aria-label="Marginalia home">
          <span className="brand-mark">
            m<span>·</span>
          </span>
          <span>
            marginalia<span className="brand-period">.</span>
          </span>
        </a>
        <span className="brand-description">A little curiosity goes a long way.</span>
        <div className="provider-control">
          <span className={`status-dot ${ready ? 'ready' : ''}`} />
          <select
            aria-label="AI provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            disabled={!!busy}
          >
            {available.codex && <option value="codex">Local Codex</option>}
            <option value="gemini">
              Gemini{statusLoaded && !available.gemini ? ' · needs key' : ''}
            </option>
          </select>
          <ChevronDown size={13} />
        </div>
      </header>
      <div className="workspace">
        <aside className="chat-panel" aria-label="Tutor conversation">
          <div className="chat-heading">
            <span>
              <span className="small-mark">m.</span> Your learning space
            </span>
            <button
              className="icon-button"
              onClick={reset}
              aria-label="Start a new lesson"
              title="Start a new lesson"
            >
              <Plus size={19} />
            </button>
          </div>
          <div className="chat-scroll">
            {!envelope && (
              <div className="welcome">
                <span className="eyebrow">
                  <Sparkles size={13} /> FOLLOW YOUR CURIOSITY
                </span>
                <h1>
                  What are we
                  <br />
                  learning today?
                </h1>
                <p>A question, a concept, a passing curiosity. Let’s make it click, together.</p>
                <div className="topic-suggestions">
                  {suggestions.map((topic, i) => (
                    <button
                      key={topic}
                      disabled={!!busy}
                      onClick={() => {
                        setInput(topic);
                        inputRef.current?.focus();
                      }}
                    >
                      <span className="suggestion-symbol">{['✳', '☼', '↗'][i]}</span>
                      <span>{topic}</span>
                      <ArrowRight size={15} />
                    </button>
                  ))}
                </div>
                <div className="sample-card">
                  <span className="sample-icon">
                    <Play size={16} fill="currentColor" />
                  </span>
                  <div>
                    <strong>Take a look around</strong>
                    <p>Try a ready-to-play sample lesson.</p>
                    <button onClick={loadSample}>
                      Explore the sample <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {messages.map((message, i) => (
              <div key={i} className={`chat-message ${message.role}`}>
                {message.role === 'assistant' && <span className="message-avatar">m.</span>}
                <div>
                  <span className="message-author">
                    {message.role === 'user' ? 'You' : 'Marginalia'}
                  </span>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
            {busy && (
              <div className="thinking" role="status">
                <LoaderCircle className="spin" size={17} />
                <div>
                  <strong>
                    {busy === 'lesson' ? 'Connecting the dots…' : 'Thinking it through…'}
                  </strong>
                  <span>
                    {busy === 'lesson'
                      ? 'Planning the explanation and drawing your lesson.'
                      : 'Finding a helpful way to explain it.'}
                  </span>
                  <small>
                    {provider === 'codex'
                      ? 'Local Codex can take up to 3 minutes.'
                      : 'This may take about a minute.'}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label="Cancel generation"
                  onClick={() => {
                    ++requestId.current;
                    requestRef.current?.abort();
                    setBusy(null);
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            {error && (
              <div className="error-card" role="alert">
                <CircleHelp size={17} />
                <p>{error}</p>
              </div>
            )}
            {!!envelope && !busy && followups.length > 0 && (
              <div className="followup-suggestions">
                <span className="eyebrow">KEEP EXPLORING</span>
                {followups.map((question) => (
                  <button
                    key={question}
                    onClick={() => {
                      setInput(question);
                      inputRef.current?.focus();
                    }}
                  >
                    {question}
                    <Plus size={13} />
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            className="chat-compose"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="topic-input">
              {envelope ? 'Ask a follow-up question' : 'What would you like to learn?'}
            </label>
            <div className="input-box">
              <textarea
                ref={inputRef}
                id="topic-input"
                rows={3}
                value={input}
                maxLength={envelope ? 600 : 300}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  envelope ? 'Ask a question. Go a little deeper…' : 'I’ve always wondered…'
                }
                disabled={!!busy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="compose-footer">
                <span>
                  {envelope ? (
                    <>
                      <MessageCircle size={13} /> Ask your tutor
                    </>
                  ) : (
                    <>
                      <Headphones size={13} /> A 2-minute visual lesson
                    </>
                  )}
                </span>
                <button
                  className="send-button"
                  aria-label={envelope ? 'Send follow-up question' : 'Generate lesson'}
                  disabled={!!busy || input.trim().length < (envelope ? 2 : 3) || !statusLoaded}
                >
                  <ArrowRight size={19} />
                </button>
              </div>
            </div>
            <p className="compose-hint">
              Enter to send <span>·</span> Shift + Enter for a new line
            </p>
            {statusLoaded && !ready && (
              <p className="configuration-note">
                Gemini needs a server API key. The sample is ready to explore.
              </p>
            )}
          </form>
        </aside>
        <main className="lesson-workspace">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">
                <span className="tiny-dot" /> THE WHITEBOARD
              </span>
              <h2>{envelope ? envelope.lesson.title : 'Big ideas. A little clearer.'}</h2>
              <p>
                {envelope
                  ? envelope.lesson.summary
                  : 'See the connections. Hear the explanation. Find your aha.'}
              </p>
            </div>
            {envelope && (
              <button
                className={`notes-button ${notes ? 'active' : ''}`}
                aria-label="Lesson notes"
                onClick={() => setNotes((n) => !n)}
                aria-expanded={notes}
              >
                <BookOpen size={16} />
                <span>Lesson notes</span>
              </button>
            )}
          </div>
          {envelope ? (
            <LessonStage
              key={envelope.createdAt}
              envelope={envelope}
              notes={notes}
              pauseRef={pauseRef}
            />
          ) : (
            <div className="empty-stage">
              <div className="board-card preview-card">
                <div className="board-topline">
                  <span className="chapter-label">A GLIMPSE OF WHAT’S AHEAD</span>
                  <span className="preview-label">Sample whiteboard</span>
                </div>
                <div className="preview-heading">
                  <span className="handwritten">It starts with a question.</span>
                  <p>We’ll connect the dots from there.</p>
                </div>
                <Whiteboard
                  elements={boardAt(sample.lesson, 2).elements}
                  focus={[]}
                  label="Sample diagram: study hours feed a calculation to predict an exam score"
                  onAnnotate={() => {}}
                />
                <div className="preview-bottom">
                  <span>
                    <span className="pulse-dot" /> Your next aha moment is one question away.
                  </span>
                  <button onClick={loadSample}>
                    Try a sample <Play size={13} />
                  </button>
                </div>
              </div>
              <div className="how-it-works">
                <div>
                  <span className="step-number">01</span>
                  <div>
                    <strong>Bring a question</strong>
                    <p>Anything you’re curious about.</p>
                  </div>
                </div>
                <ArrowRight size={18} />
                <div>
                  <span className="step-number">02</span>
                  <div>
                    <strong>Watch it unfold</strong>
                    <p>Visuals and voice, in step.</p>
                  </div>
                </div>
                <ArrowRight size={18} />
                <div>
                  <span className="step-number">03</span>
                  <div>
                    <strong>Make it yours</strong>
                    <p>Pause, draw, and ask why.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <footer className="workspace-footer">
            <span>
              <Sparkles size={12} /> A space for understanding, not just answers.
            </span>
            <span>AI can make mistakes. Stay curious.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
