// ─────────────────────────────────────────────────────────────────────────────
// AUDIO MANAGER
// Fires HTML5 Audio nodes at their exact timeline cue points.
// Tracks what has already played so no cue fires twice.
// ─────────────────────────────────────────────────────────────────────────────

export class AudioManager {
  constructor() {
    /** @type {Map<string, HTMLAudioElement>} */
    this._nodes  = new Map();
    /** @type {Set<string>} */
    this._played = new Set();
  }

  /**
   * Pre-create Audio nodes for all audio sources in the scene graph.
   * Returns a Promise that resolves with a map of { src → duration }.
   *
   * @param {import('./configParser.js').Scene[]} scenes
   * @returns {Promise<Object.<string, number>>}
   */
  preload(scenes) {
    const promises = [];
    const durations = {};

    scenes.forEach((scene) => {
      scene.elements.forEach((el) => {
        if (!el.audioSrc || this._nodes.has(el.audioSrc)) return;
        const audio = new Audio();
        audio.preload = 'metadata';
        this._nodes.set(el.audioSrc, audio);

        const p = new Promise((resolve) => {
          audio.addEventListener('loadedmetadata', () => {
            durations[el.audioSrc] = audio.duration;
            resolve();
          }, { once: true });
          audio.addEventListener('error', () => {
            // Missing audio file — resolve gracefully with 0
            durations[el.audioSrc] = 0;
            resolve();
          }, { once: true });
          audio.src = el.audioSrc;
        });
        promises.push(p);
      });
    });

    return Promise.all(promises).then(() => durations);
  }

  /** Completely stop all audio and reset all cue tracking. */
  reset() {
    this._nodes.forEach((node) => {
      node.pause();
      node.currentTime = 0;
    });
    this._played.clear();
  }

  /**
   * Called every frame during preview playback.
   * Fires an audio node if currentTime has just passed its cue start.
   *
   * @param {number} currentTime
   * @param {import('./configParser.js').Scene[]} scenes
   */
  tick(currentTime, scenes) {
    let cursor = 0;
    scenes.forEach((scene) => {
      scene.elements.forEach((el) => {
        const cueStart = cursor;
        cursor += el.slotDuration;

        if (!el.audioSrc) return;
        const key = el.audioSrc;
        if (currentTime >= cueStart && !this._played.has(key)) {
          this._played.add(key);
          const node = this._nodes.get(key);
          if (node) {
            node.currentTime = 0;
            node.play().catch(() => { /* autoplay policy — silently ignored */ });
          }
        }
      });
    });
  }

  /**
   * Mark all audio cues before `upToTime` as already played.
   * Used after a seek to prevent re-firing past cues.
   *
   * @param {number} upToTime
   * @param {import('./configParser.js').Scene[]} scenes
   */
  markPlayedUpTo(upToTime, scenes) {
    this._played.clear();
    this.stopAll();
    let cursor = 0;
    scenes.forEach((scene) => {
      scene.elements.forEach((el) => {
        if (el.audioSrc && cursor < upToTime) {
          this._played.add(el.audioSrc);
        }
        cursor += el.slotDuration;
      });
    });
  }

  /** Pause all currently playing nodes without resetting. */
  stopAll() {
    this._nodes.forEach((node) => node.pause());
  }
}
