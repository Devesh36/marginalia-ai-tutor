'use client';
import { useRef, useState } from 'react';
import { MousePointer2, PenLine, Undo2, Trash2 } from 'lucide-react';
import type { BoardElement } from '@/lib/lesson';

const colors = {
  ink: '#344039',
  green: '#4d7758',
  orange: '#c17a41',
  blue: '#547fa0',
  purple: '#8d72a4',
};
type Stroke = { color: string; points: { x: number; y: number }[] };
function wrapped(label: string, width: number) {
  const max = Math.max(8, Math.floor(width / 10));
  return label
    .split('\n')
    .flatMap((line) => {
      const words = line.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        if (current.length + word.length > max && current) {
          lines.push(current);
          current = word;
        } else current += (current ? ' ' : '') + word;
      }
      if (current) lines.push(current);
      return lines;
    })
    .slice(0, 4);
}
function Element({ element: e, focused }: { element: BoardElement; focused: boolean }) {
  const color = colors[e.color];
  const line = e.type === 'line' || e.type === 'arrow';
  const lines = wrapped(e.label, line ? 180 : e.w - 20);
  const cx = line ? e.x + e.w / 2 : e.x + e.w / 2;
  const cy = line ? e.y + e.h / 2 - 18 : e.y + e.h / 2;
  return (
    <g className={`board-element ${focused ? 'focused' : ''}`} style={{ color }}>
      {focused && !line && (
        <rect
          x={e.x - 7}
          y={e.y - 7}
          width={e.w + 14}
          height={e.h + 14}
          rx={e.type === 'ellipse' ? e.w / 2 : 18}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="5 6"
          opacity=".4"
        />
      )}
      {e.type === 'box' && (
        <rect
          x={e.x}
          y={e.y}
          width={e.w}
          height={e.h}
          rx="12"
          fill={`${color}09`}
          stroke={color}
          strokeWidth={focused ? 2.8 : 2}
        />
      )}
      {e.type === 'ellipse' && (
        <ellipse
          cx={e.x + e.w / 2}
          cy={e.y + e.h / 2}
          rx={e.w / 2}
          ry={e.h / 2}
          fill={`${color}09`}
          stroke={color}
          strokeWidth={focused ? 2.8 : 2}
        />
      )}
      {line && (
        <line
          x1={e.x}
          y1={e.y}
          x2={e.x + e.w}
          y2={e.y + e.h}
          stroke={color}
          strokeWidth={focused ? 3 : 2}
          markerEnd={e.type === 'arrow' ? `url(#arrow-${e.color})` : undefined}
        />
      )}
      {e.label && (
        <text
          x={cx}
          y={cy - (lines.length - 1) * 13}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={e.type === 'text' ? 23 : 19}
          fontWeight={focused ? 600 : 500}
        >
          {lines.map((line, i) => (
            <tspan key={i} x={cx} dy={i ? 26 : 0}>
              {line}
            </tspan>
          ))}
        </text>
      )}
    </g>
  );
}
export function Whiteboard({
  elements,
  focus,
  label,
  onAnnotate,
}: {
  elements: BoardElement[];
  focus: string[];
  label: string;
  onAnnotate: () => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<'select' | 'pen'>('select');
  const [color, setColor] = useState('#c17a41');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const point = (event: React.PointerEvent) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return {
      x: Math.max(0, Math.min(920, p.x)),
      y: Math.max(0, Math.min(520, p.y)),
    };
  };
  return (
    <div className="board-surface">
      <svg
        ref={svg}
        viewBox="0 0 920 520"
        className={`drawing-board ${tool === 'pen' ? 'pen-active' : ''}`}
        role="img"
        aria-label={label}
        onPointerDown={(event) => {
          if (tool !== 'pen') return;
          event.preventDefault();
          onAnnotate();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrawing(true);
          setStrokes((s) => [...s, { color, points: [point(event)] }]);
        }}
        onPointerMove={(event) => {
          if (!drawing) return;
          const p = point(event);
          setStrokes((s) =>
            s.map((stroke, i) =>
              i === s.length - 1 ? { ...stroke, points: [...stroke.points, p] } : stroke,
            ),
          );
        }}
        onPointerUp={() => setDrawing(false)}
        onPointerCancel={() => setDrawing(false)}
      >
        <title>{label}</title>
        <defs>
          {Object.entries(colors).map(([name, color]) => (
            <marker
              key={name}
              id={`arrow-${name}`}
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path
                d="M 1 1 L 7 4 L 1 7"
                fill="none"
                stroke={color}
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          ))}
        </defs>
        {elements.map((element) => (
          <Element key={element.id} element={element} focused={focus.includes(element.id)} />
        ))}
        {strokes.map((stroke, i) => (
          <polyline
            key={i}
            fill="none"
            stroke={stroke.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={stroke.points.map((p) => `${p.x},${p.y}`).join(' ')}
          />
        ))}
      </svg>
      <div className="board-tools" aria-label="Whiteboard tools">
        <button
          className={`icon-button ${tool === 'select' ? 'selected' : ''}`}
          title="Explore board"
          aria-label="Explore board"
          aria-pressed={tool === 'select'}
          onClick={() => setTool('select')}
        >
          <MousePointer2 size={17} />
        </button>
        <button
          className={`icon-button ${tool === 'pen' ? 'selected' : ''}`}
          title="Draw a note (pauses lesson)"
          aria-label="Draw a note"
          aria-pressed={tool === 'pen'}
          onClick={() => {
            setTool('pen');
            onAnnotate();
          }}
        >
          <PenLine size={17} />
        </button>
        <span className="tool-divider" />
        {['#c17a41', '#4d7758', '#547fa0'].map((c) => (
          <button
            key={c}
            className={`color-button ${color === c ? 'active' : ''}`}
            style={{ background: c }}
            onClick={() => {
              setColor(c);
              setTool('pen');
              onAnnotate();
            }}
            aria-label={`Draw with ${c === '#c17a41' ? 'orange' : c === '#4d7758' ? 'green' : 'blue'} ink`}
            aria-pressed={color === c}
          />
        ))}
        <span className="tool-divider" />
        <button
          className="icon-button"
          aria-label="Undo drawing"
          title="Undo drawing"
          disabled={!strokes.length}
          onClick={() => setStrokes((s) => s.slice(0, -1))}
        >
          <Undo2 size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Clear drawings"
          title="Clear drawings"
          disabled={!strokes.length}
          onClick={() => setStrokes([])}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <span className="board-hint">
        {tool === 'pen' ? 'Your space to think. Draw anywhere.' : 'A little space for a big idea.'}
      </span>
    </div>
  );
}
