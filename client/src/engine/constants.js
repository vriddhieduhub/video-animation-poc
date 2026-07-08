// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL ENGINE CONSTANTS
// All timing, resolution and frame-rate values live here.
// ─────────────────────────────────────────────────────────────────────────────

export const FPS      = 60;
export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

// Minimum slot length (seconds) — every element gets at least this much time
// even if its animation finishes faster (gives the viewer a moment to read).
export const BASE_SEQ_DURATION = 3.0;

// ─────────────────────────────────────────────────────────────────────────────
// অ্যানিমেশন কনফিগ এক জায়গায় রাখা হলো যাতে speed, wave, noise আলাদা আলাদা
// renderer ঘেঁটে খুঁজতে না হয়।
// ─────────────────────────────────────────────────────────────────────────────
export const ANIMATION_CONFIG = {
  heading: {
    speed: {
      framesPerCharacter: 10,
      minDuration: 2.8,
      maxDuration: 10.0,
    },
    hand: {
      waveAmplitude: 9,
      waveFrequency: 0.32,
      microNoise: 0.45,
      offsetX: -20,
      offsetYRatio: 0.5,
    },
  },
  paragraph: {
    speed: {
      framesPerCharacter: 6,
      minDuration: 4.0,
      maxDuration: 18.0,
    },
    hand: {
      // paragraph e haat jeno straight line e na jay, tai ekhane wave/arc beshi rakha holo
      waveAmplitude: 10,
      waveFrequency: 0.38,
      microNoise: 0.9,
      arcAmplitude: 7,
      offsetX: -30,
      offsetYRatio: 0.75,
    },
  },
  underline: {
    speed: {
      pxPerFrame: 5,
      minDuration: 2.0,
      maxDuration: 6.0,
    },
    hand: {
      waveAmplitude: 8,
      waveFrequency: 1.2,
      microNoise: 1.2,
      offsetX: 15,
      offsetY: -10,
    },
  },
  image: {
    speed: {
      fixedDuration: 3.8,
    },
    hand: {
      waveAmplitude: 16,
      waveFrequency: 0.8,
      microNoise: 1.5,
      offsetX: -25,
      offsetY: 15,
    },
  },
  table: {
    speed: {
      framesPerCharacter: 4,
      minDuration: 5.0,
      maxDuration: 32.0,
      // Fraction of the total animation spent drawing the empty grid/borders
      // before any cell content starts being written.
      gridDrawRatio: 0.12,
    },
    hand: {
      waveAmplitude: 8,
      waveFrequency: 0.34,
      microNoise: 0.6,
      arcAmplitude: 6,
      offsetX: -45,
      offsetYRatio: 0.55,
    },
  },
  eraser: {
    speed: {
      durationInFrames: 90,
      speedMultiplier: 0.6,
      handSweepSpeed: 0.7,
      handAmplitudeRatio: 0.5,
    },
    hand: {
      scrubFrequency: 1.6,
      scrubAmplitude: 220,
      microNoise: 3,
    },
  },
};

export const TYPING_SPEED = {
  heading: ANIMATION_CONFIG.heading.speed,
  paragraph: ANIMATION_CONFIG.paragraph.speed,
  underline: ANIMATION_CONFIG.underline.speed,
  image: ANIMATION_CONFIG.image.speed,
  table: ANIMATION_CONFIG.table.speed,
};

// পুরোনো renderer/math utils compatibility রাখার জন্য এই object রাখা হয়েছে।
export const HAND_PHYSICS = {
  waveFrequency: 0.09,
  waveAmplitude: 4.2,
  microFrequency: 0.2,
  microAmplitude: 1.4,
  jitterAmount: 0.3,
  bounceAmplitude: 1.6,
  liftAmount: -1.2,
  lateralAmount: 1.6,
};

// ─────────────────────────────────────────────────────────────────────────────
// HAND IMAGE PATHS — served from client/public/assets/images/hand/
// ─────────────────────────────────────────────────────────────────────────────
export const HAND_WRITE_IMG  = '/assets/images/hand/finaHandImg.png';
export const HAND_ART_IMG    = '/assets/images/hand/finalHandImgArt.png';
export const HAND_GRIP_IMG   = '/assets/images/hand/finalHandGrip.png';
export const HAND_ERASER_IMG = '/assets/images/hand/finalHandEraser.png';

// হাতের asset size.
export const HAND_SIZE = 180;

// পুরোনো code path compatibility.
export const NIB_Y_RATIO = 0.5;

// nib / hand placement er base offset ekhane centralize kora holo.
export const NIB_OFFSET = {
  heading:   { x: ANIMATION_CONFIG.heading.hand.offsetX, y: 8 },
  paragraph: { x: ANIMATION_CONFIG.paragraph.hand.offsetX, y: 10 },
  underline: { x: ANIMATION_CONFIG.underline.hand.offsetX, y: ANIMATION_CONFIG.underline.hand.offsetY },
};
