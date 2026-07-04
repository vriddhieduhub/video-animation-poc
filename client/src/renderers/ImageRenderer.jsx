import React, { useRef } from 'react';
import { animProgress } from '../engine/mathUtils.js';
import {
  ANIMATION_CONFIG,
  HAND_ART_IMG,
  HAND_SIZE,
} from '../engine/constants.js';

export default function ImageRenderer({ element, seqStartTime, currentTime, layout }) {
  const { top, left, width } = layout;
  const height = typeof layout.height === 'number' ? layout.height : 450;
  const frameRef = useRef(0);
  frameRef.current += 1;

  const progress = animProgress(currentTime, seqStartTime, element.animDuration) * 100;
  const isWritingActive = progress > 0 && progress < 100;
  if (progress === 0) return null;

  const imageConfig = ANIMATION_CONFIG.image.hand;
  const basePathX = (progress / 100) * width;
  const basePathY = (progress / 100) * height;

  const swingAngle = frameRef.current * (imageConfig.waveFrequency * 0.5625);
  const swing = Math.sin(swingAngle) * (imageConfig.waveAmplitude * 2.8);

  const handX = basePathX + swing + imageConfig.offsetX + left;
  const handY = basePathY - swing + imageConfig.offsetY + top;

  const microNoiseX = isWritingActive ? (Math.random() - 0.5) * imageConfig.microNoise : 0;
  const microNoiseY = isWritingActive ? (Math.random() - 0.5) * imageConfig.microNoise : 0;

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
          top: `${top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${height}px`,
          overflow: 'hidden',
          clipPath: clipPathString,
          willChange: 'clip-path',
        }}
      >
        <img
          src={element.content}
          alt="scene asset"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>

      {isWritingActive && (
        <img
          src={HAND_ART_IMG}
          alt="Hand drawing image"
          style={{
            position: 'absolute',
            left: `${handX + microNoiseX}px`,
            top: `${handY + microNoiseY}px`,
            width: `${HAND_SIZE}px`,
            zIndex: 100,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
}
