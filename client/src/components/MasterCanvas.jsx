import React, { useRef, useEffect, useState } from 'react';
import { CANVAS_W, CANVAS_H } from '../engine/constants.js';
import SceneRenderer from './SceneRenderer.jsx';

/**
 * MasterCanvas — the 1920×1080 whiteboard surface.
 *
 * The outer clip container fills as much viewport space as possible while
 * maintaining a 16:9 aspect ratio. The inner 1920×1080 div is scaled
 * via CSS transform so pixel positions defined in master.css are always
 * exact. On export the un-scaled 1920×1080 div is snapshotted directly.
 *
 * @param {{
 *   activeScene:  import('../engine/configParser.js').Scene | null,
 *   currentTime:  number,
 *   canvasRef:    React.RefObject,
 * }} props
 */
export default function MasterCanvas({ activeScene, currentTime, canvasRef }) {
  // Compute the best-fit scale to fill the parent container.
  // We read the parent's dimensions and re-compute on resize.
  const [scale, setScale] = useState(0.4);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function measure() {
      const el = wrapperRef.current?.parentElement;
      if (!el) return;
      const availW = el.clientWidth - 12;
      const availH = el.clientHeight - 12;
      const fitByW = availW / CANVAS_W;
      const fitByH = availH / CANVAS_H;
      setScale(Math.min(fitByW, fitByH, 1));  // never upscale beyond 1
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapperRef.current?.parentElement) {
      ro.observe(wrapperRef.current.parentElement);
    }
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const displayW = Math.round(CANVAS_W * scale);
  const displayH = Math.round(CANVAS_H * scale);

  return (
    /* Outer clip container — exactly the scaled size */
    <div
      ref={wrapperRef}
      id="canvas-clip-container"
      style={{
        width:        `${displayW}px`,
        height:       `${displayH}px`,
        overflow:     'hidden',
        position:     'relative',
        flexShrink:   0,
        borderRadius: '8px',
        border:       '1px solid #000',
        background:   '#000000',
        boxShadow:    '0 0 0 1px #000, 0 8px 48px rgba(0,0,0,1)',
      }}
    >
      {/* Inner 1920×1080 surface — CSS-scaled down for display */}
      <div
        ref={canvasRef}
        id="master-canvas"
        style={{
          width:           `${CANVAS_W}px`,
          height:          `${CANVAS_H}px`,
          transform:       `scale(${scale})`,
          transformOrigin: 'top left',
          position:        'absolute',
          top:             0,
          left:            0,
          background:      '#ffffff',
          overflow:        'hidden',
          fontFamily:      "'Kalam', cursive, sans-serif",
        }}
      >
        {activeScene ? (
          <SceneRenderer
            scene={activeScene}
            currentTime={currentTime}
          />
        ) : (
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              height:         '100%',
              color:          '#94a3b8',
              fontSize:       '38px',
              fontFamily:     "'Kalam', cursive",
              fontWeight:     600,
              textAlign:      'center',
              padding:        '80px',
              lineHeight:     1.5,
            }}
          >
            📋 No scenes loaded.
            <br />
            Edit  client/public/config/scene.html  and refresh.
          </div>
        )}
      </div>
    </div>
  );
}
