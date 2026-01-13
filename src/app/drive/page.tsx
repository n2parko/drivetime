"use client";

import { useState, useEffect, useRef } from "react";
import { Artifact } from "@/types/artifact";

const TYPE_COLORS: Record<string, string> = {
  idea: "#eab308",
  question: "#8b5cf6",
  note: "#06b6d4",
  article: "#10b981",
  screenshot: "#ec4899",
};

export default function DrivePage() {
  const [episodes, setEpisodes] = useState<Artifact[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentEpisode = episodes[currentIndex];

  useEffect(() => {
    fetchEpisodes();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.addEventListener("timeupdate", updateProgress);
    return () => audio.removeEventListener("timeupdate", updateProgress);
  }, []);

  const fetchEpisodes = async () => {
    try {
      const response = await fetch("/api/artifacts");
      const data = await response.json();
      const pending = (data.artifacts || []).filter(
        (a: Artifact) => a.status === "ready" || a.status === "pending"
      );
      setEpisodes(pending);
    } catch (error) {
      console.error("Failed to fetch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const playEpisode = async (episode: Artifact) => {
    setIsGenerating(true);

    try {
      await fetch(`/api/artifacts/${episode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing" }),
      });

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId: episode.id, mode: "summary" }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        if (audioRef.current) {
          audioRef.current.src = url;
          await audioRef.current.play();
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error("Failed to play:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (audioRef.current.src) {
      audioRef.current.play();
      setIsPlaying(true);
    } else if (currentEpisode) {
      playEpisode(currentEpisode);
    }
  };

  const handleNext = async () => {
    if (currentEpisode) {
      await fetch(`/api/artifacts/${currentEpisode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
    }

    if (currentIndex < episodes.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.src = "";
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.src = "";
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    handleNext();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center pb-safe" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <h1 className="text-xl font-semibold mb-2">Queue empty</h1>
        <p className="mb-6" style={{ color: 'var(--muted)' }}>Add some ideas first</p>
        <a
          href="/"
          className="px-5 py-2.5 rounded-full text-sm font-medium text-white active:scale-95 transition-transform"
          style={{ background: 'var(--accent)' }}
        >
          Add content
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pt-safe" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <audio ref={audioRef} onEnded={handleEnded} className="hidden" />

      {/* Header */}
      <header className="flex items-center justify-between p-4">
        <a href="/" className="p-2 -m-2 active:scale-90 transition-transform" style={{ color: 'var(--muted)' }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {currentIndex + 1} / {episodes.length}
        </span>
        <div className="w-9" />
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-40">
        {currentEpisode && (
          <div className="text-center max-w-sm">
            {/* Type badge */}
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wide mb-6"
              style={{ background: TYPE_COLORS[currentEpisode.type] + '20', color: TYPE_COLORS[currentEpisode.type] }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_COLORS[currentEpisode.type] }} />
              {currentEpisode.type}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-semibold leading-tight mb-4">
              {currentEpisode.title}
            </h1>

            {/* Summary */}
            {currentEpisode.summary && (
              <p className="leading-relaxed" style={{ color: 'var(--muted)' }}>
                {currentEpisode.summary}
              </p>
            )}
          </div>
        )}
      </main>

      {/* Player controls - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-6 pb-safe" style={{ background: `linear-gradient(transparent, var(--bg) 30%)` }}>
        {/* Progress bar */}
        <div className="h-1 rounded-full mb-6 overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{ width: `${progress}%`, background: 'var(--accent)' }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="p-3 active:scale-90 transition-transform disabled:opacity-30"
            style={{ color: 'var(--muted)' }}
          >
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={handlePlayPause}
            disabled={isGenerating}
            className="w-18 h-18 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-70"
            style={{ background: 'var(--accent)', width: '72px', height: '72px' }}
          >
            {isGenerating ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === episodes.length - 1}
            className="p-3 active:scale-90 transition-transform disabled:opacity-30"
            style={{ color: 'var(--muted)' }}
          >
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
