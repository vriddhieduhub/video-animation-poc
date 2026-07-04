import React from 'react';
import { ANIMATION_CONFIG, CANVAS_W, CANVAS_H, HAND_ERASER_IMG, HAND_SIZE } from '../engine/constants.js';

const WHITE_OVERLAY_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" preserveAspectRatio="none"><rect width="1920" height="1080" fill="#fff" /></svg>',
)}`;

export default function EraserRenderer({ element, seqStartTime, currentTime, layout }) {
  const speedMultiplier = ANIMATION_CONFIG.eraser.speed.speedMultiplier || 1;
  const progress = Math.max(0, Math.min((((currentTime - seqStartTime) * speedMultiplier) / element.animDuration) * 100, 100));
  if (progress === 0) return null;

  const eraserConfig = ANIMATION_CONFIG.eraser;
  const frame = Math.round(currentTime * 60);
  const width = typeof layout.width === 'number' ? layout.width : CANVAS_W;
  const height = typeof layout.height === 'number' ? layout.height : CANVAS_H;
  const externalLeft = layout.left || 0;
  const externalTop = layout.top || 0;

  const travelProgress = progress / 100;
  const baseHandX = externalLeft + travelProgress * (width - HAND_SIZE);
  const baseHandY = externalTop + travelProgress * (height - HAND_SIZE);
  const isWritingActive = progress > 0 && progress < 100;

  const scrubOffset = isWritingActive
    ? Math.sin(frame * eraserConfig.hand.scrubFrequency) * eraserConfig.hand.scrubAmplitude
    : 0;

  const handX = baseHandX + scrubOffset;
  const handY = baseHandY - (scrubOffset * 0.5);
  const microNoiseX = isWritingActive ? (Math.random() - 0.5) * eraserConfig.hand.microNoise : 0;
  const microNoiseY = isWritingActive ? (Math.random() - 0.5) * eraserConfig.hand.microNoise : 0;

  let clipPathString = 'polygon(0% 0%, 0% 0%, 0% 0%)';
  if (progress <= 50) {
    const p = progress * 2;
    clipPathString = `polygon(0% 0%, ${p}% 0%, 0% ${p}%)`;
  } else {
    const p = (progress - 50) * 2;
    clipPathString = `polygon(0% 0%, 100% 0%, 100% ${p}%, ${p}% 100%, 0% 100%)`;
  }

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: `${externalTop}px`,
          left: `${externalLeft}px`,
          width: `${width}px`,
          height: `${height}px`,
          overflow: 'hidden',
          clipPath: clipPathString,
          willChange: 'clip-path',
          zIndex: 9998,
        }}
      >
        <img
          src={WHITE_OVERLAY_SVG}
          alt="Whiteboard Eraser Overlay"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'fill',
          }}
        />
      </div>

      {isWritingActive && (
        <img
          src={HAND_ERASER_IMG}
          alt="Rubber hand erasing"
          style={{
            position: 'absolute',
            left: `${handX + microNoiseX}px`,
            top: `${handY + microNoiseY}px`,
            width: `${HAND_SIZE}px`,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
}
