"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ACTIVITIES, LOCATIONS, type Activity } from "@/lib/types";

const DURATIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hr", minutes: 60 },
  { label: "1.5 hr", minutes: 90 },
  { label: "2 hr", minutes: 120 },
  { label: "3 hr", minutes: 180 },
  { label: "4 hr", minutes: 240 },
];

function todayIST() {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    .toISOString()
    .split("T")[0];
}

function nowTimeIST() {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = String(ist.getHours()).padStart(2, "0");
  const m = String(ist.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatTimeDisplay(time24: string) {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export default function FreePage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | "">("");
  const [customActivity, setCustomActivity] = useState("");
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [description, setDescription] = useState("");
  const [maxPeople, setMaxPeople] = useState(10);
  const [planDate, setPlanDate] = useState(todayIST());
  const [startTime, setStartTime] = useState(nowTimeIST());
  const [duration, setDuration] = useState(60);
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

    const startISO = `${planDate}T${startTime}:00+05:30`;
    const startDate = new Date(startISO);
    const endDate = new Date(startDate.getTime() + duration * 60000);

    setSubmitting(true);
    setError("");
    try {
      await api.createPlan({
        activity: resolvedActivity,
        location: resolvedLocation,
        description,
        max_people: maxPeople,
        plan_date: planDate,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
      });
      router.push("/board");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setSubmitting(false);
    }
  };

  const endMs = new Date(`${planDate}T${startTime}:00+05:30`).getTime() + duration * 60000;
  const endDate = new Date(endMs);
  const endIST = new Date(endDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const endH = String(endIST.getHours()).padStart(2, "0");
  const endM = String(endIST.getMinutes()).padStart(2, "0");
  const endDisplay = formatTimeDisplay(`${endH}:${endM}`);

  if (authLoading) return null;

  return (
    <div className="mx-auto max-w-sm px-4 pt-8 pb-24">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Create a plan</h1>
        <p className="text-sm text-text-secondary mt-1">
          Others will see this and can join you
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-3">
            What do you want to do?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ACTIVITIES.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setActivity(a.label)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  activity === a.label
                    ? "border-amber bg-amber/10 text-amber"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover active:scale-95"
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
              placeholder="Type your activity"
              maxLength={50}
              className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
              autoFocus
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-3">
            Where?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LOCATIONS.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocation(loc)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  location === loc
                    ? "border-mid-blue bg-mid-blue/15 text-mid-blue-light"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover active:scale-95"
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
              placeholder="Type location"
              maxLength={50}
              className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-mid-blue focus:outline-none focus:ring-1 focus:ring-mid-blue transition-colors"
              autoFocus
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Date
            </label>
            <input
              type="date"
              value={planDate}
              min={todayIST()}
              onChange={(e) => setPlanDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Start time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            How long?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.minutes}
                type="button"
                onClick={() => setDuration(d.minutes)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  duration === d.minutes
                    ? "border-amber bg-amber/10 text-amber"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover active:scale-95"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-2">
            {formatTimeDisplay(startTime)} - {endDisplay} IST
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Short note (optional)
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
          className="w-full rounded-xl bg-amber py-3.5 font-semibold text-navy transition-all hover:bg-amber-dark active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Posting..." : "Post plan"}
        </button>
      </form>
    </div>
  );
}
