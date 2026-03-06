"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ACTIVITIES, LOCATIONS, type Activity } from "@/lib/types";

export default function FreePage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | "">("");
  const [customActivity, setCustomActivity] = useState("");
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [description, setDescription] = useState("");
  const [maxPeople, setMaxPeople] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/verify");
    }
  }, [authLoading, isAuthenticated, router]);

  const resolvedActivity = activity === "Others" ? customActivity : activity;
  const resolvedLocation = location === "Others" ? customLocation : location;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedActivity || !resolvedLocation) {
      setError("Pick an activity and location");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.createPlan({
        activity: resolvedActivity,
        location: resolvedLocation,
        description,
        max_people: maxPeople,
      });
      router.push("/board");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="mx-auto max-w-sm px-4 pt-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-text-primary">I&apos;m Free Now</h1>
        <p className="text-sm text-text-secondary mt-1">
          What do you want to do?
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-3">
            Activity
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ACTIVITIES.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setActivity(a.label)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  activity === a.label
                    ? "border-amber bg-amber/10 text-amber"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                }`}
              >
                <span className="text-xl">{a.emoji}</span>
                <span className="ml-2 text-sm font-medium">{a.label}</span>
              </button>
            ))}
          </div>
          {activity === "Others" && (
            <input
              type="text"
              value={customActivity}
              onChange={(e) => setCustomActivity(e.target.value)}
              placeholder="What do you want to do?"
              maxLength={50}
              className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
              autoFocus
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-3">
            Location
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LOCATIONS.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocation(loc)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  location === loc
                    ? "border-mid-blue bg-mid-blue/15 text-mid-blue-light"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
          {location === "Others" && (
            <input
              type="text"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              placeholder="Where exactly?"
              maxLength={50}
              className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-mid-blue focus:outline-none focus:ring-1 focus:ring-mid-blue transition-colors"
              autoFocus
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="e.g. Late night maggi run, anyone?"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber resize-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Max people: {maxPeople}
          </label>
          <input
            type="range"
            min={2}
            max={30}
            value={maxPeople}
            onChange={(e) => setMaxPeople(Number(e.target.value))}
            className="w-full accent-amber"
          />
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>2</span>
            <span>30</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-error text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || !resolvedActivity || !resolvedLocation}
          className="w-full rounded-xl bg-amber py-3.5 font-semibold text-navy transition-colors hover:bg-amber-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Post Plan (expires in 2h)"}
        </button>
      </form>
    </div>
  );
}
