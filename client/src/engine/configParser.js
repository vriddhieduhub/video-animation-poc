// ─────────────────────────────────────────────────────────────────────────────
// CONFIG PARSER
// Converts a raw HTML/XML config string → a typed scene graph.
// ─────────────────────────────────────────────────────────────────────────────
import { BASE_SEQ_DURATION, TYPING_SPEED, FPS, ANIMATION_CONFIG } from './constants.js';

/**
 * Compute the animation duration (seconds) for one element based on its
 * type and content length — exactly the framesPerCharacter approach from
 * the POC's whiteboard.config.js getAnimationFrames().
 *
 * @param {'heading'|'paragraph'|'underline'|'image'|'eraser'|'divider'} type
 * @param {string} content   - text content (HTML stripped) or image src
 * @param {string} rawClasses
 * @returns {number} seconds
 */
function computeAnimDuration(type, content, rawClasses) {
  const plainLen = content.replace(/<[^>]+>/g, '').length;

  switch (type) {
    case 'heading': {
      const cfg = TYPING_SPEED.heading;
      const frames = Math.max(
        cfg.minDuration * FPS,
        plainLen * cfg.framesPerCharacter,
      );
      return Math.min(frames, cfg.maxDuration * FPS) / FPS;
    }
    case 'paragraph': {
      const cfg = TYPING_SPEED.paragraph;
      const frames = Math.max(
        cfg.minDuration * FPS,
        plainLen * cfg.framesPerCharacter,
      );
      return Math.min(frames, cfg.maxDuration * FPS) / FPS;
    }
    case 'underline': {
      const cfg = TYPING_SPEED.underline;
      // Extract width from w-NNN class
      const wMatch = rawClasses.match(/\bw-(\d+)\b/);
      const widthPx = wMatch ? parseInt(wMatch[1], 10) : 300;
      const frames = Math.max(
        cfg.minDuration * FPS,
        Math.ceil(widthPx / cfg.pxPerFrame),
      );
      return Math.min(frames, cfg.maxDuration * FPS) / FPS;
    }
    case 'table': {
      const cfg = TYPING_SPEED.table;
      const frames = Math.max(
        cfg.minDuration * FPS,
        plainLen * cfg.framesPerCharacter,
      );
      return Math.min(frames, cfg.maxDuration * FPS) / FPS;
    }
    case 'image':
      return TYPING_SPEED.image.fixedDuration;
    case 'eraser':
      return ANIMATION_CONFIG.eraser.speed.totalDurationFrames / FPS;
    default:
      return 0.5; // dividers are near-instant
  }
}

/**
 * @typedef {Object} SceneElement
 * @property {string} seqId
 * @property {'heading'|'paragraph'|'underline'|'image'|'eraser'|'divider'} type
 * @property {string} content      - text content or image src
 * @property {string} rawClasses   - space-separated class string from the tag
 * @property {string} tag          - original HTML tag name
 * @property {string|null} audioSrc - audio src that fires with this element (null if none)
 * @property {number} slotDuration  - actual slot duration (may extend for audio)
 */

/**
 * @typedef {Object} Scene
 * @property {string} sceneId
 * @property {number} sceneIndex
 * @property {SceneElement[]} elements
 * @property {number} startTime    - absolute seconds
 * @property {number} endTime
 * @property {number} duration
 */

/**
 * Parse an HTML/XML config string into a structured scene graph.
 *
 * @param {string} htmlString
 * @returns {{ scenes: Scene[], totalDuration: number }}
 */
