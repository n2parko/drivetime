"use client";

import { useState } from "react";
import { Artifact, DayGroup } from "@/types/artifact";

interface InboxListProps {
  artifacts: Artifact[];
  dayGroups: DayGroup[];
  loading: boolean;
  onRefresh: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  idea: "#eab308",
  question: "#8b5cf6",
  note: "#06b6d4",
  article: "#10b981",
  screenshot: "#ec4899",
};

export function InboxList({ artifacts, loading, onRefresh }: InboxListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/artifacts/${id}`, { method: "DELETE" });
      onRefresh();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div
          className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--muted)' }}>
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <p className="text-sm">Add your first idea above</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {artifacts.map((artifact) => {
        const isExpanded = expandedId === artifact.id;
        return (
          <div
            key={artifact.id}
            onClick={() => setExpandedId(isExpanded ? null : artifact.id)}
            className="rounded-xl p-3 active:scale-[0.99] transition-transform cursor-pointer"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start gap-3">
              {/* Type dot */}
              <div
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: TYPE_COLORS[artifact.type] }}
              />

              <div className="flex-1 min-w-0">
                <p className="font-medium text-[15px] leading-snug" style={{ color: 'var(--fg)' }}>
                  {artifact.title.length > 80 ? artifact.title.slice(0, 80) + "..." : artifact.title}
                </p>


                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    {artifact.summary && (
                      <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--muted)' }}>
                        {artifact.summary}
                      </p>
                    )}

                    {artifact.sourceUrl && (
                      <a
                        href={artifact.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-sm mb-3"
                        style={{ color: 'var(--accent)' }}
                      >
                        Open link
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(artifact.id);
                      }}
                      className="text-xs px-3 py-2 rounded-lg active:scale-95 transition-transform"
                      style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Chevron */}
              <svg
                className={`w-4 h-4 flex-shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                style={{ color: 'var(--muted)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
