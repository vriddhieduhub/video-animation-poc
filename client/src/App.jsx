import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import RecordRTC from 'recordrtc';

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

  // RecordRTC কে ট্র্যাক করার জন্য একটি রেফ
 const recorderRef = useRef(null);
  const streamRef   = useRef(null);

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
  // const stopPreview = useCallback(() => {
  //   if (rafRef.current) {
  //     cancelAnimationFrame(rafRef.current);
  //     rafRef.current = null;
  //   }
  //   lastTsRef.current = null;
  //   setIsPlaying(false);
  // }, []);


  // ── 🎬 অ্যানিমেশন স্টপ এবং অটো-ডাউনলোড লজিক ──
const stopPreview = useCallback(() => {
    // ১. চলমান অ্যানিমেশন ফ্রেম বন্ধ করুন
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTsRef.current = null;
    setIsPlaying(false);

    // ২. RecordRTC রেকর্ডিং স্টপ এবং অটো-ডাউনলোড লজিক
    if (recorderRef.current) {
      console.log("Stopping recorder and generating video file...");
      
      recorderRef.current.stopRecording(() => {
        const blob = recorderRef.current.getBlob();
        const url = URL.createObjectURL(blob);
        
        // ফাইলটি ব্রাউজারে অটোমেটিক ডাউনলোড করানোর জন্য লিঙ্ক তৈরি
        const a = document.createElement('a');
        a.href = url;
        a.download = `whiteboard-video-${Date.now()}.webm`; // অডিওসহ .webm ফাইল নাম
        a.click();
        
        // রেকর্ডার ও স্ট্রিম ক্লিনআপ (যাতে স্ক্রিন শেয়ারিং আইকন চলে যায়)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        recorderRef.current.destroy();
        recorderRef.current = null;
      });
    }

    if (audioManagerRef.current) {
      audioManagerRef.current.reset();
    }
  }, []);










const startPreview = useCallback(() => {
    if (isExportingRef.current || !scenesRef.current.length) return;

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

      const dur     = totalDurationRef.current;
      const newTime = Math.min(currentTimeRef.current + delta, dur);
      currentTimeRef.current = newTime;
      setCurrentTime(newTime);
      audioManagerRef.current.tick(newTime, scenesRef.current);

      if (newTime < dur) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        // 🎯 ফিক্স: টাইমলাইন শেষ হওয়া মাত্রই সরাসরি stopPreview() কল হবে, 
        // যা অটোমেটিক রেকর্ডার স্টপ করে ডাউনলোড প্রম্পট নিয়ে আসবে।
        stopPreview();
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [stopPreview]); // dependency তে stopPreview অবশ্যই যুক্ত থাকবে


  

  // const handleTogglePlay = useCallback(() => {
  //   if (isPlaying) stopPreview();
  //   else           startPreview();
  // }, [isPlaying, startPreview, stopPreview]);




// ── 🎬 অডিও + ভিডিও একসাথে স্ক্রিন রেকর্ড করার লজিক ──
  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) {
      // যদি অলরেডি চলে, তবে পজ/স্টপ হবে (যা stopPreview-কে কল করবে এবং ডাউনলোড হবে)
      stopPreview();
    } else {
      try {
        // ১. ব্রাউজারের ট্যাব/স্ক্রিন এবং অডিও ক্যাপচার করার প্রম্পট ওপেন হবে
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: 1920,
            height: 1080,
            frameRate: 30
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        streamRef.current = stream;

        // ২. RecordRTC কনফিগারেশন
        recorderRef.current = new RecordRTC(stream, {
          type: 'video',
          mimeType: 'video/webm;codecs=vp9,opus', // হাই-কোয়ালিটি ভিডিও ও অডিওর জন্য
          bitsPerSecond: 12800000 // ঝকঝকে কোয়ালিটির জন্য বিটরেট বাড়িয়ে দেওয়া হলো
        });

        // রেকর্ডিং শুরু
        recorderRef.current.startRecording();

        // ৩. স্ক্রিন শেয়ার পারমিশন পাওয়ার পরেই অ্যানিমেশন প্লেব্যাক স্টার্ট হবে
        startPreview();

        // যদি ইউজার ম্যানুয়ালি ব্রাউজারের "Stop Sharing" বাটনে ক্লিক করে, তবে যেন ডাউনলোড ট্রিগার হয়
        stream.getVideoTracks()[0].onended = () => {
          stopPreview();
        };

      } catch (error) {
        console.error("Recording prompt failed or cancelled:", error);
        alert("Recording start করার জন্য স্ক্রিন/ট্যাব শেয়ার পারমিশন প্রয়োজন।");
      }
    }
  }, [isPlaying, stopPreview, startPreview]);




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