export function parseConfig(htmlString) {
  const parser = new DOMParser();

  // Parse as XHTML so self-closing <div /> tags are honoured correctly.
  // 'text/html' ignores /> on non-void elements causing siblings to be
  // swallowed as children of the unclosed tag, breaking element iteration.
  let doc;
  try {
    doc = parser.parseFromString(
      `<root xmlns="http://www.w3.org/1999/xhtml">${htmlString.trim()}</root>`,
      'application/xhtml+xml'
    );
    // If the parser returns a parseerror document, fall back to text/html
    if (doc.querySelector('parsererror')) throw new Error('xhtml parse failed');
  } catch (_) {
    doc = parser.parseFromString(
      `<root>${htmlString.trim()}</root>`,
      'text/html'
    );
  }

  const scenes = [];

  // Works for both xhtml (doc element is <root>) and text/html (<html><body>)
  const sceneDivs = doc.querySelectorAll('[data-sceneid]');

  console.log('[configParser] found', sceneDivs.length, 'scenes');

  sceneDivs.forEach((sceneEl, sceneIndex) => {
    const sceneId = sceneEl.getAttribute('data-sceneid');

    // Build a map: seqId → audio src
    /** @type {Object.<string, string>} */
    const audioForSeq = {};
    sceneEl.querySelectorAll('audio[data-audiotimelineseqid]').forEach((audioEl) => {
      const seqId = audioEl.getAttribute('data-audiotimelineseqid');
      audioForSeq[seqId] = audioEl.getAttribute('src') || '';
    });

    /** @type {SceneElement[]} */
    const elements = [];

    Array.from(sceneEl.children).forEach((child) => {
      // Skip audio tags — they are looked up via audioForSeq
      if (child.tagName.toLowerCase() === 'audio') return;

      const seqId = child.getAttribute('data-timelinesequenceid');
      if (!seqId) return;

      const tag         = child.tagName.toLowerCase();
      const rawClasses  = child.getAttribute('class') || '';
      let type          = 'divider';
      let content       = '';

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        type    = 'heading';
        content = child.innerHTML.trim(); // keep inner markup (spans/highlights)
      } else if (tag === 'p' || tag === 'span') {
        type    = 'paragraph';
        content = child.innerHTML.trim();
      } else if (tag === 'div') {
        if (rawClasses.includes('underline')) {
          type = 'underline';
        } else if (rawClasses.includes('eraser')) {
          type = 'eraser';
        } else {
          type = 'divider';
        }
      } else if (tag === 'img') {
        type    = 'image';
        content = child.getAttribute('src') || '';
      } else if (tag === 'table') {
        type    = 'table';
        content = child.innerHTML.trim(); // keep full thead/tbody/tr/th/td markup
      }

      const animDuration = computeAnimDuration(type, content, rawClasses);
      // slotDuration = max(animDuration + settle time, BASE_SEQ_DURATION)
      // We add 0.5s settle so the element is fully visible before the next one starts.
      const slotDuration = Math.max(animDuration + 0.5, BASE_SEQ_DURATION);

      elements.push({
        seqId,
        type,
        content,
        rawClasses,
        tag,
        audioSrc:     audioForSeq[seqId] || null,
        animDuration,   // how long the draw-in animation runs (seconds)
        slotDuration,   // full slot length incl. settle time (may extend for audio)
        textContent: child.textContent || '',
      });
    });

    console.log(`[configParser] Scene ${sceneId}: ${elements.length} elements ->`, elements.map(e => `[${e.seqId}]${e.type}`).join(', '));
    scenes.push({
      sceneId,
      sceneIndex,
      elements,
      startTime: 0, // filled in below
      endTime:   0,
      duration:  0,
    });
  });

  // Stamp absolute start/end times
  let cursor = 0;
  scenes.forEach((scene) => {
    scene.startTime = cursor;
    const sceneDuration = scene.elements.reduce(
      (sum, el) => sum + el.slotDuration, 0
    );
    scene.duration  = sceneDuration;
    scene.endTime   = cursor + sceneDuration;
    cursor          = scene.endTime;
    console.log(`[configParser] Scene ${scene.sceneId}: startTime=${scene.startTime} endTime=${scene.endTime} duration=${scene.duration}`);
  });

  console.log('[configParser] totalDuration:', cursor);
  return { scenes, totalDuration: cursor };
}

/**
 * After audio elements have been preloaded and their durations are known,
 * update each element's slotDuration to max(BASE_SEQ_DURATION, audioDuration + 0.3).
 * Returns a new scene graph with updated timestamps.
 *
 * @param {Scene[]} scenes
 * @param {Object.<string, number>} audioDurations  key = audioSrc, value = seconds
 * @returns {{ scenes: Scene[], totalDuration: number }}
 */
export function applyAudioDurations(scenes, audioDurations) {
  const updated = scenes.map((scene) => ({
    ...scene,
    elements: scene.elements.map((el) => {
      if (!el.audioSrc) return el;
      const dur = audioDurations[el.audioSrc];
      if (!dur) return el;
      return {
        ...el,
        // Slot must cover both the typed animation AND the full audio clip
        slotDuration: Math.max(el.slotDuration, dur + 0.3),
      };
    }),
  }));

  // Recompute absolute times
  let cursor = 0;
  updated.forEach((scene) => {
    scene.startTime = cursor;
    const sceneDuration = scene.elements.reduce(
      (sum, el) => sum + el.slotDuration, 0
    );
    scene.duration  = sceneDuration;
    scene.endTime   = cursor + sceneDuration;
    cursor          = scene.endTime;
  });

  return { scenes: updated, totalDuration: cursor };
}
