import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { animProgress, clamp } from '../engine/mathUtils.js';
import { ANIMATION_CONFIG, HAND_WRITE_IMG, HAND_SIZE } from '../engine/constants.js';
import { fontSizeFromClass } from '../components/SceneRenderer.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// TABLE RENDERER
// Draws an empty grid first (clip-path reveal) then writes the table cell by
// cell — header row, then each body row left-to-right — with the writing hand
// riding the pen tip, exactly like a teacher filling a table on a whiteboard.
//
// The whole table layout is mounted from frame 0 (cells only toggle opacity),
// so DOM character positions are stable and the hand can be measured precisely.
// ─────────────────────────────────────────────────────────────────────────────

const tableConfig = ANIMATION_CONFIG.table;

/** Parse an inline `style="a:b;c:d"` string → React style object (camelCased). */
function styleStringToObject(str) {
  const out = {};
  if (!str) return out;
  str.split(';').forEach((decl) => {
    const idx = decl.indexOf(':');
    if (idx === -1) return;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (!prop || !value) return;
    const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = value;
  });
  return out;
}

/**
 * Flatten a cell's DOM content into a flat list of write "units" — one per
 * character and one per image — carrying the inherited classes/styles so
 * nested <strong>/<span class="text-red"> etc. render correctly.
 */
function flattenCellUnits(cellEl) {
  const units = [];
  const walk = (node, inherited) => {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const value of node.textContent) {
        units.push({ type: 'char', value, className: inherited.className, style: inherited.style });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();
    if (tag === 'img') {
      units.push({
        type: 'image',
        src: node.getAttribute('src') || '',
        width: node.getAttribute('width') || '',
        style: { ...inherited.style, ...styleStringToObject(node.getAttribute('style')) },
      });
      return;
    }

    const className = [inherited.className, node.getAttribute('class')].filter(Boolean).join(' ');
    const style = { ...inherited.style, ...styleStringToObject(node.getAttribute('style')) };
    if (tag === 'strong' || tag === 'b') style.fontWeight = 700;
    if (tag === 'i' || tag === 'em') style.fontStyle = 'italic';
    if (tag === 'u') style.textDecoration = 'underline';

    node.childNodes.forEach((child) => walk(child, { className, style }));
  };
  cellEl.childNodes.forEach((child) => walk(child, { className: '', style: {} }));
  return units;
}

/** Parse the table innerHTML → ordered rows of cells (document order = write order). */
function parseTableModel(html) {
  const template = document.createElement('template');
  // Wrap in <table> so table-section elements survive HTML fragment parsing.
  template.innerHTML = `<table>${html}</table>`;
  const table = template.content.querySelector('table');
  if (!table) return { rows: [], cells: [] };

  const rows = [];
  const cells = [];
  table.querySelectorAll('tr').forEach((tr) => {
    const isHeader = (tr.parentElement?.tagName || '').toLowerCase() === 'thead';
    const rowCells = [];
    Array.from(tr.children).forEach((cellEl) => {
      const tag = cellEl.tagName.toLowerCase();
      if (tag !== 'td' && tag !== 'th') return;
      const cell = {
        tag,
        isHeader: isHeader || tag === 'th',
        className: cellEl.getAttribute('class') || '',
        style: styleStringToObject(cellEl.getAttribute('style')),
        units: flattenCellUnits(cellEl),
        cellIndex: cells.length,
      };
      rowCells.push(cell);
      cells.push(cell);
    });
    rows.push({ isHeader, className: tr.getAttribute('class') || '', cells: rowCells });
  });

  return { rows, cells };
}

/** Build the diagonal clip-path that reveals the empty grid (0..1 → full box). */
function gridClipPath(t) {
  if (t >= 1) return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
  const p = t * 100;
  if (p <= 50) return `polygon(0% 0%, ${p * 2}% 0%, 0% ${p * 2}%)`;
  const q = (p - 50) * 2;
  return `polygon(0% 0%, 100% 0%, 100% ${q}%, ${q}% 100%, 0% 100%)`;
}

