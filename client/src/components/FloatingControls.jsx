import React from 'react';
import { clamp } from '../engine/mathUtils.js';

/**
 * FloatingControls — a translucent icon-button strip that floats over the
 * canvas in the bottom-right corner. Takes almost zero screen real-estate.
 *
 * Layout:
 *   [⏮] [▶/⏸] [📁] | seek bar | 00:00.00/00:00.00
 *
 * During export, the seek bar turns amber and shows % progress.
 * All buttons are icon-only with tooltips. Hover reveals a backdrop.
 */
export default function FloatingControls({
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
  const pct = totalDuration > 0
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
        position:     'absolute',
        bottom:       '8px',
        right:        '10px',
        zIndex:       500,
        display:      'flex',
        alignItems:   'center',
        gap:          '4px',
        background:   'rgba(8, 8, 20, 0.54)',
        backdropFilter: 'blur(10px)',
        border:       '1px solid rgba(255,255,255,0.07)',
        borderRadius: '22px',
        padding:      '4px 8px',
        userSelect:   'none',
        boxShadow:    '0 3px 14px rgba(0,0,0,0.34)',
        opacity:      0.72,
        transition:   'opacity 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.82')}
    >
      {/* ── Reset ── */}
      <IconBtn
        onClick={onReset}
        disabled={isExporting}
        title="Reset to frame 0  (R)"
        color="#6366f1"
      >
        ⏮
      </IconBtn>

      {/* ── Play / Pause ── */}
      <IconBtn
        onClick={onTogglePlay}
        disabled={isExporting}
        title={isPlaying ? 'Pause  (Space)' : 'Play Preview  (Space)'}
        color={isPlaying ? '#ef4444' : '#22c55e'}
        large
      >
        {isPlaying ? '⏸' : '▶'}
      </IconBtn>

      {/* ── Seek bar ── */}
      <div
        onClick={handleSeekClick}
        title="Seek — click anywhere"
        style={{
          width:        '100px',
          height:       '3px',
          background:   'rgba(255,255,255,0.15)',
          borderRadius: '2px',
          cursor:       'pointer',
          overflow:     'hidden',
          position:     'relative',
          flexShrink:   0,
        }}
      >
        <div
          style={{
            height:     '100%',
            width:      `${isExporting ? exportProgress : pct}%`,
            background: isExporting ? '#f59e0b' : '#3b82f6',
            borderRadius: '2px',
            transition: 'none',
          }}
        />
      </div>

      {/* ── Time readout ── */}
      <span
        style={{
          fontSize:   '9px',
          color:      isExporting ? '#f59e0b' : 'rgba(255,255,255,0.55)',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          minWidth:   '74px',
          textAlign:  'center',
          letterSpacing: '0.3px',
        }}
      >
        {isExporting
          ? `${exportProgress}%`
          : `${fmt(currentTime)} / ${fmt(totalDuration)}`}
      </span>

      {/* ── Divider ── */}
      <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.1)' }} />

      {/* ── Export / Cancel ── */}
      {isExporting ? (
        <IconBtn
          onClick={onCancelExport}
          title="Cancel export"
          color="#ef4444"
        >
          ✕
        </IconBtn>
      ) : (
        <IconBtn
          onClick={onExport}
          disabled={isPlaying}
          title="Select folder & export frames  (E)"
          color="#f59e0b"
        >
          📁
        </IconBtn>
      )}
    </div>
  );
}

// ── Reusable icon button ──────────────────────────────────────────────────────
function IconBtn({ children, onClick, disabled, title, color, large }) {
  const size = large ? 26 : 22;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width:        `${size}px`,
        height:       `${size}px`,
        background:   disabled ? 'rgba(255,255,255,0.05)' : `${color}22`,
        border:       `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : color + '55'}`,
        borderRadius: '50%',
        color:        disabled ? 'rgba(255,255,255,0.2)' : color,
        fontSize:     large ? '12px' : '10px',
        lineHeight:   1,
        cursor:       disabled ? 'not-allowed' : 'pointer',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        padding:      0,
        flexShrink:   0,
        transition:   'background 0.15s, transform 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = `${color}44`;
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = `${color}22`;
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.9)';
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {children}
    </button>
  );
}

function fmt(s) {
  const m  = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${pad(m)}:${pad(ss)}.${pad(cs)}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
