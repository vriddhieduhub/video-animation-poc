import React from 'react';
import { FPS, CANVAS_W, CANVAS_H } from '../engine/constants.js';

/**
 * Bottom panel: FFmpeg command + audio manifest + stats.
 *
 * @param {{
 *   audioFiles:    string[],
 *   totalDuration: number,
 *   exportLog:     string[],
 * }} props
 */
export default function FFmpegPanel({ audioFiles, totalDuration, exportLog }) {
  const totalFrames = Math.ceil(totalDuration * FPS);
  const estMB       = ((totalFrames * 230) / 1024 / 1024).toFixed(1);

  const ffmpegCmd   = buildCommand(audioFiles);

  return (
    <div
      style={{
        background:   '#0d0d1a',
        borderTop:    '1px solid #1e1e3a',
        padding:      '14px 20px',
        display:      'flex',
        flexDirection: 'column',
        gap:          '10px',
        flexShrink:   0,
        maxHeight:    '260px',
        overflowY:    'auto',
      }}
    >
      {/* Export log */}
      {exportLog.length > 0 && (
        <div
          id="export-log"
          style={{
            background: '#060612',
            borderRadius: '6px',
            padding:    '10px 14px',
            fontFamily: "'Cascadia Code', 'Fira Code', monospace",
            fontSize:   '11px',
            color:      '#7ee787',
            maxHeight:  '120px',
            overflowY:  'auto',
            lineHeight: 1.6,
            border:     '1px solid #1e1e3a',
          }}
        >
          {exportLog.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          ['Frames', totalFrames.toLocaleString()],
          ['Duration', `${totalDuration.toFixed(1)}s`],
          ['Est. disk', `~${estMB} MB`],
          ['FPS', FPS],
          ['Resolution', `${CANVAS_W}×${CANVAS_H}`],
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', gap: '5px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {label}
            </span>
            <span style={{ fontSize: '13px', color: '#ccc', fontFamily: 'monospace', fontWeight: 700 }}>
              {val}
            </span>
          </div>
        ))}
      </div>

      {/* FFmpeg command */}
      <div>
        <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '5px' }}>
          🔧 FFmpeg Assembly Command — run inside your export folder
        </div>
        <div
          style={{
            background:  '#060612',
            border:      '1px solid #1e1e3a',
            borderRadius: '6px',
            padding:     '10px 14px',
            fontFamily:  "'Cascadia Code', 'Fira Code', monospace",
            fontSize:    '11px',
            color:       '#e6edf3',
            wordBreak:   'break-all',
            userSelect:  'all',
            lineHeight:  1.7,
            whiteSpace:  'pre-wrap',
          }}
        >
          {ffmpegCmd}
        </div>
      </div>

      {/* Audio manifest */}
      {audioFiles.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
            Audio files referenced ({audioFiles.length}) — copy to export folder before running FFmpeg
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {audioFiles.map((f, i) => (
              <span
                key={i}
                style={{
                  background: '#161630',
                  border:     '1px solid #2a2a4a',
                  borderRadius: '4px',
                  padding:    '2px 8px',
                  fontSize:   '11px',
                  color:      '#79c0ff',
                  fontFamily: 'monospace',
                }}
              >
                {f.replace(/^\/audio\//, '')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function buildCommand(audioFiles) {
  if (audioFiles.length === 0) {
    return `ffmpeg -r ${FPS} -i frame_%05d.jpg \\
  -c:v libx264 -preset slow -crf 18 \\
  -pix_fmt yuv420p \\
  output.mp4`;
  }

  const inputs  = audioFiles.map((f) => `-i "${f.replace(/^\/audio\//, '')}"`).join(' \\\n  ');
  const aMaps   = audioFiles.map((_, i) => `-map ${i + 1}:a`).join(' ');

  return `ffmpeg -r ${FPS} -i frame_%05d.jpg \\
  ${inputs} \\
  -map 0:v ${aMaps} \\
  -c:v libx264 -preset slow -crf 18 \\
  -c:a aac -b:a 192k \\
  -pix_fmt yuv420p \\
  output.mp4`;
}
