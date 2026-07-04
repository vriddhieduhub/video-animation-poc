import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';

import { parseConfig, applyAudioDurations } from './engine/configParser.js';
import { AudioManager }  from './engine/audioManager.js';
import { runExport }     from './engine/frameExporter.js';

import MasterCanvas      from './components/MasterCanvas.jsx';
import FloatingControls  from './components/FloatingControls.jsx';
import ExportDoneModal   from './components/ExportDoneModal.jsx';

// ── Import master.css ────────────────────────────────────────────────────────
import './styles/master.css';

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {

  // ── Config loading ────────────────────────────────────────────────────────
  // scene.html is loaded at runtime via fetch so users can edit it freely.
  // Falls back to an empty scene on load error.
  const [configHtml,  setConfigHtml]  = useState('');
  const [configReady, setConfigReady] = useState(false);

  useEffect(() => {
    fetch('/config/scene.html')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((html) => {
        setConfigHtml(html);
        setConfigReady(true);
      })
      .catch((err) => {
        console.warn('[App] Could not load /config/scene.html:', err.message);
        setConfigHtml('<div data-sceneid="01"><p data-timelinesequenceid="01" class="absolute top-400 left-200 text-4xl font-kalam text-gray">Add your scene config to client/public/config/scene.html</p></div>');
        setConfigReady(true);
      });
  }, []);

  // ── Scene graph ───────────────────────────────────────────────────────────
  const [parsedData, setParsedData] = useState({ scenes: [], totalDuration: 0 });
  const { scenes, totalDuration }   = parsedData;

  // Refs so the RAF loop always reads the LATEST values — never stale closures
  const scenesRef       = useRef([]);
  const totalDurationRef = useRef(0);
  useEffect(() => { scenesRef.current = scenes; },        [scenes]);
  useEffect(() => { totalDurationRef.current = totalDuration; }, [totalDuration]);

  useEffect(() => {
    if (!configReady || !configHtml) return;
    const data = parseConfig(configHtml);
    console.log('[App] parsed scenes:', data.scenes.map(s =>
      `Scene${s.sceneId} elems=${s.elements.length} start=${s.startTime} end=${s.endTime}`
    ));
    console.log('[App] totalDuration:', data.totalDuration);
    setParsedData(data);
  }, [configHtml, configReady]);

  // ── Playback state ────────────────────────────────────────────────────────
  const [currentTime,    setCurrentTime]    = useState(0);
  const [isPlaying,      setIsPlaying]      = useState(false);

  // ── Export state ──────────────────────────────────────────────────────────
  const [isExporting,    setIsExporting]    = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLog,      setExportLog]      = useState([]);
  // Modal shown on completion
  const [exportResult,   setExportResult]   = useState(null);
  // { folderName, framesWritten }

  // ── Refs ──────────────────────────────────────────────────────────────────
  const rafRef           = useRef(null);
  const lastTsRef        = useRef(null);
  const currentTimeRef   = useRef(0);
  const canvasRef        = useRef(null);
  const audioManagerRef  = useRef(new AudioManager());
  const cancelExportRef  = useRef(false);
  const isExportingRef   = useRef(false);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  // ── Audio preload when scene graph updates ────────────────────────────────
  useEffect(() => {
    if (!scenes.length) return;
    const mgr = audioManagerRef.current;
    mgr.reset();
    mgr.preload(scenes).then((durations) => {
      const anyChanged = scenes.some((s) =>
        s.elements.some((el) => el.audioSrc && durations[el.audioSrc] > 0)
      );
      if (anyChanged) {
        setParsedData(applyAudioDurations(scenes, durations));
      }
    });
  }, [scenes.length]);

  // ── Active scene (derived) ────────────────────────────────────────────────
  const activeScene = useMemo(() => {
    if (!scenes.length) return null;
    const found = scenes.find(
      (s) => currentTime >= s.startTime && currentTime < s.endTime
    );
    if (found) return found;
    if (currentTime >= totalDuration && totalDuration > 0) return scenes[scenes.length - 1];
    return scenes[0];
  }, [scenes, currentTime, totalDuration]);

  // Log scene transitions
  useEffect(() => {
    if (activeScene) {
      console.log(`[App] activeScene=${activeScene.sceneId} at t=${currentTime.toFixed(2)} (start=${activeScene.startTime} end=${activeScene.endTime})`);
    }
  }, [activeScene?.sceneId]);

  // ── Audio file list (for FFmpeg command in modal) ─────────────────────────
  const audioFiles = useMemo(() => {
    const seen = new Set();
    const list = [];
    scenes.forEach((s) =>
      s.elements.forEach((el) => {
        if (el.audioSrc && !seen.has(el.audioSrc)) {
          seen.add(el.audioSrc);
          list.push(el.audioSrc);
        }
      })
    );
    return list;
  }, [scenes]);

  // ─────────────────────────────────────────────────────────────────────────
  // PREVIEW PLAYBACK
  // ─────────────────────────────────────────────────────────────────────────
  const stopPreview = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTsRef.current = null;
    setIsPlaying(false);
  }, []);

  const startPreview = useCallback(() => {
    if (isExportingRef.current || !scenesRef.current.length) return;

    // Use ref values — these are always current even after async audio preload updates
    if (currentTimeRef.current >= totalDurationRef.current) {
      currentTimeRef.current = 0;
      setCurrentTime(0);
      audioManagerRef.current.reset();
    }

    setIsPlaying(true);
    lastTsRef.current = null;

    function frame(ts) {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const delta = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      // Always read totalDuration from ref — never from closure
      const dur     = totalDurationRef.current;
      const newTime = Math.min(currentTimeRef.current + delta, dur);
      currentTimeRef.current = newTime;
      setCurrentTime(newTime);
      audioManagerRef.current.tick(newTime, scenesRef.current);

      if (newTime < dur) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setIsPlaying(false);
        rafRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  // No deps on scenes/totalDuration — reads from refs inside frame()
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) stopPreview();
    else           startPreview();
  }, [isPlaying, startPreview, stopPreview]);

  const handleReset = useCallback(() => {
    stopPreview();
    setCurrentTime(0);
    currentTimeRef.current = 0;
    audioManagerRef.current.reset();
  }, [stopPreview]);

  const handleSeek = useCallback((ratio) => {
    const t = ratio * totalDurationRef.current;
    setCurrentTime(t);
    currentTimeRef.current = t;
    audioManagerRef.current.markPlayedUpTo(t, scenesRef.current);
  }, []);

  // Keyboard shortcuts: Space = play/pause, R = reset, E = export
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); handleTogglePlay(); }
      if (e.code === 'KeyR')  { e.preventDefault(); handleReset(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleTogglePlay, handleReset]);

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────────────
  const appendLog = useCallback((msg) => {
    setExportLog((prev) => [...prev.slice(-400), msg]);
  }, []);

  const handleExport = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('File System Access API not supported.\nUse Chrome 86+ or Edge 86+ on desktop.');
      return;
    }

    stopPreview();

    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      if (e.name === 'AbortError') return;
      appendLog(`[ERROR] ${e.message}`);
      return;
    }

    setIsExporting(true);
    isExportingRef.current = true;
    cancelExportRef.current = false;
    setExportLog([]);
    setExportProgress(0);
    setExportResult(null);

    const canvasEl = canvasRef.current;
    if (!canvasEl) {
      appendLog('[ERROR] Canvas not mounted.');
      setIsExporting(false);
      isExportingRef.current = false;
      return;
    }

    const { framesWritten } = await runExport({
      dirHandle,
      canvasEl,
      totalDuration: totalDurationRef.current,
      scenes:        scenesRef.current,
      setCurrentTime: (t) => {
        currentTimeRef.current = t;
        setCurrentTime(t);
      },
      onProgress: (pct) => setExportProgress(pct),
      onLog:      appendLog,
      cancelRef:  cancelExportRef,
    });

    setIsExporting(false);
    isExportingRef.current = false;
    setExportProgress(0);

    // Reset timeline display
    setCurrentTime(0);
    currentTimeRef.current = 0;

    // Show completion modal only if not cancelled
    if (framesWritten > 0) {
      setExportResult({ folderName: dirHandle.name, framesWritten });
    }
  }, [totalDuration, scenes, stopPreview, appendLog]);

  const handleCancelExport = useCallback(() => {
    cancelExportRef.current = true;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width:    '100vw',
        height:   '100vh',
        background: '#0a0a14',
        overflow: 'hidden',
        display:  'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* ── Full-screen canvas area ── */}
      <MasterCanvas
        activeScene={activeScene}
        currentTime={currentTime}
        canvasRef={canvasRef}
      />

      {/* ── Floating icon controls (bottom-centre over canvas) ── */}
      <FloatingControls
        isPlaying={isPlaying}
        isExporting={isExporting}
        currentTime={currentTime}
        totalDuration={totalDuration}
        exportProgress={exportProgress}
        onTogglePlay={handleTogglePlay}
        onReset={handleReset}
        onExport={handleExport}
        onCancelExport={handleCancelExport}
        onSeek={handleSeek}
      />

      {/* ── Export-done modal (shown after successful export) ── */}
      {exportResult && (
        <ExportDoneModal
          audioFiles={audioFiles}
          totalDuration={totalDuration}
          exportLog={exportLog}
          folderName={exportResult.folderName}
          framesWritten={exportResult.framesWritten}
          onClose={() => setExportResult(null)}
        />
      )}
    </div>
  );
}
