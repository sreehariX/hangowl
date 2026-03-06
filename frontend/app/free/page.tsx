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

function getISTNow() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist;
}

function todayIST() {
  const ist = getISTNow();
  return ist.toISOString().split("T")[0];
}

function currentHourIST() {
  const ist = getISTNow();
  return ist.getUTCHours();
}

function currentMinuteIST() {
  const ist = getISTNow();
  return ist.getUTCMinutes();
}

function to12Hour(h: number) {
  if (h === 0) return 12;
  if (h > 12) return h - 12;
  return h;
}

function formatAmPm(h: number) {
  return h < 12 ? "AM" : "PM";
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
  const [hour, setHour] = useState(currentHourIST());
  const [minute, setMinute] = useState(Math.ceil(currentMinuteIST() / 5) * 5 % 60);
  const [ampm, setAmpm] = useState<"AM" | "PM">(formatAmPm(currentHourIST()) as "AM" | "PM");
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

  const displayHour = to12Hour(hour);

  const handleHourChange = (val: string) => {
    let h = parseInt(val, 10);
    if (isNaN(h)) return;
    if (h > 12) h = 12;
    if (h < 1) h = 1;

    if (ampm === "AM") {
      setHour(h === 12 ? 0 : h);
    } else {
      setHour(h === 12 ? 12 : h + 12);
    }
  };

  const handleMinuteChange = (val: string) => {
    let m = parseInt(val, 10);
    if (isNaN(m)) return;
    if (m > 59) m = 59;
    if (m < 0) m = 0;
    setMinute(m);
  };

  const toggleAmPm = () => {
    if (ampm === "AM") {
      setAmpm("PM");
      setHour((h) => (h < 12 ? h + 12 : h));
    } else {
      setAmpm("AM");
      setHour((h) => (h >= 12 ? h - 12 : h));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedActivity || !resolvedLocation) {
      setError("Pick an activity and location");
      return;
    }

    const startISO = `${planDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`;
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

  const endPreviewMs = new Date(`${planDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`).getTime() + duration * 60000;
  const endPreviewIST = new Date(endPreviewMs + 5.5 * 60 * 60 * 1000);
  const endH = endPreviewIST.getUTCHours();
  const endM = endPreviewIST.getUTCMinutes();
  const endDisplay = `${to12Hour(endH)}:${String(endM).padStart(2, "0")} ${formatAmPm(endH)} IST`;

  if (authLoading) return null;

  return (
    <div className="mx-auto max-w-sm px-4 pt-8 pb-24">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-text-primary">I&apos;m free</h1>
        <p className="text-sm text-text-secondary mt-1">
          Pick what you want to do and when. Others can join.
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
                className={`rounded-xl border p-3 text-left transition-all ${
                  activity === a.label
                    ? "border-amber bg-amber/10 text-amber scale-[1.02]"
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
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  location === loc
                    ? "border-mid-blue bg-mid-blue/15 text-mid-blue-light scale-[1.02]"
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
              placeholder="Where exactly?"
              maxLength={50}
              className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-mid-blue focus:outline-none focus:ring-1 focus:ring-mid-blue transition-colors"
              autoFocus
            />
          )}
        </div>

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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5">
              <input
                type="number"
                min={1}
                max={12}
                value={displayHour}
                onChange={(e) => handleHourChange(e.target.value)}
                className="w-10 bg-transparent text-center text-lg font-bold text-text-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-lg font-bold text-text-muted">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={String(minute).padStart(2, "0")}
                onChange={(e) => handleMinuteChange(e.target.value)}
                className="w-10 bg-transparent text-center text-lg font-bold text-text-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <button
              type="button"
              onClick={toggleAmPm}
              className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold text-amber transition-colors hover:bg-surface-hover active:scale-95"
            >
              {ampm}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Duration
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.minutes}
                type="button"
                onClick={() => setDuration(d.minutes)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  duration === d.minutes
                    ? "border-amber bg-amber/10 text-amber scale-[1.02]"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover active:scale-95"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-2">
            Ends at {endDisplay} IST
          </p>
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
          className="w-full rounded-xl bg-amber py-3.5 font-semibold text-navy transition-all hover:bg-amber-dark active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Posting..." : "Post plan"}
        </button>
      </form>
    </div>
  );
}
