import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';

import { parseConfig, applyAudioDurations } from './engine/configParser.js';
import { AudioManager }  from './engine/audioManager.js';
import MasterCanvas      from './components/MasterCanvas.jsx';

// ── নতুন কাস্টম হুক ইমপোর্ট ──────────────────────────────────────────────────
import useScreenRecorder from './hooks/useScreenRecorder.js';

import './styles/master.css';

export default function App() {
  const [configHtml,  setConfigHtml]  = useState('');
  const [configReady, setConfigReady] = useState(false);

  // Scene html loading...
  useEffect(() => {
    fetch('/config/scene.html')
      .then((r) => (!r.ok ? Promise.reject(r) : r.text()))
      .then((html) => { setConfigHtml(html); setConfigReady(true); })
      .catch(() => {
        setConfigHtml('<div data-sceneid="01"><p class="absolute top-400 left-200 text-4xl">Add scene config</p></div>');
        setConfigReady(true);
      });
  }, []);

  const [parsedData, setParsedData] = useState({ scenes: [], totalDuration: 0 });
  const { scenes, totalDuration }   = parsedData;

  const scenesRef       = useRef([]);
  const totalDurationRef = useRef(0);

  useEffect(() => { 
    scenesRef.current = scenes; 
  },[scenes]);

  useEffect(() => { 
    totalDurationRef.current = totalDuration; 
  }, [totalDuration]);

  useEffect(() => {
    if (!configReady || !configHtml) return;
    setParsedData(parseConfig(configHtml));
  }, [configHtml, configReady]);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);

  const rafRef           = useRef(null);
  const lastTsRef        = useRef(null);
  const currentTimeRef   = useRef(0);
  const canvasRef        = useRef(null);
  const audioManagerRef  = useRef(new AudioManager());

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  // Audio preloader...
  useEffect(() => {
    if (!scenes.length) return;
    const mgr = audioManagerRef.current;
    mgr.reset();
    mgr.preload(scenes).then((durations) => {
      if (scenes.some((s) => s.elements.some((el) => el.audioSrc && durations[el.audioSrc] > 0))) {
        setParsedData(applyAudioDurations(scenes, durations));
      }
    });
  }, [scenes.length]);

  const activeScene = useMemo(() => {
    if (!scenes.length) return null;
    return scenes.find((s) => currentTime >= s.startTime && currentTime < s.endTime) || scenes[0];
  }, [scenes, currentTime]);

  // ─────────────────────────────────────────────────────────────────────────
  // PREVIEW CONTROL ARCHITECTURE
  // ─────────────────────────────────────────────────────────────────────────
  
  // ১. পিওর অ্যানিমেশন স্টপ লজিক
  const stopPreview = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTsRef.current = null;
    setIsPlaying(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => console.log("Error exiting fullscreen:", err));
    }

    if (audioManagerRef.current) {
      audioManagerRef.current.reset();
    }
  }, []);


  // ২. পিওর অ্যানিমেশন স্টার্ট লজিক
  const startPreview = useCallback(() => {
    if (!scenesRef.current.length) return;

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
        // টাইমলাইন শেষ হলে স্বয়ংক্রিয়ভাবে রেকর্ডিং স্টপ
        handleTogglePlay();
      }
    }
    rafRef.current = requestAnimationFrame(frame);
  }, []);


  // ── ৩. কানেক্টিং লেয়ার: রেকর্ডিং হুক ইনিশিয়েলাইজেশন ────────────────────────
  const { startRecording, stopRecording } = useScreenRecorder({
    onStart: startPreview,
    onStop: stopPreview
  });


  // প্লে/পজ বাটন হ্যান্ডলার
const handleTogglePlay = useCallback(async () => {
    if (isPlaying) {
      stopRecording();
    } else {
      try {
        // 🎯 ফিক্স: রেকর্ড শুরু করার আগেই পুরো ক্যানভাস কন্টেইনারকে ব্রাউজারে ফুলস্ক্রিন করা হচ্ছে
        const containerEl = document.querySelector('#canvas-clip-container');
        if (containerEl && typeof containerEl.requestFullscreen === 'function') {
          await containerEl.requestFullscreen();
          // ফুলস্ক্রিন রেন্ডার হওয়ার জন্য সামান্য ১০ মিলিজেকেন্ড বিরতি
          await new Promise((r) => setTimeout(r, 10)); 
        }

        // রেকর্ডার স্টার্ট
        await startRecording();

      } catch (error) {
        console.error("Recording initialization failed:", error);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    }
  }, [isPlaying, startRecording, stopRecording]);


  // স্পেসবার লিসেনার (শুধু প্লে/পজ এর জন্য)
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') { 
        e.preventDefault(); 
        handleTogglePlay(); 
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleTogglePlay]);



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

      {/* ── ছোট্ট পুচকি প্লে/পজ বাটন (CSS ক্লাস দিয়ে) ── */}
      <button
        onClick={handleTogglePlay}
        className={`mini-control-btn ${isPlaying ? 'recording' : 'ready'}`}
        title={isPlaying ? 'Pause (Space)' : 'Play & Record (Space)'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
    </div>
  );
}