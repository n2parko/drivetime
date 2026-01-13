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

  return (
    <div className="min-h-screen pb-safe" style={{ background: 'var(--bg)' }}>
      {/* Header - compact for mobile */}
      <header className="sticky top-0 z-10 border-b pt-safe" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="px-4 py-3">
          <span className="font-semibold text-lg" style={{ color: 'var(--fg)' }}>drivetime</span>
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
