import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { animProgress } from '../engine/mathUtils.js';
import {
  ANIMATION_CONFIG,
  HAND_WRITE_IMG,
  HAND_SIZE,
} from '../engine/constants.js';
import { htmlToReactNodes, flattenNodes } from './textAnimationUtils.js';

export default function ParagraphRenderer({ element, seqStartTime, currentTime, layout }) {
  const { top, left, width, fontSize, color, fontFamily, lineH } = layout;
  const frame = Math.round(currentTime * 60);
  const containerRef = useRef(null);
  const [charPositions, setCharPositions] = useState([]);

  const children = useMemo(() => htmlToReactNodes(element.content), [element.content]);
  const style = useMemo(() => ({ top: `${top}px`, left: `${left}px`, width: `${width}px` }), [top, left, width]);
  const animationConfig = ANIMATION_CONFIG.paragraph.hand;

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
  if (adjustedProgress === 0) return null;

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
  const wave3 = Math.sin(frame * (animationConfig.waveFrequency * 0.28));
  const compoundWaveY = isWritingActive
    ? ((wave1 * 0.5) + (wave2 * 0.3) + (wave3 * 0.2)) * animationConfig.waveAmplitude
    : 0;
  const arcX = isWritingActive ? Math.sin(charRemainder * Math.PI) * animationConfig.arcAmplitude : 0;
  const swayX = isWritingActive ? Math.sin(frame * (animationConfig.waveFrequency * 0.7)) * (animationConfig.arcAmplitude * 0.45) : 0;
  const dipY = isWritingActive ? Math.sin(charRemainder * Math.PI) * (animationConfig.waveAmplitude * 0.35) : 0;
  const humanNoiseX = isWritingActive ? ((Math.random() - 0.5) * animationConfig.microNoise) : 0;
  const humanNoiseY = isWritingActive ? ((Math.random() - 0.5) * animationConfig.microNoise) : 0;

  const handY = handBaseY + writeOffsetY + compoundWaveY + dipY + humanNoiseY + externalTop;

  return (
    <>
      <p
        ref={containerRef}
        style={{
          position: 'absolute',
          display: 'block',
          top: style.top,
          left: style.left,
          fontSize: `${fontSize}px`,
          color,
          fontFamily,
          margin: 0,
          lineHeight: `${lineH}px`,
          width: style.width,
          wordBreak: 'keep-all',
          wordWrap: 'break-word',
        }}
      >
        {flatChars.map((item, idx) => {
          const isVisible = idx < charsToShow;

          let Tag = 'span';
          if (item.type === 'strong' || item.type === 'b') Tag = 'strong';
          if (item.type === 'i' || item.type === 'em') Tag = 'i';
          if (item.type === 'u') Tag = 'u';

          return (
            <Tag
              key={idx}
              className={`live-char ${item.className}`.trim()}
              style={{
                ...item.style,
                display: 'inline',
                whiteSpace: 'pre-wrap',
                opacity: isVisible ? 1 : 0,
              }}
            >
              {item.char}
            </Tag>
          );
        })}
      </p>

      {isWritingActive && charPositions.length === totalChars && (
        <img
          src={HAND_WRITE_IMG}
          alt="Hand with pen"
          style={{
            position: 'absolute',
            left: `${handX + arcX + swayX + humanNoiseX}px`,
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
