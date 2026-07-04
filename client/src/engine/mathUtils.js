// ─────────────────────────────────────────────────────────────────────────────
// PURE MATH HELPERS — no React, no DOM, no side-effects
// ─────────────────────────────────────────────────────────────────────────────

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
}

export function easeInOutQuad(t) {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function easeOutElastic(t) {
  t = clamp(t, 0, 1);
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

/**
 * 0..1 progress of a draw-in animation that starts at seqStartTime.
 * animDuration comes from element.animDuration (computed per-element from
 * character count in configParser) so the typing speed is always proportional
 * to how much text there is.
 *
 * @param {number} currentTime
 * @param {number} seqStartTime
 * @param {number} animDuration  - element.animDuration (seconds)
 */
export function animProgress(currentTime, seqStartTime, animDuration) {
  const elapsed = currentTime - seqStartTime;
  if (elapsed < 0) return 0;
  return clamp(elapsed / animDuration, 0, 1);
}

/**
 * Compute organic hand wobble for the current frame — humanistic model.
 *
 * The model has three layers, all tied to the current character index so
 * the motion is synchronised with the text being typed rather than running
 * on a clock that ignores what's on screen:
 *
 *  1. WRIST BOUNCE  — a small downward press on every character stroke,
 *     releasing upward between strokes.  Amplitude is highest mid-word and
 *     dips at space characters (pen lift / breath).
 *
 *  2. DRIFT WAVE  — a slow compound sine that makes the hand drift slightly
 *     up and down over the course of a line, like a teacher's wrist relaxing.
 *
 *  3. MUSCLE TREMOR  — tiny high-frequency random noise on both axes,
 *     simulating the micro-vibration in a real held pen.
 *
 * @param {number}  frame       - render-frame counter (drives drift wave)
 * @param {object}  physics     - HAND_PHYSICS config
 * @param {boolean} isActive
 * @param {number}  charsToShow - current visible char count (drives bounce)
 * @param {string}  visibleText - the visible text so far (detect word gaps)
 * @returns {{ wobbleX: number, wobbleY: number }}
 */
export function handWobble(frame, physics, isActive, charsToShow = 0, visibleText = '') {
  if (!isActive) return { wobbleX: 0, wobbleY: 0 };

  const {
    waveFrequency,
    waveAmplitude,
    microFrequency,
    microAmplitude,
    jitterAmount,
    bounceAmplitude = 1,
    liftAmount = -1,
    lateralAmount = 1,
  } = physics;

  const charPhase = (charsToShow % 1) * Math.PI * 2;
  const bounce = Math.sin(charPhase) * bounceAmplitude;

  const lastChar = visibleText.length > 0 ? visibleText[visibleText.length - 1] : '';
  const isWordGap = lastChar === ' ' || lastChar === '';
  const liftOffset = isWordGap ? liftAmount : 0;

  const strokePhase = charsToShow % 1;
  const strokeArcX = Math.sin((strokePhase - 0.5) * Math.PI) * lateralAmount;
  const strokeArcY = Math.cos(strokePhase * Math.PI) * (bounceAmplitude * 0.45);

  const wave1 = Math.sin(frame * waveFrequency);
  const wave2 = Math.cos(frame * (waveFrequency * 0.61));
  const driftX = (wave1 * 0.55 + wave2 * 0.45) * (lateralAmount * 0.9);
  const driftY = (wave1 * 0.65 + wave2 * 0.35) * waveAmplitude;
  const microX = Math.cos(frame * (microFrequency * 0.85)) * (microAmplitude * 0.7);
  const microY = Math.sin(frame * microFrequency) * microAmplitude;

  const jitterX = (Math.random() - 0.5) * jitterAmount;
  const jitterY = (Math.random() - 0.5) * jitterAmount;

  return {
    wobbleX: strokeArcX + driftX + microX + jitterX,
    wobbleY: strokeArcY + bounce + liftOffset + driftY + microY + jitterY,
  };
}

/**
 * Compute hand position for a typewriter animation using DOM-measured char
 * positions.
 *
 * FIX 1 — SMOOTH MOVEMENT: we receive the continuous float `charsFloat`
 * (rawProgress * totalChars) rather than Math.floor'd integer so the hand
 * glides smoothly between character positions instead of teleporting.
 *
 * FIX 2 — NIB AT BASELINE: charPos.y is the span's offsetTop (top of the
 * character box).  We want the pen tip to sit at the baseline:
 *   hand_img_top = charTop + fontSize - NIB_FROM_TOP
 *
 * @param {Array<{x,y,width}>} charPositions
 * @param {number}  charsFloat    - continuous float (rawProgress * totalChars)
 * @param {number}  totalChars
 * @param {number}  containerLeft
 * @param {number}  containerTop
 * @param {number}  fontSize
 * @param {number}  frame
 * @param {object}  nibOffset     - from NIB_OFFSET config  { x, [yAbs] }
 * @param {object}  physics
 * @param {string}  visibleText
 * @param {number}  nibYRatio   - NIB_Y_RATIO: fontSize multiplier for Y offset
 */
export function handPositionFromDom(
  charPositions,
  charsFloat,
  totalChars,
  containerLeft,
  containerTop,
  fontSize,
  frame,
  nibOffset,
  physics,
  visibleText = '',
  nibYRatio = 0.55,
) {
  let baseX = 0;
  let baseY = 0;

  if (charPositions.length === totalChars && totalChars > 0) {
    // Use the continuous float for smooth interpolation
    const idxF  = Math.min(charsFloat, totalChars - 1);
    const idx   = Math.floor(idxF);
    const frac  = idxF - idx;                         // 0..1 within this char
    const next  = Math.min(idx + 1, totalChars - 1);
    const c1    = charPositions[idx];
    const c2    = charPositions[next];

    if (c2 && c1 && c2.y > c1.y) {
      // Line wrap — blend smoothly: finish current line then jump
      if (frac < 0.5) {
        baseX = c1.x;
        baseY = c1.y;
      } else {
        baseX = c2.x - (c2.width || 0);
        baseY = c2.y;
      }
    } else if (c1) {
      // Normal: interpolate x smoothly between current and next char
      baseX = c1.x + ((c2 ? c2.x : c1.x) - c1.x) * frac;
      baseY = c1.y;
    }
  }

  const { wobbleX, wobbleY } = handWobble(frame, physics, true, charsFloat, visibleText);

  // hand image top = charTop + fontSize * nibYRatio
  // NIB_Y_RATIO places the hand so the pen tip sits at the text baseline.
  const offsetY = fontSize * nibYRatio;

  return {
    x: containerLeft + baseX + nibOffset.x + wobbleX,
    y: containerTop  + baseY + offsetY      + wobbleY,
  };
}

/**
 * Fallback hand position (used until DOM positions are first measured).
 */
export function handPositionFallback(
  charIndex, containerW, lineH, fontSize,
  containerLeft, containerTop,
  frame, nibOffset, physics,
  visibleText = '',
  nibYRatio = 0.55,
) {
  const avgCharW     = fontSize * 0.55;
  const charsPerLine = Math.max(1, Math.floor(containerW / avgCharW));
  const col          = charIndex % charsPerLine;
  const row          = Math.floor(charIndex / charsPerLine);

  const baseX = col * avgCharW;
  const baseY = row * lineH;

  const { wobbleX, wobbleY } = handWobble(frame, physics, true, charIndex, visibleText);

  const offsetY = fontSize * nibYRatio;

  return {
    x: containerLeft + baseX + nibOffset.x + wobbleX,
    y: containerTop  + baseY + offsetY      + wobbleY,
  };
}

/**
 * Returns the transform for the art-brush hand revealing an image.
 * Sweeps diagonally from top-left to bottom-right at given progress (0..1).
 *
 * @param {number} progress   - 0..1 reveal ratio
 * @param {number} imgW
 * @param {number} imgH
 * @param {number} frame
 * @param {object} physics    - HAND_PHYSICS config
 */
export function handPositionForImageReveal(progress, imgW, imgH, frame, physics) {
  const x = progress * imgW;
  const y = progress * imgH * 0.6;

  const { wobbleX, wobbleY } = handWobble(frame, physics, progress > 0 && progress < 1);

  // Brush angle tilts slightly as it moves
  const rotate = -25 + progress * 10;
  return { x: x + wobbleX, y: y + wobbleY, rotate };
}
