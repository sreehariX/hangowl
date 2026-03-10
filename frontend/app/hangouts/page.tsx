"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { PlanCard } from "@/components/PlanCard";
import { PlanListSkeleton } from "@/components/Skeleton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ImagePreview } from "@/components/ImagePreview";
import { ACTIVITIES, LOCATIONS, ACTIVITY_EMOJI, type Activity, type Plan } from "@/lib/types";

const TABS = ["Browse", "My Plans"];

const DURATIONS = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
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
  const [showCreate, setShowCreate] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [filterActivity, setFilterActivity] = useState<string>("all");

  const [livePlans, setLivePlans] = useState<Plan[]>([]);
  const [pastPlans, setPastPlans] = useState<Plan[]>([]);
  const [loadingMyPlans, setLoadingMyPlans] = useState(true);

  // Create form state
  const [activity, setActivity] = useState<Activity | "">("");
  const [customActivity, setCustomActivity] = useState("");
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [description, setDescription] = useState("");
  const [maxPeople, setMaxPeople] = useState(10);
  const [planDate, setPlanDate] = useState(todayIST());
  const [startTime, setStartTime] = useState(nowTimeIST());
  const [duration, setDuration] = useState(60);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/verify");
  }, [authLoading, isAuthenticated, router]);

  const fetchPlans = useCallback(async () => {
    try {
      const params: { activity?: string } = {};
      if (filterActivity !== "all") params.activity = filterActivity;
      const data = await api.getPlans(params);
      setPlans(data.plans);
    } catch { /* silent */ }
    finally { setLoadingPlans(false); }
  }, [filterActivity]);

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
    if (tab === 1 && isAuthenticated) {
      setLoadingMyPlans(true);
      fetchMyPlans();
    }
  }, [tab, isAuthenticated, fetchMyPlans]);

  const resolvedActivity = activity === "Others" ? customActivity : activity;
  const resolvedLocation = location === "Others" ? customLocation : location;

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setCreateError("Image must be under 5MB"); return; }
    if (!file.type.startsWith("image/")) { setCreateError("Only images allowed"); return; }
    setUploading(true);
    setCreateError("");
    try {
      const result = await api.uploadImage(file);
      setImageUrl(result.url);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const handleCreate = async () => {
    if (submitting) return;
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
        image_url: imageUrl,
      });
      resetForm();
      setShowCreate(false);
      fetchPlans();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create plan");
      setSubmitting(false);
    }
  };

  function resetForm() {
    setActivity("");
    setCustomActivity("");
    setLocation("");
    setCustomLocation("");
    setDescription("");
    setMaxPeople(10);
    setPlanDate(todayIST());
    setStartTime(nowTimeIST());
    setDuration(60);
    setImageUrl(null);
    setCreateError("");
    setSubmitting(false);
  }

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
      <div className="mb-4">
        <SegmentedControl tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {/* Browse Tab */}
      {tab === 0 && (
        <div>
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
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

          {loadingPlans ? (
            <PlanListSkeleton count={4} />
          ) : plans.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center">
              <p className="text-text-secondary text-sm mb-4">No plans right now</p>
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-xl bg-amber px-6 py-2.5 text-sm font-semibold text-navy hover:bg-amber-dark"
              >
                Create one
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {plans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} onJoined={fetchPlans} />
                ))}
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 w-full py-4 text-center transition-colors hover:bg-surface/50 rounded-xl"
              >
                <p className="text-sm text-text-muted">Didn&apos;t find what you&apos;re looking for?</p>
                <p className="text-sm font-medium text-amber mt-0.5">Create your own plan and let others join</p>
              </button>
            </>
          )}
        </div>
      )}

      {/* My Plans Tab */}
      {tab === 1 && (
        <div>
          {loadingMyPlans ? (
            <PlanListSkeleton count={3} />
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-text-secondary mb-3">
                  Live ({livePlans.length})
                </h2>
                {livePlans.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-surface p-6 text-center">
                    <p className="text-sm text-text-muted mb-3">No live plans</p>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="rounded-xl bg-amber px-5 py-2 text-sm font-semibold text-navy hover:bg-amber-dark"
                    >
                      Create one
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {livePlans.map((plan) => (
                      <PlanCard key={plan.id} plan={plan} onJoined={fetchMyPlans} />
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

      {/* Create FAB */}
      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber text-navy shadow-lg shadow-amber/30 transition-all hover:bg-amber-dark hover:shadow-xl active:scale-90 md:right-[calc(50%-256px+16px)]"
          aria-label="Create hangout"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="12" y1="13" x2="12" y2="19" />
            <line x1="9" y1="16" x2="15" y2="16" />
          </svg>
        </button>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-navy animate-fade-in overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-navy z-10">
            <button
              onClick={() => { if (!submitting) { setShowCreate(false); resetForm(); } }}
              disabled={submitting}
              className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-text-primary">Create New Hangout Plan</span>
            <button
              onClick={handleCreate}
              disabled={submitting || !resolvedActivity || !resolvedLocation || !description.trim()}
              className="rounded-full bg-amber px-4 py-1.5 text-xs font-bold text-navy transition-all hover:bg-amber-dark active:scale-95 disabled:opacity-40 min-w-[56px] flex items-center justify-center"
            >
              {submitting ? (
                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : "Post"}
            </button>
          </div>

          {createError && (
            <div className="mx-auto max-w-lg px-4 pt-3">
              <p className="text-xs text-error text-center bg-error/10 rounded-lg py-2 px-3">{createError}</p>
            </div>
          )}

          <div className="mx-auto max-w-lg px-4 py-4 space-y-5">
            {/* Activity */}
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">Activity</p>
              <div className="flex gap-2 flex-wrap">
                {ACTIVITIES.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => setActivity(a.label)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                      activity === a.label
                        ? "bg-amber text-navy"
                        : "bg-surface text-text-secondary hover:bg-surface-hover active:scale-95"
                    }`}
                  >
                    {a.emoji} {a.label}
                  </button>
                ))}
              </div>
              {activity === "Others" && (
                <input
                  type="text"
                  value={customActivity}
                  onChange={(e) => setCustomActivity(e.target.value)}
                  placeholder="What activity?"
                  maxLength={50}
                  className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-amber focus:outline-none"
                  autoFocus
                />
              )}
            </div>

            {/* Location */}
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">Location</p>
              <div className="flex gap-2 flex-wrap">
                {LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                      location === loc
                        ? "bg-mid-blue text-white"
                        : "bg-surface text-text-secondary hover:bg-surface-hover active:scale-95"
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
                  placeholder="Where?"
                  maxLength={50}
                  className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-mid-blue focus:outline-none"
                  autoFocus
                />
              )}
            </div>

            {/* Description */}
            <div>
              <textarea
                ref={descRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="What's the plan? e.g. Late night maggi run"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-amber focus:outline-none resize-none"
              />
            </div>

            {/* Time row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-xs font-medium text-text-muted mb-1">When</p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={planDate}
                    min={todayIST()}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-xs text-text-primary focus:border-amber focus:outline-none"
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    step={60}
                    className="w-24 rounded-lg border border-border bg-surface px-2 py-2 text-xs text-text-primary focus:border-amber focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted mb-1">Duration</p>
                <div className="flex gap-1">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.minutes}
                      type="button"
                      onClick={() => setDuration(d.minutes)}
                      className={`rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                        duration === d.minutes
                          ? "bg-amber text-navy"
                          : "bg-surface text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* People slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-text-muted">Max people</p>
                <span className="text-xs font-bold text-amber tabular-nums">{maxPeople}</span>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                value={maxPeople}
                onChange={(e) => setMaxPeople(Number(e.target.value))}
                className="w-full accent-amber"
              />
            </div>

            {/* Image */}
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
              {imageUrl ? (
                <ImagePreview src={imageUrl} onRemove={() => setImageUrl(null)} />
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 text-xs text-text-muted hover:text-amber transition-colors disabled:opacity-40"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                  {uploading ? "Uploading..." : "Add a cover photo (optional)"}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
