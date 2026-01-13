"use client";

import { useState, useEffect } from "react";
import { ArtifactInput } from "@/components/ArtifactInput";
import { InboxList } from "@/components/InboxList";
import { Artifact, DayGroup } from "@/types/artifact";

export default function Home() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArtifacts = async () => {
    try {
      const response = await fetch("/api/artifacts");
      const data = await response.json();
      setArtifacts(data.artifacts || []);
      setDayGroups(data.dayGroups || []);
    } catch (error) {
      console.error("Failed to fetch artifacts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtifacts();
  }, []);

  const handleArtifactCreated = () => {
    fetchArtifacts();
  };

  const playableCount = artifacts.filter((a) => a.status === "ready" || a.status === "pending").length;

  return (
    <div className="min-h-screen pb-safe" style={{ background: 'var(--bg)' }}>
      {/* Header - compact for mobile */}
      <header className="sticky top-0 z-10 border-b pt-safe" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-lg" style={{ color: 'var(--fg)' }}>drivetime</span>

          <a
            href="/drive"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full font-medium text-sm text-white active:scale-95 transition-transform"
            style={{ background: playableCount > 0 ? 'var(--accent)' : 'var(--muted)' }}
          >
            {playableCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                {playableCount}
              </span>
            )}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </a>
        </div>
      </header>

      <main className="px-4 py-5">
        {/* Input Section */}
        <section className="mb-6">
          <ArtifactInput onArtifactCreated={handleArtifactCreated} />
        </section>

        {/* Inbox Section */}
        <section>
          {artifacts.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Today
              </h2>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                {artifacts.length}
              </span>
            </div>
          )}
          <InboxList
            artifacts={artifacts}
            dayGroups={dayGroups}
            loading={loading}
            onRefresh={fetchArtifacts}
          />
        </section>
      </main>
    </div>
  );
}
