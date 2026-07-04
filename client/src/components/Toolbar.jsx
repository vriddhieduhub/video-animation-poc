import React from 'react';
import { FPS } from '../engine/constants.js';
import { clamp } from '../engine/mathUtils.js';

/**
 * Thin toolbar strip: Play/Pause, Reset, Export, seek bar.
 * Kept minimal — the canvas takes the rest of the screen.
 *
 * @param {{
 *   isPlaying:        boolean,
 *   isExporting:      boolean,
 *   currentTime:      number,
 *   totalDuration:    number,
 *   exportProgress:   number,
 *   onTogglePlay:     () => void,
 *   onReset:          () => void,
 *   onExport:         () => void,
 *   onCancelExport:   () => void,
 *   onSeek:           (ratio: number) => void,
 * }} props
 */
export default function Toolbar({
  isPlaying,
  isExporting,
  currentTime,
  totalDuration,
  exportProgress,
  onTogglePlay,
  onReset,
  onExport,
  onCancelExport,
  onSeek,
}) {
  const progressPct = totalDuration > 0
    ? clamp((currentTime / totalDuration) * 100, 0, 100)
    : 0;

  function handleSeekClick(e) {
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    onSeek(ratio);
  }

  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '10px',
        padding:        '8px 14px',
        background:     '#161622',
        borderBottom:   '1px solid #2a2a4a',
        flexShrink:     0,
        flexWrap:       'wrap',
        userSelect:     'none',
        position:       'relative',
        zIndex:         50,
      }}
    >
      {/* Brand */}
      <span
        style={{
          fontSize:    '13px',
          fontWeight:  800,
          color:       '#e0e0ff',
          letterSpacing: '-0.3px',
          marginRight: '4px',
          fontFamily:  "'Quicksand', sans-serif",
          whiteSpace:  'nowrap',
        }}
      >
        🎬 Whiteboard Engine
      </span>

      <div style={{ width: '1px', height: '22px', background: '#2a2a4a' }} />

      {/* Play / Pause */}
      <button
        onClick={onTogglePlay}
        disabled={isExporting}
        style={btnStyle(isPlaying ? '#ef4444' : '#22c55e', isExporting)}
        title={isPlaying ? 'Pause (Space)' : 'Play Preview (Space)'}
      >
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        disabled={isExporting}
        style={btnStyle('#6366f1', isExporting)}
        title="Reset to frame 0"
      >
        ⏮
      </button>

      {/* Seek bar + time */}
      <div
        style={{
          flex:     '1 1 200px',
          minWidth: '100px',
          display:  'flex',
          alignItems: 'center',
          gap:      '8px',
        }}
      >
        <div
          onClick={handleSeekClick}
          style={{
            flex:       1,
            height:     '8px',
            background: '#2a2a4a',
            borderRadius: '4px',
            cursor:     'pointer',
            overflow:   'hidden',
            position:   'relative',
          }}
          title="Click to seek"
        >
          <div
            style={{
              height:     '100%',
              width:      `${progressPct}%`,
              background: isExporting ? '#f59e0b' : '#3b82f6',
              borderRadius: '4px',
              transition: 'none',
            }}
          />
        </div>
        <span
          style={{
            fontSize:   '11px',
            color:      '#888',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
          }}
        >
          {fmt(currentTime)} / {fmt(totalDuration)}
        </span>
      </div>

      <div style={{ width: '1px', height: '22px', background: '#2a2a4a' }} />

      {/* Export button or progress */}
      {isExporting ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width:      '90px',
              height:     '8px',
              background: '#2a2a4a',
              borderRadius: '4px',
              overflow:   'hidden',
            }}
          >
            <div
              style={{
                height:     '100%',
                width:      `${exportProgress}%`,
                background: '#f59e0b',
                borderRadius: '4px',
                transition: 'none',
              }}
            />
          </div>
          <span style={{ fontSize: '11px', color: '#f59e0b', fontFamily: 'monospace' }}>
            {exportProgress}%
          </span>
          <button
            onClick={onCancelExport}
            style={btnStyle('#ef4444', false)}
          >
            ⛔ Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={onExport}
          disabled={isPlaying}
          style={{
            ...btnStyle('#f59e0b', isPlaying),
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
          title="Select output folder and export all frames to disk"
        >
          📁 Select Folder &amp; Export
        </button>
      )}
    </div>
  );
}

function btnStyle(color, disabled) {
  return {
    background:    disabled ? '#333' : color,
    color:         disabled ? '#666' : '#fff',
    border:        'none',
    borderRadius:  '5px',
    padding:       '6px 14px',
    fontSize:      '12px',
    fontWeight:    600,
    cursor:        disabled ? 'not-allowed' : 'pointer',
    fontFamily:    "'Quicksand', sans-serif",
    letterSpacing: '0.2px',
    whiteSpace:    'nowrap',
  };
}

function fmt(seconds) {
  const m  = Math.floor(seconds / 60);
  const s  = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${pad(m)}:${pad(s)}.${pad(cs)}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}
