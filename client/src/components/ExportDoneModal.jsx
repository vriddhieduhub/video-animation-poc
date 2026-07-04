import React, { useState } from 'react';
import { FPS, CANVAS_W, CANVAS_H } from '../engine/constants.js';

/**
 * ExportDoneModal — shown as a centred popup when export finishes.
 * Displays:
 *   • Summary stats (frames written, duration, folder)
 *   • FFmpeg command (click-to-copy, selectable)
 *   • Audio file manifest
 *
 * @param {{
 *   audioFiles:    string[],
 *   totalDuration: number,
 *   exportLog:     string[],
 *   folderName:    string,
 *   framesWritten: number,
 *   onClose:       () => void,
 * }} props
 */
export default function ExportDoneModal({
  audioFiles,
  totalDuration,
  exportLog,
  folderName,
  framesWritten,
  onClose,
}) {
  const [copied, setCopied] = useState(false);
  const totalFrames = Math.ceil(totalDuration * FPS);
  const estMB       = ((totalFrames * 230) / 1024 / 1024).toFixed(1);
  const ffmpegCmd   = buildCommand(audioFiles, FPS);

  function copyCommand() {
    navigator.clipboard.writeText(ffmpegCmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position:  'fixed',
        inset:     0,
        background: 'rgba(0,0,0,0.72)',
        display:   'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex:    1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Modal panel — stop click propagation so clicking inside doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:   '#0f0f1e',
          border:       '1px solid #2a2a4a',
          borderRadius: '12px',
          padding:      '28px 32px',
          width:        'min(640px, 92vw)',
          maxHeight:    '85vh',
          overflowY:    'auto',
          display:      'flex',
          flexDirection: 'column',
          gap:          '18px',
          boxShadow:    '0 16px 64px rgba(0,0,0,0.7)',
          color:        '#e0e0e0',
          fontFamily:   "'Quicksand', sans-serif",
          position:     'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          title="Close"
          style={{
            position:     'absolute',
            top:          '14px',
            right:        '16px',
            background:   'transparent',
            border:       'none',
            color:        '#666',
            fontSize:     '18px',
            cursor:       'pointer',
            lineHeight:   1,
            padding:      '4px 8px',
            borderRadius: '4px',
          }}
        >
          ✕
        </button>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>✅</span>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>
              Export Complete
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              {framesWritten.toLocaleString()} frames written to &nbsp;
              <code style={{ color: '#79c0ff' }}>{folderName}/</code>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap:                 '10px',
          }}
        >
          {[
            ['Total Frames', totalFrames.toLocaleString()],
            ['Duration',     `${totalDuration.toFixed(1)}s`],
            ['Est. Size',    `~${estMB} MB`],
            ['Frame Rate',   `${FPS} fps`],
          ].map(([label, val]) => (
            <div
              key={label}
              style={{
                background:   '#161630',
                borderRadius: '6px',
                padding:      '8px 12px',
                textAlign:    'center',
              }}
            >
              <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>
                {label}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace' }}>
                {val}
              </div>
            </div>
          ))}
        </div>

        {/* FFmpeg command */}
        <div>
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              marginBottom:   '6px',
            }}
          >
            <span style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              🔧 FFmpeg command — run inside your export folder
            </span>
            <button
              onClick={copyCommand}
              style={{
                background:   copied ? '#22c55e22' : '#3b82f622',
                border:       `1px solid ${copied ? '#22c55e55' : '#3b82f655'}`,
                color:        copied ? '#22c55e' : '#3b82f6',
                borderRadius: '4px',
                padding:      '3px 10px',
                fontSize:     '11px',
                cursor:       'pointer',
                fontFamily:   "'Quicksand', sans-serif",
                fontWeight:   600,
              }}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <div
            style={{
              background:  '#060612',
              border:      '1px solid #1e1e3a',
              borderRadius: '6px',
              padding:     '12px 14px',
              fontFamily:  "'Cascadia Code', 'Fira Code', monospace",
              fontSize:    '11px',
              color:       '#e6edf3',
              userSelect:  'all',
              lineHeight:  1.8,
              whiteSpace:  'pre-wrap',
              wordBreak:   'break-all',
            }}
            onClick={copyCommand}
            title="Click to copy"
          >
            {ffmpegCmd}
          </div>
        </div>

        {/* Audio files to copy */}
        {audioFiles.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
              📂 Audio files — copy to export folder first ({audioFiles.length} files)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {audioFiles.map((f, i) => (
                <span
                  key={i}
                  style={{
                    background:   '#161630',
                    border:       '1px solid #2a2a4a',
                    borderRadius: '4px',
                    padding:      '3px 9px',
                    fontSize:     '11px',
                    color:        '#79c0ff',
                    fontFamily:   'monospace',
                  }}
                >
                  {f.replace(/^\/audio\//, '')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Export log (collapsed by default via scrollable box) */}
        {exportLog.length > 0 && (
          <details>
            <summary
              style={{
                cursor:    'pointer',
                fontSize:  '11px',
                color:     '#555',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                userSelect: 'none',
                outline:   'none',
              }}
            >
              Export Log ({exportLog.length} lines)
            </summary>
            <div
              style={{
                background:   '#060612',
                borderRadius: '6px',
                padding:      '10px 14px',
                fontFamily:   "'Cascadia Code', monospace",
                fontSize:     '10px',
                color:        '#7ee787',
                maxHeight:    '160px',
                overflowY:    'auto',
                lineHeight:   1.6,
                marginTop:    '6px',
                border:       '1px solid #1e1e3a',
              }}
            >
              {exportLog.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </details>
        )}

        {/* Close button (bottom) */}
        <button
          onClick={onClose}
          style={{
            background:   '#3b82f6',
            border:       'none',
            borderRadius: '6px',
            padding:      '10px',
            color:        '#fff',
            fontSize:     '13px',
            fontWeight:   700,
            cursor:       'pointer',
            fontFamily:   "'Quicksand', sans-serif",
            marginTop:    '4px',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function buildCommand(audioFiles, fps) {
  const pads = (n) => String(n).padStart(5, '0');
  const totalFrames = '...';

  if (audioFiles.length === 0) {
    return `ffmpeg -r ${fps} -i frame_%05d.jpg \\
  -c:v libx264 -preset slow -crf 18 \\
  -pix_fmt yuv420p \\
  output.mp4`;
  }

  const inputs = audioFiles
    .map((f) => `-i "${f.replace(/^\/audio\//, '')}"`)
    .join(' \\\n  ');
  const aMaps = audioFiles
    .map((_, i) => `-map ${i + 1}:a`)
    .join(' ');

  return `ffmpeg -r ${fps} -i frame_%05d.jpg \\
  ${inputs} \\
  -map 0:v ${aMaps} \\
  -c:v libx264 -preset slow -crf 18 \\
  -c:a aac -b:a 192k \\
  -pix_fmt yuv420p \\
  output.mp4`;
}