export default function TableRenderer({ element, seqStartTime, currentTime, layout }) {
  const { top, left, width, fontFamily } = layout;
  const frame = Math.round(currentTime * 60);
  const containerRef = useRef(null);
  // cellPositions[cellIndex] = [{ x, y, width, height }] measured relative to the cell.
  const [cellPositions, setCellPositions] = useState([]);

  const model = useMemo(() => parseTableModel(element.content), [element.content]);
  const { rows, cells } = model;

  // Per-cell write window (fraction of the writing phase), weighted by unit count.
  const windows = useMemo(() => {
    const counts = cells.map((c) => Math.max(c.units.length, 1));
    const total = counts.reduce((s, n) => s + n, 0) || 1;
    let acc = 0;
    return counts.map((n) => {
      const start = acc / total;
      acc += n;
      return [start, acc / total];
    });
  }, [cells]);

  // Measure every cell's char/image offsets once the layout is stable.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const cellEls = containerRef.current.querySelectorAll('[data-cell-index]');
    const measured = [];
    let flatCount = 0;
    cellEls.forEach((cellEl) => {
      const idx = parseInt(cellEl.getAttribute('data-cell-index'), 10);
      const spans = cellEl.querySelectorAll('.live-char');
      const positions = [];
      spans.forEach((span) => {
        positions.push({
          x: span.offsetLeft + span.offsetWidth,
          y: span.offsetTop,
          width: span.offsetWidth,
          height: span.offsetHeight,
        });
      });
      measured[idx] = positions;
      flatCount += positions.length;
    });

    const prevCount = cellPositions.reduce((s, p) => s + (p ? p.length : 0), 0);
    if (flatCount > 0 && flatCount !== prevCount) {
      setCellPositions(measured);
    }
  }, [model, frame, cellPositions]);

  const progress = animProgress(currentTime, seqStartTime, element.animDuration);
  if (progress <= 0) return null;

  const gridRatio = tableConfig.speed.gridDrawRatio;
  const gridProgress = clamp(progress / gridRatio, 0, 1);
  const writeProgress = clamp((progress - gridRatio) / (1 - gridRatio), 0, 1);

  // Which cell is being written right now (drives the hand).
  let activeCellIndex = -1;
  for (let i = 0; i < windows.length; i += 1) {
    const [s, e] = windows[i];
    if (writeProgress >= s && writeProgress < e) { activeCellIndex = i; break; }
  }

  // Hand position for the active cell (relative to that cell / <td>).
  let hand = null;
  if (activeCellIndex !== -1) {
    const [s, e] = windows[activeCellIndex];
    const cell = cells[activeCellIndex];
    const total = Math.max(cell.units.length, 1);
    const local = clamp((writeProgress - s) / (e - s || 1), 0, 1);
    const floatIdx = local * total;
    const idx = Math.min(Math.floor(floatIdx), total - 1);
    const remainder = floatIdx - idx;
    const positions = cellPositions[activeCellIndex] || [];
    const fontSize = fontSizeFromClass(cell.className, 45);

    let baseX = 0;
    let baseY = 0;
    if (positions.length > 0) {
      const c1 = positions[Math.min(idx, positions.length - 1)];
      const c2 = positions[Math.min(idx + 1, positions.length - 1)];
      if (c1 && c2 && c2.y > c1.y) {
        baseX = remainder < 0.5 ? c1.x : c2.x - c2.width;
        baseY = remainder < 0.5 ? c1.y : c2.y;
      } else if (c1) {
        baseX = c1.x + ((c2 ? c2.x : c1.x) - c1.x) * remainder;
        baseY = c1.y;
      }
    }

    const cfg = tableConfig.hand;
    const wave = (Math.sin(frame * cfg.waveFrequency) * 0.6 + Math.cos(frame * cfg.waveFrequency * 0.55) * 0.4) * cfg.waveAmplitude;
    const arc = Math.sin(remainder * Math.PI) * cfg.arcAmplitude;
    hand = {
      cellIndex: activeCellIndex,
      x: baseX + cfg.offsetX + arc,
      y: baseY + fontSize * cfg.offsetYRatio + wave,
    };
  }

  const renderUnits = (cell) => {
    const [s, e] = windows[cell.cellIndex];
    const total = Math.max(cell.units.length, 1);
    let charsToShow;
    if (writeProgress >= e) charsToShow = cell.units.length;
    else if (writeProgress <= s) charsToShow = 0;
    else charsToShow = Math.ceil(((writeProgress - s) / (e - s)) * total);

    return cell.units.map((unit, idx) => {
      const opacity = idx < charsToShow ? 1 : 0;
      if (unit.type === 'image') {
        const src = unit.src.startsWith('/') ? unit.src : `/${unit.src}`;
        const w = unit.width || '60px';
        return (
          <span
            key={`u-${idx}`}
            className="live-char"
            style={{ display: 'inline-block', width: w, marginRight: '10px', verticalAlign: 'middle', opacity }}
          >
            <img src={src} alt="" style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }} />
          </span>
        );
      }
      return (
        <span
          key={`u-${idx}`}
          className={`live-char ${unit.className}`.trim()}
          style={{ ...unit.style, display: 'inline', whiteSpace: 'pre-wrap', opacity }}
        >
          {unit.value}
        </span>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        zIndex: 10,
        clipPath: gridClipPath(gridProgress),
        willChange: 'clip-path',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '3px solid #000',
          tableLayout: 'fixed',
          fontFamily: fontFamily || "'Kalam', cursive",
        }}
      >
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={`r-${rIdx}`} className={row.className}>
              {row.cells.map((cell) => {
                const Tag = cell.tag === 'th' ? 'th' : 'td';
                const isActive = hand && hand.cellIndex === cell.cellIndex;
                return (
                  <Tag
                    key={`c-${cell.cellIndex}`}
                    data-cell-index={cell.cellIndex}
                    className={cell.className}
                    style={{
                      position: 'relative',
                      border: '2px solid #000',
                      padding: cell.isHeader ? '22px 20px' : '26px 20px',
                      textAlign: 'left',
                      verticalAlign: 'top',
                      overflow: 'hidden',
                      fontFamily: fontFamily || "'Kalam', cursive",
                      ...cell.style,
                    }}
                  >
                    {renderUnits(cell)}
                    {isActive && (
                      <img
                        src={HAND_WRITE_IMG}
                        alt=""
                        style={{
                          position: 'absolute',
                          left: `${hand.x}px`,
                          top: `${hand.y}px`,
                          width: `${HAND_SIZE}px`,
                          height: 'auto',
                          zIndex: 100,
                          pointerEvents: 'none',
                          filter: 'drop-shadow(1px 2px 3px rgba(0,0,0,0.18))',
                        }}
                      />
                    )}
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
