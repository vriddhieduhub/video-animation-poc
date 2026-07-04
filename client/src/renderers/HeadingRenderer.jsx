import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { animProgress } from '../engine/mathUtils.js';
import {
  ANIMATION_CONFIG,
  HAND_WRITE_IMG,
  HAND_SIZE,
} from '../engine/constants.js';
import { htmlToReactNodes, flattenNodes } from './textAnimationUtils.js';

function resolveFontStyles({ fontFamily, bold }) {
  return {
    fontFamily,
    fontStyle: 'normal',
    fontWeight: bold ? 800 : 700,
  };
}

export default function HeadingRenderer({ element, seqStartTime, currentTime, layout }) {
  const { top, left, width, fontSize, color, fontFamily, bold, lineH } = layout;
  const frame = Math.round(currentTime * 60);
  const containerRef = useRef(null);
  const [charPositions, setCharPositions] = useState([]);

  const children = useMemo(() => htmlToReactNodes(element.content), [element.content]);
  const style = useMemo(() => ({ top: `${top}px`, left: `${left}px`, width: `${width}px` }), [top, left, width]);
  const animationConfig = ANIMATION_CONFIG.heading.hand;
  const { fontFamily: resolvedFontFamily, fontStyle, fontWeight } = resolveFontStyles({ fontFamily, bold });

  const flatChars = useMemo(() => flattenNodes(children), [children]);
  const totalChars = flatChars.length;

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const spans = containerRef.current.querySelectorAll('.live-char');
    const positions = [];

    spans.forEach((span) => {
      positions.push({
        x: span.offsetLeft + span.offsetWidth,
        y: span.offsetTop,
        width: span.offsetWidth,
        height: span.offsetHeight,
      });
    });

    if (positions.length > 0) {
      setCharPositions(positions);
    }
  }, [flatChars, totalChars, frame]);

  const adjustedProgress = animProgress(currentTime, seqStartTime, element.animDuration) * 100;
  const globalCharProgress = (adjustedProgress / 100) * totalChars;
  const currentCharIndex = Math.min(Math.floor(globalCharProgress), Math.max(totalChars - 1, 0));
  const charRemainder = globalCharProgress - currentCharIndex;
  const charsToShow = Math.min(Math.ceil(globalCharProgress), totalChars);

  let handBaseX = 0;
  let handBaseY = 0;

  if (charPositions.length === totalChars && totalChars > 0) {
    const c1 = charPositions[currentCharIndex];
    const c2 = charPositions[Math.min(currentCharIndex + 1, totalChars - 1)];

    if (c2 && c1 && c2.y > c1.y) {
      handBaseX = charRemainder < 0.1 ? c1.x : c2.x - c2.width;
      handBaseY = charRemainder < 0.1 ? c1.y : c2.y;
    } else if (c1) {
      handBaseX = c1.x + ((c2 ? c2.x : c1.x) - c1.x) * charRemainder;
      handBaseY = c1.y;
    }
  }

  const writeOffsetX = animationConfig.offsetX;
  const writeOffsetY = fontSize * animationConfig.offsetYRatio;

  const externalLeft = left;
  const externalTop = top;

  const handX = handBaseX + writeOffsetX + externalLeft;
  const isWritingActive = adjustedProgress > 0 && adjustedProgress < 100;

  const wave1 = Math.sin(frame * animationConfig.waveFrequency);
  const wave2 = Math.cos(frame * (animationConfig.waveFrequency * 0.55));
  const compoundWaveY = isWritingActive
    ? (wave1 * 0.6 + wave2 * 0.4) * animationConfig.waveAmplitude
    : 0;

  const humanNoiseX = isWritingActive ? ((Math.random() - 0.5) * animationConfig.microNoise) : 0;
  const humanNoiseY = isWritingActive ? ((Math.random() - 0.5) * animationConfig.microNoise) : 0;

  const handY = handBaseY + writeOffsetY + compoundWaveY + humanNoiseY + externalTop;

  if (adjustedProgress <= 0) return null;

  return (
    <>
      <h1
        ref={containerRef}
        style={{
          position: 'absolute',
          top: style.top,
          left: style.left,
          fontSize: `${fontSize}px`,
          color,
          margin: 0,
          fontFamily: resolvedFontFamily,
          fontStyle,
          fontWeight,
          whiteSpace: 'pre',
          lineHeight: `${lineH}px`,
          zIndex: 10,
          width: style.width,
        }}
      >
        {flatChars.map((item, idx) => {
          const isVisible = idx < charsToShow;
          return (
            <span
              key={idx}
              className="live-char"
              style={{
                ...item.style,
                display: 'inline',
                opacity: isVisible ? 1 : 0,
              }}
            >
              {item.char}
            </span>
          );
        })}
      </h1>

      {isWritingActive && charPositions.length === totalChars && (
        <img
          src={HAND_WRITE_IMG}
          alt="Hand with pen"
          style={{
            position: 'absolute',
            left: `${handX + humanNoiseX}px`,
            top: `${handY}px`,
            width: `${HAND_SIZE}px`,
            zIndex: 100,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
}
