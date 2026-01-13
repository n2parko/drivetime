"use client";

import { useState, useRef } from "react";
import { Artifact, ArtifactType } from "@/types/artifact";

interface ArtifactInputProps {
  onArtifactCreated: (artifact: Artifact) => void;
}

const TYPES: { type: ArtifactType; label: string; color: string }[] = [
  { type: "idea", label: "Idea", color: "#eab308" },
  { type: "question", label: "Question", color: "#8b5cf6" },
  { type: "note", label: "Note", color: "#06b6d4" },
];

export function ArtifactInput({ onArtifactCreated }: ArtifactInputProps) {
  const [content, setContent] = useState("");
  const [artifactType, setArtifactType] = useState<ArtifactType>("idea");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Get value from DOM as fallback (for browser automation compatibility)
    const inputValue = inputRef.current?.value || content;
    
    if (isSubmitting || !inputValue.trim()) return;

    setIsSubmitting(true);

    try {
      const isUrl = inputValue.startsWith("http://") || inputValue.startsWith("https://");

      const response = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isUrl ? "article" : artifactType,
          content: inputValue.trim(),
          sourceUrl: isUrl ? inputValue.trim() : undefined,
        }),
      });

      if (response.ok) {
        const artifact = await response.json();
        onArtifactCreated(artifact);
        setContent("");
        if (inputRef.current) inputRef.current.value = "";
      } else {
        console.error("Failed to create artifact");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentType = TYPES.find(t => t.type === artifactType)!;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Type selector - horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TYPES.map(({ type, label, color }) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setArtifactType(type);
              inputRef.current?.focus();
            }}
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95"
            style={{
              background: artifactType === type ? color : 'var(--card)',
              color: artifactType === type ? 'white' : 'var(--muted)',
              border: artifactType === type ? 'none' : '1px solid var(--border)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input with integrated submit */}
      <div 
        className="flex items-center gap-2 p-3 rounded-2xl transition-all"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div 
          className="w-2 h-2 rounded-full flex-shrink-0" 
          style={{ background: currentType.color }}
        />
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="flex-1 bg-transparent border-none outline-none text-base"
          style={{ color: 'var(--fg)' }}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all active:scale-90 disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0-16l-4 4m4-4l4 4" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
