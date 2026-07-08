import React from 'react';
import { CANVAS_W, CANVAS_H } from '../engine/constants.js';
import HeadingRenderer   from '../renderers/HeadingRenderer.jsx';
import ParagraphRenderer from '../renderers/ParagraphRenderer.jsx';
import ImageRenderer     from '../renderers/ImageRenderer.jsx';
import UnderlineRenderer from '../renderers/UnderlineRenderer.jsx';
import EraserRenderer    from '../renderers/EraserRenderer.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// CLASS → PIXEL EXTRACTORS
// These parse master.css utility classes to concrete pixel values.
// This is the single source of truth — renderers receive px numbers only.
// ─────────────────────────────────────────────────────────────────────────────

/** Extract `top-NNN` → number (px) */
function topFromClass(cls, fallback = 0) {
  const m = cls.match(/\btop-(\d+)\b/);
  return m ? parseInt(m[1], 10) : fallback;
}

/** Extract `left-NNN` → number (px) */
function leftFromClass(cls, fallback = 0) {
  const m = cls.match(/\bleft-(\d+)\b/);
  return m ? parseInt(m[1], 10) : fallback;
}

/** Extract `w-NNN` → number (px) */
function widthFromClass(cls, fallback = 1400) {
  const m = cls.match(/\bw-(\d+)\b/);
  return m ? parseInt(m[1], 10) : fallback;
}

/** Extract `h-NNN` → number (px) */
function heightFromClass(cls, fallback = 'auto') {
  const m = cls.match(/\bh-(\d+)\b/);
  return m ? parseInt(m[1], 10) : fallback;
}

/** Extract font-size from text-* class → px number */
export function fontSizeFromClass(cls, fallback = 36) {
  const sizes = {
    'text-xs': 16, 'text-sm': 20, 'text-base': 24,
    'text-lg': 28, 'text-xl': 32, 'text-2xl': 38,
    'text-3xl': 45, 'text-4xl': 52, 'text-5xl': 64,
    'text-6xl': 75, 'text-7xl': 85, 'text-8xl': 95, 'text-9xl': 110,
  };
  for (const [k, v] of Object.entries(sizes)) {
    if (cls.includes(k)) return v;
  }
  return fallback;
}

/** Extract color value from text-COLOR class */
export function colorFromClass(cls, fallback = '#1a1a1a') {
  const map = {
    'text-black':      '#000000',
    'text-white':      '#ffffff',
    'text-gray':       '#4b5563',
    'text-light-gray': '#9ca3af',
    'text-red':        '#e11d48',
    'text-blue':       '#1d4ed8',
    'text-cyan':       '#0284c7',
    'text-green':      '#10b981',
    'text-emerald':    '#047857',
    'text-purple':     '#7e22ce',
    'text-fuchsia':    '#c026d3',
    'text-pink':       '#db2777',
    'text-orange':     '#ea580c',
    'text-yellow':     '#d97706',
  };
  for (const [k, v] of Object.entries(map)) {
    if (cls.includes(k)) return v;
  }
  return fallback;
}

/** Extract underline bar color from underline-COLOR class.
 *  Values mirror master.css exactly — single source of truth is the class name. */
export function underlineColorFromClass(cls) {
  const map = {
    'underline-red':    '#e11d48',
    'underline-blue':   '#1d4ed8',
    'underline-green':  '#10b981',
    'underline-black':  '#000000',
    'underline-purple': '#7e22ce',
    'underline-orange': '#ea580c',
    'underline-cyan':   '#0284c7',
    'underline-fuchsia':'#c026d3',
    'underline-pink':   '#db2777',
    'underline-yellow': '#d97706',
    'underline-lime':   '#65a30d',
  };
  for (const [k, v] of Object.entries(map)) {
    if (cls.includes(k)) return v;
  }
  return '#10b981'; // default → green (matches underline-green in master.css)
}

/** Extract font-family string from font-* class.
 *  Falls back to Kalam — the canonical whiteboard handwriting font. */
