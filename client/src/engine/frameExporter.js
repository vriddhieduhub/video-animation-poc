// ─────────────────────────────────────────────────────────────────────────────
// FRAME EXPORTER
// Deterministic, memory-safe, hardware-streaming frame export engine.
//
// Strategy
// ────────
//  • Caller sets React state for each frame via setCurrentTime().
//  • We yield 2ms after each setState to let React repaint.
//  • We serialize the live DOM of the master canvas element using
//    XMLSerializer → SVG foreignObject → data URI → OffscreenCanvas → JPEG blob.
//  • Each blob is immediately streamed to disk via the File System Access API.
//  • Blob is released from scope immediately after write → GC-eligible.
//  • RAM stays flat regardless of total frame count.
//
// Audio synchronization manifest
// ───────────────────────────────
//  • buildAudioManifest() returns a JSON file describing every audio cue
//    (filename + offset in seconds) so the user can cross-check with FFmpeg.
// ─────────────────────────────────────────────────────────────────────────────

import { FPS, CANVAS_W, CANVAS_H } from './constants.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function padNum(n, digits) {
  return String(n).padStart(digits, '0');
}

/**
 * Recursively copy computed styles from a live DOM node into a cloned node.
 * We copy a focused property set rather than the entire 300+ property CSSStyleDeclaration
 * to keep the SVG payload small and avoid browser quirks.
 *
 * @param {Element} source
 * @param {Element} target
 */
function inlineComputedStyles(source, target) {
  if (source.nodeType !== 1) return;

  const computed = window.getComputedStyle(source);
  const PROPS = [
    'display', 'position', 'top', 'left', 'right', 'bottom',
    'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-radius', 'border-color', 'border-style', 'border-width',
    'background', 'background-color', 'background-image',
    'color', 'opacity',
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
    'line-height', 'letter-spacing', 'text-align', 'text-decoration',
    'white-space', 'word-break', 'overflow-wrap',
    'transform', 'transform-origin',
    'flex-direction', 'align-items', 'justify-content', 'flex-wrap', 'flex',
    'overflow', 'z-index', 'box-sizing',
    'clip-path', 'object-fit',
    'vertical-align',
  ];

  let styleStr = '';
  PROPS.forEach((p) => {
    const val = computed.getPropertyValue(p);
    if (val && val !== 'initial' && val !== '') {
      styleStr += `${p}:${val};`;
    }
  });

  // Append inline style on top so position overrides win
  target.setAttribute('style', styleStr + (target.getAttribute('style') || ''));

  const srcChildren = source.children;
  const tgtChildren = target.children;
  for (let i = 0; i < srcChildren.length; i++) {
    if (tgtChildren[i]) {
      inlineComputedStyles(srcChildren[i], tgtChildren[i]);
    }
  }
}

/**
 * Serialize the live 1920×1080 canvas DOM element to a data URI
 * via SVG foreignObject.
 *
 * @param {HTMLElement} element - the #master-canvas div
 * @returns {string} data URI
 */
function domToSvgDataUri(element) {
  const clone = element.cloneNode(true);

  // Remove hand cursor images during export (they are part of animation state
  // that may be mid-frame; cleaner to exclude from frames where rawProgress=1)
  clone.querySelectorAll('img[alt=""]').forEach((img) => {
    if (
      img.src.includes('finaHandImg') ||
      img.src.includes('finalHandImgArt') ||
      img.src.includes('finalHandGrip')
    ) {
      img.remove();
    }
  });

  inlineComputedStyles(element, clone);

  const serializer = new XMLSerializer();
  const domStr     = serializer.serializeToString(clone);

  const svgStr = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}">`,
    `<foreignObject width="100%" height="100%">`,
    domStr,
    `</foreignObject>`,
    `</svg>`,
  ].join('');

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
}

/**
 * Paint a data URI into an offscreen 1920×1080 canvas and return a JPEG blob.
 *
 * @param {string} dataUri
 * @returns {Promise<Blob>}
 */
function renderToJpegBlob(dataUri) {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    img.onload   = () => {
      const oc  = new OffscreenCanvas(CANVAS_W, CANVAS_H);
      const ctx = oc.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
      oc.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
        .then(resolve)
        .catch(reject);
    };
    img.onerror  = () => reject(new Error('SVG image load failed'));
    img.src      = dataUri;
  });
}

/**
 * Write a Blob to a named file inside a directory handle.
 *
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string}                   fileName
 * @param {Blob}                     blob
 */
async function writeBlobToDir(dirHandle, fileName, blob) {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable   = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  // writable and blob fall out of scope here → GC-eligible
}

// ── Audio Manifest Builder ───────────────────────────────────────────────────

/**
 * Build a JSON manifest of all audio cues with their absolute timestamps.
 * Writes audio_manifest.json to the export directory.
 *
 * Format:
 * {
 *   "fps": 60,
 *   "cues": [
 *     { "frame": 120, "timeSeconds": 2.0, "src": "/audio/scene_01_seq_01.mp3" },
 *     ...
 *   ]
 * }
 *
 * @param {import('./configParser.js').Scene[]} scenes
 * @param {FileSystemDirectoryHandle}           dirHandle
 */
