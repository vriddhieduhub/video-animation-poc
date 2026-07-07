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
  // শিরোনাম (Heading) অ্যানিমেশন সেটিংস
  heading: {
    // লেখার গতি (Typing Speed)
    speed: {
      // প্রতি অক্ষরে ফ্রেম সংখ্যা (কত ফ্রেম ধরে একটি অক্ষর লেখা হবে)।
      // এই মান কমালে লেখা দ্রুত হবে, বাড়ালে ধীর হবে।
      framesPerCharacter: 10,
      // সর্বনিম্ন সময়কাল (সেকেন্ডে)। একটি শিরোনামের অ্যানিমেশন অন্তত এই সময় ধরে চলবে।
      minDuration: 2.8,
      // সর্বোচ্চ সময়কাল (সেকেন্ডে)। একটি শিরোনামের অ্যানিমেশন এই সময়ের বেশি চলবে না।
      maxDuration: 10.0,
    },
    // হাতের নড়াচড়া (Hand Movement)
    hand: {
      // হাতের ঢেউয়ের বিস্তার (হাত কতটা উপরে-নিচে নড়বে)।
      waveAmplitude: 9,
      // হাতের ঢেউয়ের ফ্রিকোয়েন্সি (হাত কত দ্রুত উপরে-নিচে নড়বে)।
      waveFrequency: 0.32,
      // হাতের সামান্য এলোমেলো নড়াচড়া (ক্ষুদ্র নয়েজ)।
      microNoise: 0.45,
      // হাতের X-অক্ষের অফসেট (বাম বা ডানে সরাতে)।
      offsetX: -20,
      // হাতের Y-অক্ষের অফসেট অনুপাত (উপরে বা নিচে সরাতে, লেখার উচ্চতার সাপেক্ষে)।
      offsetYRatio: 0.5,
    },
  },

  // অনুচ্ছেদ (Paragraph) অ্যানিমেশন সেটিংস
  paragraph: {
    // লেখার গতি (Typing Speed)
    speed: {
      // প্রতি অক্ষরে ফ্রেম সংখ্যা।
      framesPerCharacter: 6,
      // সর্বনিম্ন সময়কাল (সেকেন্ডে)।
      minDuration: 4.0,
      // সর্বোচ্চ সময়কাল (সেকেন্ডে)।
      maxDuration: 18.0,
    },
    // হাতের নড়াচড়া (Hand Movement)
    hand: {
      // হাতের ঢেউয়ের বিস্তার।
      waveAmplitude: 10,
      // হাতের ঢেউয়ের ফ্রিকোয়েন্সি।
      waveFrequency: 0.38,
      // হাতের সামান্য এলোমেলো নড়াচড়া।
      microNoise: 0.9,
      // হাতের বাঁকানো নড়াচড়ার বিস্তার (অনুচ্ছেদের জন্য বেশি)।
      arcAmplitude: 7,
      // হাতের X-অক্ষের অফসেট।
      offsetX: -30,
      // হাতের Y-অক্ষের অফসেট অনুপাত।
      offsetYRatio: 0.75,
    },
  },

  // আন্ডারলাইন (Underline) অ্যানিমেশন সেটিংস
  underline: {
    // আঁকার গতি (Drawing Speed)
    speed: {
      // প্রতি ফ্রেমে পিক্সেল সংখ্যা (আন্ডারলাইন কত পিক্সেল আঁকা হবে প্রতি ফ্রেমে)।
      pxPerFrame: 5,
      // সর্বনিম্ন সময়কাল (সেকেন্ডে)।
      minDuration: 2.0,
      // সর্বোচ্চ সময়কাল (সেকেন্ডে)।
      maxDuration: 6.0,
    },
    // হাতের নড়াচড়া (Hand Movement)
    hand: {
      // হাতের ঢেউয়ের বিস্তার।
      waveAmplitude: 8,
      // হাতের ঢেউয়ের ফ্রিকোয়েন্সি।
      waveFrequency: 1.0,
      // হাতের সামান্য এলোমেলো নড়াচড়া।
      microNoise: 1.2,
      // হাতের X-অক্ষের অফসেট।
      offsetX: 15,
      // হাতের Y-অক্ষের অফসেট।
      offsetY: -10,
    },
  },

  // ছবি (Image) অ্যানিমেশন সেটিংস
  image: {
    // প্রদর্শনের গতি (Display Speed)
    speed: {
      // ছবির জন্য নির্দিষ্ট সময়কাল (সেকেন্ডে)।
      fixedDuration: 3.8,
    },
    // হাতের নড়াচড়া (Hand Movement)
    hand: {
      // হাতের ঢেউয়ের বিস্তার।
      waveAmplitude: 16,
      // হাতের ঢেউয়ের ফ্রিকোয়েন্সি।
      waveFrequency: 0.8,
      // হাতের সামান্য এলোমেলো নড়াচড়া।
      microNoise: 1.5,
      // হাতের X-অক্ষের অফসেট।
      offsetX: -25,
      // হাতের Y-অক্ষের অফসেট।
      offsetY: 15,
    },
  },

  // ইরেজার (Eraser) অ্যানিমেশন সেটিংস
  eraser: {
    // মোছার গতি (Erasing Speed)
    speed: {
      // ইরেজার অ্যানিমেশনের মোট সময়কাল (ফ্রেমে)। এই মান কমালে মোছা দ্রুত হবে, বাড়ালে ধীর হবে।
      totalDurationFrames: 150,
      // ইরেজারের দৃশ্যমান গতির গুণক। এই মান কমালে ইরেজার ধীরে নড়বে, বাড়ালে দ্রুত নড়বে।
      // এটি মোছার মোট সময়কালকে প্রভাবিত করে না, শুধু মোছার দৃশ্যমান গতিকে প্রভাবিত করে।
      visualSpeedMultiplier: 0.7,
      // হাতের মোছার গতির গুণক (হাত কত দ্রুত মোছার কাজ করবে)।
      handSweepSpeed: 0.7,
      // হাতের মোছার সময় ঢেউয়ের বিস্তার অনুপাত।
      handAmplitudeRatio: 0.5,
    },
    // হাতের নড়াচড়া (Hand Movement)
    hand: {
      // হাতের মোছার ফ্রিকোয়েন্সি (হাত কত দ্রুত ডানে-বামে নড়বে মোছার সময়)।
      scrubFrequency: 0.5,
      // হাতের মোছার বিস্তার (হাত কত পিক্সেল ডানে-বামে নড়বে মোছার সময়)।
      scrubAmplitude: 90,
      // হাতের সামান্য এলোমেলো নড়াচড়া।
      microNoise: 1,
    },
  },
};

export const TYPING_SPEED = {
  heading: ANIMATION_CONFIG.heading.speed,
  paragraph: ANIMATION_CONFIG.paragraph.speed,
  underline: ANIMATION_CONFIG.underline.speed,
  image: ANIMATION_CONFIG.image.speed,
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
