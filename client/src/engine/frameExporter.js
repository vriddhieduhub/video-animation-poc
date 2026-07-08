// ── 🎯 FULLY FIXED FRAME EXPORTER ENGINE ─────────────────────────────────────
// Deterministic, memory-safe, hardware-streaming frame export engine.
// ─────────────────────────────────────────────────────────────────────────────

import { FPS, CANVAS_W, CANVAS_H } from './constants.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function padNum(n, digits) {
  return String(n).padStart(digits, '0');
}

/**
 * Recursively copy computed styles from a live DOM node into a cloned node.
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
    'flex-direction', 'align-items', 'justify-content', 
    'flex-wrap', 'flex',
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
 */
function domToSvgDataUri(element) {
  // ১. ক্যানভাস ক্লোন করা
  const clone = element.cloneNode(true);

  // ❌ [FIXED] হাত ডিলিট করার কোডটি সম্পূর্ণ রিমুভ করা হলো! 
  // এখন finaHandImg, finalHandImgArt, finalHandGrip সব ইমেজে থেকে যাবে।

  // ২. ইনলাইন স্টাইল অ্যাপ্লাই করা
  inlineComputedStyles(element, clone);

  // ৩. [FIXED] ক্যানভাস এরিয়া ১৯২০x১০৮০ পিক্সেল সাইজে স্ট্রিক্ট লক করা
  clone.style.width = `${CANVAS_W}px`;
  clone.style.height = `${CANVAS_H}px`;
  clone.style.overflow = 'hidden';
  clone.style.position = 'absolute';
  clone.style.top = '0px';
  clone.style.left = '0px';

  // ৪. [FIXED] master.css এর সমস্ত ক্লাস রুলস সরাসরি রিড করে এক্সপোর্টে ইনজেক্ট করা
  const styleSheets = Array.from(document.styleSheets);
  let cssRulesStr = '';
  try {
    styleSheets.forEach(sheet => {
      // master.css অথবা লোকাল স্টাইলশীট থেকে রুলস রিড করা
      if (!sheet.href || sheet.href.includes('master.css') || sheet.href.includes('localhost')) {
        Array.from(sheet.cssRules || []).forEach(rule => {
          cssRulesStr += rule.cssText + '\n';
        });
      }
    });
  } catch (e) {
    console.warn('[FrameExporter] CSS Injection warning:', e.message);
  }

  const serializer = new XMLSerializer();
  const domStr     = serializer.serializeToString(clone);

  // ৫. [FIXED] SVG viewBox লক করা যাতে এক্সপোর্ট এরিয়া পারফেক্ট থাকে
  const svgStr = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">`,
    `<style>${cssRulesStr}</style>`, 
    `<foreignObject width="${CANVAS_W}" height="${CANVAS_H}" x="0" y="0">`,
    domStr,
    `</foreignObject>`,
    `</svg>`,
  ].join('');

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
}

/**
 * Paint a data URI into an offscreen 1920×1080 canvas and return a JPEG blob.
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
      oc.convertToBlob({ type: 'image/jpeg', quality: 0.95 }) // কায়ালিটি সামান্য উন্নত (95%) করা হলো
        .then(resolve)
        .catch(reject);
    };
    img.onerror  = () => reject(new Error('SVG image load failed. If custom images are used, ensure they are served locally with proper CORS headers.'));
    img.src      = dataUri;
  });
}

/**
 * Write a Blob to a named file inside a directory handle.
 */
async function writeBlobToDir(dirHandle, fileName, blob) {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable   = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

// ── Audio Manifest Builder ───────────────────────────────────────────────────

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
  onLog(`  Resolution: ${CANVAS_W}×${CANVAS_H}  JPEG 95%`);
  onLog('─'.repeat(50));

  try {
    await writeAudioManifest(scenes, dirHandle);
    onLog('  ✓ audio_manifest.json written');
  } catch (e) {
    onLog(`  ⚠ Could not write audio manifest: ${e.message}`);
  }

  // [SPEED BOOST] ব্রাউজার যেন দ্রুত রেন্ডার করতে পারে, তাই ব্যাচ সাইজ ৪ থেকে বাড়িয়ে ১৬ করা হলো
  const BATCH_SIZE = 16; 

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
        setCurrentTime(t);

        // React repaints এর জন্য সামান্য বিরতি
        await new Promise((r) => setTimeout(r, 2));

        let dataUri;
        try {
          dataUri = domToSvgDataUri(canvasEl);
        } catch (err) {
          onLog(`  [WARN] Frame ${frameIndex + 1} serialize: ${err.message}`);
          frameIndex++;
          errorCount++;
          continue;
        }

        let blob;
        try {
          blob = await renderToJpegBlob(dataUri);
        } catch (err) {
          onLog(`  [WARN] Frame ${frameIndex + 1} render: ${err.message}`);
          frameIndex++;
          errorCount++;
          continue;
        }

        const fileName = `frame_${padNum(frameIndex + 1, 5)}.jpg`;
        try {
          await writeBlobToDir(dirHandle, fileName, blob);
        } catch (err) {
          onLog(`  [ERROR] Write ${fileName}: ${err.message}`);
          frameIndex++;
          errorCount++;
          continue;
        }

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
        setTimeout(processBatch, 0);
      } else {
        onLog('─'.repeat(50));
        onLog(
          errorCount > 0
            ? `⚠ Done with ${errorCount} error(s). Check log above.`
            : `✅ Export complete — ${totalFrames} frames written.`
        );
        onLog(`  Next: run FFmpeg command to combine frames.`);
        resolve({ framesWritten: frameIndex, errors: errorCount });
      }
    }

    processBatch();
  });
}