export function fontFamilyFromClass(cls) {
  const map = {
    'font-kalam':       "'Kalam', cursive",
    'font-caveat':      "'Caveat', cursive",
    'font-patrick':     "'Patrick Hand', cursive",
    'font-architect':   "'Architects Daughter', cursive",
    'font-delius':      "'Delius', cursive",
    'font-fredoka':     "'Fredoka', sans-serif",
    'font-comfortaa':   "'Comfortaa', sans-serif",
    'font-shadow':      "'Shadows Into Light', cursive",
    'font-amatic':      "'Amatic SC', cursive",
    'font-marker':      "'Permanent Marker', cursive",
    'font-indie':       "'Indie Flower', cursive",
    'font-another-hand':"'Just Another Hand', cursive",
    'font-rock-salt':   "'Rock Salt', cursive",
    'font-quicksand':   "'Quicksand', sans-serif",
    'font-pangolin':    "'Kalam', cursive",  // remapped → Kalam until changed
  };
  for (const [k, v] of Object.entries(map)) {
    if (cls.includes(k)) return v;
  }
  return "'Kalam', cursive";  // global default
}

/** true if cls contains 'bold' or 'font-bold' */
export function isBold(cls) {
  return /\b(bold|font-bold)\b/.test(cls);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE RENDERER
// ─────────────────────────────────────────────────────────────────────────────

export default function SceneRenderer({ scene, currentTime }) {
  const { elements, startTime, endTime, sceneId } = scene;

  // Pre-compute every element's absolute seqStartTime BEFORE JSX render.
  // This avoids any mutation-during-render fragility with JSX map callbacks.
  const seqStartTimes = [];
  let acc = startTime;
  for (const el of elements) {
    seqStartTimes.push(acc);
    acc += el.slotDuration;
  }

  // Time within this scene (0 = scene start)
  const sceneLocalTime = currentTime - startTime;

  return (
    <div
      style={{
        position:   'absolute',
        top:        0,
        left:       0,
        width:      `${CANVAS_W}px`,
        height:     `${CANVAS_H}px`,
        background: '#ffffff',
        overflow:   'hidden',
      }}
    >
      {/* Scene badge top-right */}
      {/* <span
        style={{
          position:      'absolute',
          top:           '28px',
          right:         '50px',
          fontSize:      '22px',
          fontWeight:    700,
          color:         '#c8cdd5',
          letterSpacing: '1px',
          fontFamily:    "'Quicksand', sans-serif",
          zIndex:        200,
          pointerEvents: 'none',
        }}
      >
        Scene {sceneId}
      </span> */}

      {elements.map((el, idx) => {
        const seqStart = seqStartTimes[idx];

        const cls        = el.rawClasses || '';
        const top        = topFromClass(cls, 80);
        const left       = leftFromClass(cls, 100);
        const width      = widthFromClass(cls, 1400);
        const height     = heightFromClass(cls, 'auto');
        const fontSize   = fontSizeFromClass(cls, el.type === 'heading' ? 75 : 36);
        const color      = colorFromClass(cls, '#1a1a1a');
        const fontFamily = fontFamilyFromClass(cls);
        const bold       = isBold(cls);
        const lineH      = Math.round(fontSize * 1.7);

        const sharedLayout = { top, left, width, height, fontSize, color, fontFamily, bold, lineH };

        return (
          <React.Fragment key={el.seqId}>
            {el.type === 'heading' && (
              <HeadingRenderer
                element={el}
                seqStartTime={seqStart}
                currentTime={currentTime}
                layout={sharedLayout}
              />
            )}
            {el.type === 'paragraph' && (
              <ParagraphRenderer
                element={el}
                seqStartTime={seqStart}
                currentTime={currentTime}
                layout={sharedLayout}
              />
            )}
            {(el.type === 'underline' || el.type === 'divider') && (
              <UnderlineRenderer
                element={el}
                seqStartTime={seqStart}
                currentTime={currentTime}
                layout={sharedLayout}
              />
            )}
            {el.type === 'image' && (
              <ImageRenderer
                element={el}
                seqStartTime={seqStart}
                currentTime={currentTime}
                layout={sharedLayout}
              />
            )}
            {el.type === 'eraser' && (
              <EraserRenderer
                element={el}
                seqStartTime={seqStart}
                currentTime={currentTime}
                layout={sharedLayout}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