export async function writeAudioManifest(scenes, dirHandle) {
  const cues = [];
  let cursor = 0;

  scenes.forEach((scene) => {
    scene.elements.forEach((el) => {
      if (el.audioSrc) {
        cues.push({
          frame:       Math.round(cursor * FPS),
          timeSeconds: parseFloat(cursor.toFixed(4)),
          src:         el.audioSrc,
          sceneId:     scene.sceneId,
          seqId:       el.seqId,
        });
      }
      cursor += el.slotDuration;
    });
  });

  const manifest = JSON.stringify({ fps: FPS, cues }, null, 2);
  const blob     = new Blob([manifest], { type: 'application/json' });
  await writeBlobToDir(dirHandle, 'audio_manifest.json', blob);
}

// ── Main Export Loop ─────────────────────────────────────────────────────────

/**
 * Run the deterministic frame export loop.
 *
 * @param {{
 *   dirHandle:       FileSystemDirectoryHandle,
 *   canvasEl:        HTMLElement,
 *   totalDuration:   number,
 *   scenes:          import('./configParser.js').Scene[],
 *   setCurrentTime:  (t: number) => void,
 *   onProgress:      (pct: number, frame: number, total: number) => void,
 *   onLog:           (msg: string) => void,
 *   cancelRef:       React.MutableRefObject<boolean>,
 * }} options
 *
 * @returns {Promise<{ framesWritten: number, errors: number }>}
 */
export async function runExport({
  dirHandle,
  canvasEl,
  totalDuration,
  scenes,
  setCurrentTime,
  onProgress,
  onLog,
  cancelRef,
}) {
  const totalFrames = Math.ceil(totalDuration * FPS);
  let frameIndex    = 0;
  let errorCount    = 0;

  onLog(`▶ Export started — ${totalFrames} frames @ ${FPS}fps`);
  onLog(`  Output: ${dirHandle.name}/`);
  onLog(`  Resolution: ${CANVAS_W}×${CANVAS_H}  JPEG 92%`);
  onLog('─'.repeat(50));

  // Write audio manifest up-front
  try {
    await writeAudioManifest(scenes, dirHandle);
    onLog('  ✓ audio_manifest.json written');
  } catch (e) {
    onLog(`  ⚠ Could not write audio manifest: ${e.message}`);
  }

  // Yield to browser every BATCH_SIZE frames to keep UI responsive
  const BATCH_SIZE = 4;

  return new Promise((resolve) => {
    async function processBatch() {
      const batchEnd = Math.min(frameIndex + BATCH_SIZE, totalFrames);

      while (frameIndex < batchEnd) {
        if (cancelRef.current) {
          onLog('⛔ Export cancelled.');
          resolve({ framesWritten: frameIndex, errors: errorCount });
          return;
        }

        const t = frameIndex / FPS;

        // 1. Force deterministic time
        setCurrentTime(t);

        // 2. Yield so React repaints
        await new Promise((r) => setTimeout(r, 2));

        // 3. Serialize DOM → SVG data URI
        let dataUri;
        try {
          dataUri = domToSvgDataUri(canvasEl);
        } catch (err) {
          onLog(`  [WARN] Frame ${frameIndex + 1} serialize: ${err.message}`);
          frameIndex++;
          errorCount++;
          continue;
        }

        // 4. Render to JPEG blob
        let blob;
        try {
          blob = await renderToJpegBlob(dataUri);
        } catch (err) {
          onLog(`  [WARN] Frame ${frameIndex + 1} render: ${err.message}`);
          frameIndex++;
          errorCount++;
          continue;
        }

        // 5. Write to disk
        const fileName = `frame_${padNum(frameIndex + 1, 5)}.jpg`;
        try {
          await writeBlobToDir(dirHandle, fileName, blob);
        } catch (err) {
          onLog(`  [ERROR] Write ${fileName}: ${err.message}`);
          frameIndex++;
          errorCount++;
          continue;
        }

        // 6. Progress update every 60 frames
        const pct = Math.round(((frameIndex + 1) / totalFrames) * 100);
        onProgress(pct, frameIndex + 1, totalFrames);
        if ((frameIndex + 1) % 60 === 0 || frameIndex === totalFrames - 1) {
          onLog(
            `  [${padNum(frameIndex + 1, 5)}/${totalFrames}]` +
            `  t=${t.toFixed(2)}s  ${pct}%`
          );
        }

        frameIndex++;
      }

      if (frameIndex < totalFrames) {
        // Schedule next batch
        setTimeout(processBatch, 0);
      } else {
        // Done
        onLog('─'.repeat(50));
        onLog(
          errorCount > 0
            ? `⚠ Done with ${errorCount} error(s). Check log above.`
            : `✅ Export complete — ${totalFrames} frames written.`
        );
        onLog(`  Next: run FFmpeg command shown below.`);
        resolve({ framesWritten: frameIndex, errors: errorCount });
      }
    }

    processBatch();
  });
}
