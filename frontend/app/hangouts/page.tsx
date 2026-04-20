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
import { compressImage } from "@/lib/compress-image";

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
      className="panel-surface block rounded-xl p-3 transition-colors hover:bg-surface-hover/90"
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
  const [uploadLabel, setUploadLabel] = useState("Uploading...");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced refetch — prevents burst of updates from firing multiple sequential fetches
  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPlans(), 300);
  }, [fetchPlans]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchPlans();
  }, [fetchPlans, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const channel = supabase
      .channel("hangouts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_members" }, debouncedFetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [debouncedFetch, isAuthenticated]);

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
    if (!file.type.startsWith("image/")) { setCreateError("Only images allowed"); return; }
    if (file.size > 20 * 1024 * 1024) { setCreateError("Image must be under 20MB"); return; }
    setUploading(true);
    setCreateError("");
    try {
      setUploadLabel("Optimizing...");
      const compressed = await compressImage(file, { maxWidth: 1280, maxHeight: 720, quality: 0.85, maxSizeMB: 2 });
      setUploadLabel("Uploading...");
      const result = await api.uploadImage(compressed);
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
      <div className="app-shell pt-6">
        <div className="app-content">
          <PlanListSkeleton count={4} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="app-shell pt-5">
      <div className="app-content">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Hangouts</h1>
            <p className="text-xs text-text-muted">Discover active plans or host your own.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="premium-button rounded-lg px-3 py-2 text-xs"
          >
            New plan
          </button>
        </div>

        <div className="mb-4">
          <SegmentedControl tabs={TABS} active={tab} onChange={setTab} />
        </div>

        <div className="panel-surface rounded-3xl p-4 md:p-5">
          {tab === 0 ? (
            <div>
              <div className="mb-1 flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                <button
                  onClick={() => setFilterActivity("all")}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    filterActivity === "all"
                      ? "border-amber/20 bg-amber text-navy"
                      : "border-border/80 bg-surface text-text-secondary hover:border-mid-blue/50 hover:text-text-primary"
                  }`}
                >
                  All
                </button>
                {ACTIVITIES.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => setFilterActivity(a.label)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      filterActivity === a.label
                        ? "border-amber/20 bg-amber text-navy"
                        : "border-border/80 bg-surface text-text-secondary hover:border-mid-blue/50 hover:text-text-primary"
                    }`}
                  >
                    {a.emoji} {a.label}
                  </button>
                ))}
              </div>

              {loadingPlans ? (
                <PlanListSkeleton count={4} />
              ) : plans.length === 0 ? (
                <div className="hero-surface p-8 text-center">
                  <p className="mb-4 text-sm text-text-secondary">No plans right now</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="premium-button px-6 py-2.5 text-sm"
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
                    className="panel-surface mt-4 w-full rounded-xl py-4 text-center transition-colors hover:bg-surface/80"
                  >
                    <p className="text-sm text-text-muted">
                      Didn&apos;t find any plans that you&apos;re interested in?
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-amber">
                      Tap here to create your own plan and let others join
                    </p>
                  </button>
                </>
              )}
            </div>
          ) : (
            <div>
              {loadingMyPlans ? (
                <PlanListSkeleton count={3} />
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="mb-3 text-sm font-semibold text-text-secondary">
                      Live ({livePlans.length})
                    </h2>
                    {livePlans.length === 0 ? (
                      <div className="hero-surface p-6 text-center">
                        <p className="mb-3 text-sm text-text-muted">No live plans</p>
                        <button
                          onClick={() => setShowCreate(true)}
                          className="premium-button px-5 py-2 text-sm"
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
                    <h2 className="mb-3 text-sm font-semibold text-text-secondary">
                      Past ({pastPlans.length})
                    </h2>
                    {pastPlans.length === 0 ? (
                      <p className="py-4 text-center text-sm text-text-muted">No past plans yet</p>
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
      </div>

      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber text-navy shadow-elevated transition-all hover:bg-amber-dark hover:shadow-xl active:scale-90 md:right-[calc(50%-340px+24px)]"
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

      {showCreate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/95 animate-fade-in backdrop-blur-xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-navy/90 px-4 py-3 backdrop-blur-xl">
            <button
              onClick={() => {
                if (!submitting) {
                  setShowCreate(false);
                  resetForm();
                }
              }}
              disabled={submitting}
              className="text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-text-primary">Create New Hangout Plan</span>
            <button
              onClick={handleCreate}
              disabled={submitting || !resolvedActivity || !resolvedLocation || !description.trim()}
              className="premium-button min-w-[56px] rounded-full px-4 py-1.5 text-xs font-bold"
            >
              {submitting ? (
                <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : "Post"}
            </button>
          </div>

          {createError && (
            <div className="app-content px-4 pt-3">
              <p className="rounded-lg bg-error/10 px-3 py-2 text-center text-xs text-error">{createError}</p>
            </div>
          )}

          <div className="app-content px-4 py-4">
            <div className="hero-surface space-y-5 p-4 md:p-5">
              <div>
                <p className="mb-2 text-xs font-medium text-text-muted">Activity</p>
                <div className="flex flex-wrap gap-2">
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
                    className="premium-input mt-2 px-3 py-2 text-sm"
                    autoFocus
                  />
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-text-muted">Location</p>
                <div className="flex flex-wrap gap-2">
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
                    className="premium-input mt-2 px-3 py-2 text-sm"
                    autoFocus
                  />
                )}
              </div>

              <div>
                <textarea
                  ref={descRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="What's the plan? e.g. Late night maggi run"
                  className="premium-input resize-none px-3 py-2.5 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="mb-1 text-xs font-medium text-text-muted">When</p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={planDate}
                      min={todayIST()}
                      onChange={(e) => setPlanDate(e.target.value)}
                      className="premium-input flex-1 rounded-lg px-2 py-2 text-xs"
                    />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      step={60}
                      className="premium-input w-24 rounded-lg px-2 py-2 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-text-muted">Duration</p>
                  <div className="flex gap-1">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.minutes}
                        type="button"
                        onClick={() => setDuration(d.minutes)}
                        className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                          duration === d.minutes
                            ? "border-amber/20 bg-amber text-navy"
                            : "border-border/70 bg-surface text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-medium text-text-muted">Max people</p>
                  <span className="tabular-nums text-xs font-bold text-amber">{maxPeople}</span>
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

              <div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                {imageUrl ? (
                  <ImagePreview src={imageUrl} onRemove={() => setImageUrl(null)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 text-xs text-text-muted transition-colors hover:text-amber disabled:opacity-40"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    {uploading ? <span className="animate-pulse">{uploadLabel}</span> : "Add a cover photo (optional)"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
