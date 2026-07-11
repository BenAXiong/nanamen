"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const play = useCallback((url: string, onEnded?: () => void) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.pause();
    audio.src = url;
    audio.onended = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    setIsPlaying(true);
    audio.play().catch(() => setIsPlaying(false));
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  return { play, stop, isPlaying };
}
