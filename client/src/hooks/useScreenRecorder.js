// npm i  recordrtc

import { useRef, useCallback } from 'react';
import RecordRTC from 'recordrtc';

/**
 * useScreenRecorder - Reusable Hook for High-Quality Screen & Audio Recording
 * @param {Object} options
 * @param {Function} options.onStart - Callback triggered when recording successfully starts
 * @param {Function} options.onStop - Callback triggered when recording stops internally
 */
export default function useScreenRecorder({ onStart, onStop } = {}) {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      // ১. স্ক্রিন ও অডিও ক্যাপচার কনফিগারেশন (1080p, 60fps locked)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 },
          displaySurface: "browser"
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2
        },
        selfBrowserSurface: "include"
      });

      streamRef.current = stream;

      // ২. RecordRTC হাই-কোয়ালিটি কম্প্রেশন সেটিংস (50 Mbps Bitrate + VP9)
      recorderRef.current = new RecordRTC(stream, {
        type: 'video',
        mimeType: 'video/webm;codecs=vp9,opus',
        bitsPerSecond: 50000000,
        frameInterval: 16, // ~60fps
        videoBitsPerSecond: 50000000
      });

      recorderRef.current.startRecording();

      // এক্সটার্নাল অ্যানিমেশন প্লেব্যাক স্টার্ট করা
      if (onStart) onStart();

      // ইউজার যদি ব্রাউজারের "Stop Sharing" বাটনে ক্লিক করে
      stream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

    } catch (error) {
      console.error("Recording prompt failed or cancelled:", error);
      alert("Recording start করার জন্য স্ক্রিন/ট্যাব শেয়ার পারমিশন প্রয়োজন।");
    }
  }, [onStart]);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current) return;

    console.log("[Recorder] Stopping recorder and generating video file...");
    
    recorderRef.current.stopRecording(() => {
      const blob = recorderRef.current.getBlob();
      const url = URL.createObjectURL(blob);
      
      // অটোমেটিক ব্রাউজার ডাউনলোড ট্রিগার
      const a = document.createElement('a');
      a.href = url;
      a.download = `whiteboard-video-${Date.now()}.webm`;
      a.click();
      
      // মিডিয়া ট্র্যাক ও রেকর্ডার ক্লিনআপ
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (recorderRef.current) {
        recorderRef.current.destroy();
        recorderRef.current = null;
      }

      // এক্সটার্নাল অ্যানিমেশন স্টপ করা
      if (onStop) onStop();
    });
  }, [onStop]);

  return {
    startRecording,
    stopRecording,
    isRecordingActive: !!streamRef.current
  };
}