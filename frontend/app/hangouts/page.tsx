"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { PlanCard } from "@/components/PlanCard";
import { PlanListSkeleton } from "@/components/Skeleton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ImagePreview } from "@/components/ImagePreview";
import { LocationPicker } from "@/components/LocationPicker";
import { EmptyState, SectionHeading, Spinner } from "@/components/primitives";
import {
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  CompassIcon,
  ImageIcon,
  MapPinIcon,
  NavigationIcon,
  PlusIcon,
} from "@/components/icons";
import type { LatLng } from "@/lib/maps";
import { ACTIVITIES, LOCATIONS, ACTIVITY_EMOJI, type Activity, type Plan } from "@/lib/types";
import { compressImage } from "@/lib/compress-image";
import Link from "next/link";

const TABS = ["Browse", "My plans"];

const DURATIONS = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
];

function getISTParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}
function todayIST() { const { year, month, day } = getISTParts(); return `${year}-${month}-${day}`; }
function nowTimeIST() { const { hour, minute } = getISTParts(); return `${hour}:${minute}`; }

function formatTimeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+05:30");
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
}

function PastPlanCard({ plan }: { plan: Plan }) {
  const emoji = ACTIVITY_EMOJI[plan.activity] || "✨";
  const memberCount = plan.plan_members?.[0]?.count ?? 0;
  return (
    <Link
      href={`/plan/${plan.id}`}
      className="list-row border border-border"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-hover text-lg">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-text-primary">{plan.activity}</p>
        <p className="truncate text-caption text-text-tertiary">
          {plan.location} · {formatDateShort(plan.plan_date)} · {formatTimeIST(plan.starts_at)}
        </p>
      </div>
      <span className="shrink-0 text-caption tabular-nums text-text-tertiary">
        {memberCount} joined
      </span>
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
  const [pinCoords, setPinCoords] = useState<LatLng | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("Uploading…");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
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
    } catch {}
    finally { setLoadingPlans(false); }
  }, [filterActivity]);

  const fetchMyPlans = useCallback(async () => {
    try {
      const data = await api.getMyPlans();
      setLivePlans(data.live);
      setPastPlans(data.past);
    } catch {}
    finally { setLoadingMyPlans(false); }
  }, []);

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
      setUploadLabel("Optimizing…");
      const compressed = await compressImage(file, {
        maxWidth: 1280, maxHeight: 720, quality: 0.85, maxSizeMB: 2,
      });
      setUploadLabel("Uploading…");
      const result = await api.uploadImage(compressed);
      setImageUrl(result.url);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleCreate() {
    if (submitting) return;
    if (!resolvedActivity || !resolvedLocation || !description.trim()) {
      setCreateError("Pick an activity, a location, and add a quick description.");
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
        latitude: pinCoords?.lat ?? null,
        longitude: pinCoords?.lng ?? null,
      });
      resetForm();
      setShowCreate(false);
      fetchPlans();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create plan");
      setSubmitting(false);
    }
  }

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
    setPinCoords(null);
    setShowLocationPicker(false);
    setCreateError("");
    setSubmitting(false);
  }

  if (authLoading) {
    return (
      <div className="app-shell pt-0">
        <div className="app-content">
          <div className="top-bar"><h1 className="text-[17px] font-semibold">Hangouts</h1></div>
          <div className="px-4 pt-4"><PlanListSkeleton count={4} /></div>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="app-shell pt-0">
      <div className="app-content">
        <header className="top-bar">
          <h1 className="text-[17px] font-semibold text-text-primary">Hangouts</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary btn-xs ml-auto gap-1 px-3"
          >
            <PlusIcon size={14} />
            New
          </button>
        </header>

        <div className="px-4 pt-4">
          <SegmentedControl tabs={TABS} active={tab} onChange={setTab} />
        </div>

        {tab === 0 ? (
          <>
            <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
              <button
                onClick={() => setFilterActivity("all")}
                className={`chip shrink-0 ${filterActivity === "all" ? "chip-active" : ""}`}
              >
                All
              </button>
              {ACTIVITIES.map((a) => (
                <button
                  key={a.label}
                  onClick={() => setFilterActivity(a.label)}
                  className={`chip shrink-0 ${filterActivity === a.label ? "chip-active" : ""}`}
                >
                  <span>{a.emoji}</span>
                  {a.label}
                </button>
              ))}
            </div>

            <div className="px-4 pb-4">
              {loadingPlans ? (
                <PlanListSkeleton count={4} />
              ) : plans.length === 0 ? (
                <EmptyState
                  icon={<CompassIcon size={22} />}
                  title="No plans right now"
                  description="Be the first to host one."
                  action={
                    <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
                      Create a plan
                    </button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {plans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} onJoined={fetchPlans} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="px-4 pt-4 pb-4">
            {loadingMyPlans ? (
              <PlanListSkeleton count={3} />
            ) : (
              <>
                <section className="mb-6">
                  <SectionHeading>Live · {livePlans.length}</SectionHeading>
                  {livePlans.length === 0 ? (
                    <p className="py-4 text-center text-caption text-text-tertiary">
                      No live plans
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {livePlans.map((plan) => (
                        <PlanCard key={plan.id} plan={plan} onJoined={fetchMyPlans} />
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <SectionHeading>Past · {pastPlans.length}</SectionHeading>
                  {pastPlans.length === 0 ? (
                    <p className="py-4 text-center text-caption text-text-tertiary">
                      No past plans yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pastPlans.map((plan) => (
                        <PastPlanCard key={plan.id} plan={plan} />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </div>

      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="fab bottom-24 right-4 md:bottom-8 md:right-[max(16px,calc(50%-340px+16px))]"
          aria-label="Create hangout"
        >
          <PlusIcon size={24} />
        </button>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[70] animate-fade-in overflow-y-auto bg-ink-900">
          <div className="sticky-bar">
            <button
              onClick={() => { if (!submitting) { setShowCreate(false); resetForm(); } }}
              disabled={submitting}
              className="icon-btn"
              aria-label="Close"
            >
              <CloseIcon size={20} />
            </button>
            <span className="text-[17px] font-semibold text-text-primary">
              New hangout
            </span>
            <button
              onClick={handleCreate}
              disabled={submitting || !resolvedActivity || !resolvedLocation || !description.trim()}
              className="btn-primary btn-xs ml-auto px-4"
            >
              {submitting ? <Spinner size={14} tone="ink" /> : "Post"}
            </button>
          </div>

          <div className="app-content px-4 py-4 pb-[env(safe-area-inset-bottom)]" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 56px)" }}>
            {createError && (
              <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-caption text-danger">
                {createError}
              </p>
            )}

            <div className="space-y-5">
              {/* Cover photo: prominent, first */}
              <div>
                <p className="section-eyebrow mb-2">Cover photo</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImagePick}
                  className="hidden"
                />
                {imageUrl ? (
                  <ImagePreview src={imageUrl} onRemove={() => setImageUrl(null)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex h-32 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-caption text-text-tertiary transition-colors hover:border-text-tertiary hover:text-text-secondary disabled:opacity-40"
                  >
                    {uploading ? (
                      <>
                        <Spinner size={14} />
                        {uploadLabel}
                      </>
                    ) : (
                      <>
                        <ImageIcon size={18} />
                        Add a photo (optional)
                      </>
                    )}
                  </button>
                )}
              </div>

              <div>
                <p className="section-eyebrow mb-2">Activity</p>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITIES.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => setActivity(a.label)}
                      className={`chip ${activity === a.label ? "chip-active" : ""}`}
                    >
                      <span>{a.emoji}</span>
                      {a.label}
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
                    className="input mt-3 py-2.5 text-sm"
                    autoFocus
                  />
                )}
              </div>

              <div>
                <p className="section-eyebrow mb-2">Location</p>
                <div className="flex flex-wrap gap-2">
                  {LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocation(loc)}
                      className={`chip ${location === loc ? "chip-brand-active" : ""}`}
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
                    className="input mt-3 py-2.5 text-sm"
                    autoFocus
                  />
                )}

                {/*
                 * Optional exact pin. Encourages Uber-style precision: the
                 * label ("H7") gets you close, the pin gets you to the
                 * specific door.
                 */}
                <div className="mt-3">
                  {pinCoords ? (
                    <div className="flex items-center gap-2 rounded-xl border border-success/35 bg-success/10 px-3 py-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success/20 text-success">
                        <CheckIcon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-caption font-semibold text-success">
                          Exact spot pinned
                        </p>
                        <p className="truncate font-mono text-[11px] text-text-tertiary">
                          {pinCoords.lat.toFixed(5)}, {pinCoords.lng.toFixed(5)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLocationPicker(true)}
                        className="btn-secondary btn-xs"
                      >
                        Adjust
                      </button>
                      <button
                        type="button"
                        onClick={() => setPinCoords(null)}
                        className="icon-btn h-8 w-8"
                        aria-label="Remove pin"
                      >
                        <CloseIcon size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowLocationPicker(true)}
                      className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-caption text-text-tertiary transition-colors hover:border-text-tertiary hover:text-text-secondary"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-hover text-text-tertiary">
                        <MapPinIcon size={14} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold text-text-secondary">
                          Pin the exact spot
                        </span>
                        <span className="truncate text-[11px] text-text-muted">
                          Drop a map marker so friends navigate right to the door
                        </span>
                      </span>
                      <NavigationIcon size={14} className="text-text-tertiary" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <p className="section-eyebrow mb-2">Description</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="What's the plan?"
                  className="input resize-none text-sm"
                />
                <p className="mt-1 text-right text-[11px] text-text-muted">
                  {description.length}/200
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="min-w-[200px] flex-1">
                  <p className="section-eyebrow mb-2">When</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <CalendarIcon
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                      />
                      <input
                        type="date"
                        value={planDate}
                        min={todayIST()}
                        onChange={(e) => setPlanDate(e.target.value)}
                        className="input py-2.5 pl-9 text-xs"
                      />
                    </div>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      step={60}
                      className="input w-28 py-2.5 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <p className="section-eyebrow mb-2">Duration</p>
                  <div className="flex gap-1.5">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.minutes}
                        type="button"
                        onClick={() => setDuration(d.minutes)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                          duration === d.minutes
                            ? "border-amber bg-amber/10 text-amber"
                            : "border-border text-text-tertiary hover:text-text-primary"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="section-eyebrow">Max people</p>
                  <span className="text-body font-semibold tabular-nums text-amber">
                    {maxPeople}
                  </span>
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
            </div>
          </div>
        </div>
      )}

      {showLocationPicker && (
        <LocationPicker
          initial={pinCoords}
          label={resolvedLocation || undefined}
          onCancel={() => setShowLocationPicker(false)}
          onConfirm={(coords) => {
            setPinCoords(coords);
            setShowLocationPicker(false);
          }}
        />
      )}
    </div>
  );
}
