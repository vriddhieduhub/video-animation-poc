import React, { useRef } from 'react';
import { animProgress, easeOutCubic, easeInOutQuad, clamp, handWobble } from '../engine/mathUtils.js';
import {
  HAND_PHYSICS,
  NIB_OFFSET,
  HAND_WRITE_IMG,
  HAND_SIZE,
} from '../engine/constants.js';
import { underlineColorFromClass } from '../components/SceneRenderer.jsx';

/**
 * UnderlineRenderer
 * ─ Draws from scaleX(0) → scaleX(1) left-to-right
 * ─ Hand image rides the leading edge with compound-wave wobble
 *
 * layout = { top, left, width }
 */
export default function UnderlineRenderer({ element, seqStartTime, currentTime, layout }) {
  const { top, left, width } = layout;

  // ── Frame counter ─────────────────────────────────────────────────────────
  const frameRef = useRef(0);
  frameRef.current += 1;

  // ── Animation progress — duration computed from bar width in configParser ─
  const rawProgress = animProgress(currentTime, seqStartTime, element.animDuration);
  const eased       = easeOutCubic(rawProgress);

  const cls         = element.rawClasses || '';
  const barColor    = underlineColorFromClass(cls);
  const isAnimating = rawProgress > 0 && rawProgress < 1;

  // ── Hand position: nib rides right at the drawing tip ────────────────────
  // currentLineWidth is how far the bar has grown from the left
  const currentLineWidth = eased * width;

  // Pass eased*100 as a pseudo-charIndex so the underline hand has
  // the same stroke-rhythm as the text renderers
  const { wobbleY } = handWobble(
    frameRef.current, HAND_PHYSICS, isAnimating, eased * 100, '',
  );

  // easeOutCubic makes the pen's forward speed drop to ~0 near the end. If the
  // hand kept its organic wobble there, the horizontal drift would exceed the
  // (tiny) forward motion and the hand would jitter back-and-forth in place —
  // the "violent shaking" at the end of the underline.
  //
  // Fix: keep the horizontal position strictly monotonic (no X wobble at all,
  // so the pen only ever moves forward along the line) and fade the vertical
  // wobble fully out before the pen reaches its flat tail, so it glides to a
  // smooth, still stop.
  const settle = 1 - easeInOutQuad(clamp((rawProgress - 0.5) / 0.35, 0, 1));

  const handX = left + currentLineWidth + NIB_OFFSET.underline.x;
  const handY = top + NIB_OFFSET.underline.y + wobbleY * settle;

  return (
    <>
      {/* The underline bar — grows from left via scaleX */}
      <div
        style={{
          position:        'absolute',
          top:             `${top}px`,
          left:            `${left}px`,
          width:           `${width}px`,
          height:          '6px',
          transformOrigin: 'left center',
          transform:       `scaleX(${eased})`,
          background:      barColor,
          borderRadius:    '3px',
          overflow:        'visible',
        }}
      />

      {/* Writing hand rides the leading edge */}
      {isAnimating && (
        <img
          src={HAND_WRITE_IMG}
          alt=""
          style={{
            position:      'absolute',
            left:          `${handX}px`,
            top:           `${handY}px`,
            width:         `${HAND_SIZE}px`,
            height:        'auto',
            transform:     'rotate(-8deg)',
            pointerEvents: 'none',
            zIndex:        100,
            filter:        'drop-shadow(1px 2px 3px rgba(0,0,0,0.18))',
          }}
        />
      )}
    </>
  );
}
