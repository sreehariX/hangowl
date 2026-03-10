"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { PlanCard } from "@/components/PlanCard";
import { PlanListSkeleton } from "@/components/Skeleton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ACTIVITIES, LOCATIONS, ACTIVITY_EMOJI, type Activity, type Plan } from "@/lib/types";

const TABS = ["Browse", "Create", "My Plans"];

const DURATIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hr", minutes: 60 },
  { label: "1.5 hr", minutes: 90 },
  { label: "2 hr", minutes: 120 },
  { label: "3 hr", minutes: 180 },
  { label: "4 hr", minutes: 240 },
];

function getISTParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

function todayIST() {
  const { year, month, day } = getISTParts();
  return `${year}-${month}-${day}`;
}

function nowTimeIST() {
  const { hour, minute } = getISTParts();
  return `${hour}:${minute}`;
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

function formatTimeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+05:30");
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
}

function PastPlanCard({ plan }: { plan: Plan }) {
  const emoji = ACTIVITY_EMOJI[plan.activity] || "?";
  const memberCount = plan.plan_members?.[0]?.count ?? 0;
  return (
    <Link
      href={`/plan/${plan.id}`}
      className="block rounded-xl border border-border bg-surface/50 p-3 transition-colors hover:bg-surface-hover"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{plan.activity}</p>
          <p className="text-xs text-text-muted truncate">
            {plan.location} &middot; {formatDateShort(plan.plan_date)} &middot; {formatTimeIST(plan.starts_at)}
          </p>
        </div>
        <span className="text-xs text-text-muted">{memberCount} joined</span>
      </div>
    </Link>
  );
}

export default function HangoutsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState(0);

  // Browse state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [filterActivity, setFilterActivity] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");

  // Create state
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
  const [createError, setCreateError] = useState("");

  // My Plans state
  const [livePlans, setLivePlans] = useState<Plan[]>([]);
  const [pastPlans, setPastPlans] = useState<Plan[]>([]);
  const [loadingMyPlans, setLoadingMyPlans] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/verify");
  }, [authLoading, isAuthenticated, router]);

  const fetchPlans = useCallback(async () => {
    try {
      const params: { location?: string; activity?: string } = {};
      if (filterActivity !== "all") params.activity = filterActivity;
      if (filterLocation !== "all") params.location = filterLocation;
      const data = await api.getPlans(params);
      setPlans(data.plans);
    } catch { /* silent */ }
    finally { setLoadingPlans(false); }
  }, [filterActivity, filterLocation]);

  const fetchMyPlans = useCallback(async () => {
    try {
      const data = await api.getMyPlans();
      setLivePlans(data.live);
      setPastPlans(data.past);
    } catch { /* silent */ }
    finally { setLoadingMyPlans(false); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchPlans();
    const interval = setInterval(fetchPlans, 15000);
    return () => clearInterval(interval);
  }, [fetchPlans, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const channel = supabase
      .channel("hangouts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => fetchPlans())
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_members" }, () => fetchPlans())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPlans, isAuthenticated]);

  useEffect(() => {
    if (tab === 2 && isAuthenticated) {
      setLoadingMyPlans(true);
      fetchMyPlans();
    }
  }, [tab, isAuthenticated, fetchMyPlans]);

  const resolvedActivity = activity === "Others" ? customActivity : activity;
  const resolvedLocation = location === "Others" ? customLocation : location;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedActivity || !resolvedLocation || !description.trim()) {
      setCreateError("Pick an activity, location, and add a description");
      return;
    }
    const startISO = `${planDate}T${startTime}:00+05:30`;
    const startDate = new Date(startISO);
    const endDate = new Date(startDate.getTime() + duration * 60000);
    setSubmitting(true);
    setCreateError("");
    try {
      await api.createPlan({
        activity: resolvedActivity,
        location: resolvedLocation,
        description: description.trim(),
        max_people: maxPeople,
        plan_date: planDate,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
      });
      setActivity("");
      setCustomActivity("");
      setLocation("");
      setCustomLocation("");
      setDescription("");
      setMaxPeople(10);
      setTab(0);
      fetchPlans();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create plan");
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

  if (authLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-6 pb-24">
        <PlanListSkeleton count={4} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24">
      <div className="mb-5">
        <SegmentedControl tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {/* Browse Tab */}
      {tab === 0 && (
        <div>
          <div className="mb-4 space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setFilterActivity("all")}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterActivity === "all"
                    ? "bg-amber text-navy"
                    : "bg-surface text-text-secondary hover:text-text-primary"
                }`}
              >
                All
              </button>
              {ACTIVITIES.map((a) => (
                <button
                  key={a.label}
                  onClick={() => setFilterActivity(a.label)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    filterActivity === a.label
                      ? "bg-amber text-navy"
                      : "bg-surface text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {a.emoji} {a.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setFilterLocation("all")}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterLocation === "all"
                    ? "bg-mid-blue text-white"
                    : "bg-surface text-text-secondary hover:text-text-primary"
                }`}
              >
                All
              </button>
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  onClick={() => setFilterLocation(loc)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    filterLocation === loc
                      ? "bg-mid-blue text-white"
                      : "bg-surface text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {loadingPlans ? (
            <PlanListSkeleton count={4} />
          ) : plans.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center">
              <p className="text-text-secondary text-sm mb-4">No plans match your filters</p>
              <button
                onClick={() => setTab(1)}
                className="inline-block rounded-xl bg-amber px-6 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-amber-dark"
              >
                Create one
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Tab */}
      {tab === 1 && (
        <form onSubmit={handleCreate} className="space-y-6">
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
            <label className="block text-sm font-medium text-text-secondary mb-3">Where?</label>
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
              <label className="block text-sm font-medium text-text-secondary mb-2">Date</label>
              <input
                type="date"
                value={planDate}
                min={todayIST()}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Start (IST)</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                step={60}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">How long?</label>
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
            <label className="block text-sm font-medium text-text-secondary mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="e.g. Late night maggi run near H12"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber resize-none transition-colors"
              required
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

          {createError && <p className="text-sm text-error text-center">{createError}</p>}

          <button
            type="submit"
            disabled={submitting || !resolvedActivity || !resolvedLocation || !description.trim()}
            className="w-full rounded-xl bg-amber py-3.5 font-semibold text-navy transition-all hover:bg-amber-dark active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Posting..." : "Post plan"}
          </button>
        </form>
      )}

      {/* My Plans Tab */}
      {tab === 2 && (
        <div>
          {loadingMyPlans ? (
            <PlanListSkeleton count={3} />
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-text-secondary mb-3">
                  Live now ({livePlans.length})
                </h2>
                {livePlans.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-surface p-6 text-center">
                    <p className="text-sm text-text-muted mb-3">No live plans right now</p>
                    <button
                      onClick={() => setTab(1)}
                      className="inline-block rounded-xl bg-amber px-5 py-2 text-sm font-semibold text-navy hover:bg-amber-dark"
                    >
                      Create one
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {livePlans.map((plan) => (
                      <PlanCard key={plan.id} plan={plan} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-sm font-semibold text-text-secondary mb-3">
                  Past ({pastPlans.length})
                </h2>
                {pastPlans.length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-4">No past plans yet</p>
                ) : (
                  <div className="space-y-2">
                    {pastPlans.map((plan) => (
                      <PastPlanCard key={plan.id} plan={plan} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
