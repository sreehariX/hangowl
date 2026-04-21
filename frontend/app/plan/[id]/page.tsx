"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { ACTIVITY_EMOJI, type PlanDetail } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { ImageLightbox } from "@/components/ImageLightbox";
import { LivePresenceMap } from "@/components/LivePresenceMap";
import { PlanChat } from "@/components/PlanChat";
import { Spinner } from "@/components/primitives";
import {
  ArrowLeftIcon,
  BarChartIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  MapPinIcon,
  MessageCircleIcon,
  NavigationIcon,
  ShareIcon,
  UsersIcon,
} from "@/components/icons";
import { openDirections } from "@/lib/maps";

function formatTimeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}
function formatDateIST(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+05:30");
  return d.toLocaleDateString("en-IN", {
    weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Kolkata",
  });
}
function formatViews(n: number | null | undefined) {
  const v = n ?? 0;
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}K`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

function MetaRow({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-text-tertiary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
          {label}
        </p>
        <p className="truncate text-body font-medium text-text-primary">
          {value}
        </p>
      </div>
    </div>
  );
}

function PlanContent({ plan, onRefresh }: { plan: PlanDetail; onRefresh: () => void }) {
  const { isAuthenticated, userId } = useAuth();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  /** Unread badge count rendered on the chat FAB. Bumped by realtime
   *  INSERTs on plan_messages whenever the sheet is closed and the
   *  message isn't our own echo; zeroed the moment the sheet opens. */
  const [unread, setUnread] = useState(0);
  const chatOpenRef = useRef(chatOpen);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  // Lock body scroll + Esc-to-close while the chat sheet is open,
  // matching the Post compose screen so the keyboard doesn't fight
  // the outer page.
  useEffect(() => {
    if (!chatOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChatOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [chatOpen]);

  // Opening the sheet counts as "seen".
  useEffect(() => {
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

  const emoji = ACTIVITY_EMOJI[plan.activity] || "✨";
  const creatorName = plan.users?.persona_name ?? "Anonymous";
  const members = plan.plan_members ?? [];
  const ended = new Date(plan.ends_at) < new Date();
  const planCoords =
    typeof plan.latitude === "number" && typeof plan.longitude === "number"
      ? { lat: plan.latitude, lng: plan.longitude }
      : null;
  const isCreator = userId === plan.creator_id;
  const alreadyJoined = members.some((m) => m.user_id === userId);

  // Realtime unread counter. Only spin up the subscription for
  // members — non-members never see the FAB.
  useEffect(() => {
    if (!alreadyJoined || ended || !plan.id) return;
    const channel = supabase
      .channel(`plan-chat-unread-${plan.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plan_messages",
          filter: `plan_id=eq.${plan.id}`,
        },
        (payload) => {
          const row = payload.new as { user_id?: string };
          if (row.user_id === userId) return;
          if (chatOpenRef.current) return;
          setUnread((n) => Math.min(n + 1, 99));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [alreadyJoined, ended, plan.id, userId]);

  async function handleJoin() {
    if (!isAuthenticated) { router.push("/verify"); return; }
    setJoining(true);
    setError("");
    try { await api.joinPlan(plan.id); onRefresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to join"); }
    finally { setJoining(false); }
  }

  async function handleLeave() {
    setLeaving(true);
    setError("");
    try { await api.leavePlan(plan.id); setConfirmLeave(false); onRefresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to leave"); }
    finally { setLeaving(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try { await api.hidePlan(plan.id); router.push("/hangouts"); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to delete"); setConfirmDelete(false); }
    finally { setDeleting(false); }
  }

  async function handleShare() {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const time = `${formatTimeIST(plan.starts_at)} to ${formatTimeIST(plan.ends_at)}`;
    const text = `${plan.activity} at ${plan.location} (${time} IST)${
      plan.description ? `. "${plan.description}"` : ""
    }. Join on HangOwl:`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${plan.activity} at ${plan.location} · HangOwl`,
          text,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      }
    } catch {}
  }

  const dateLabel = plan.plan_date ? formatDateIST(plan.plan_date) : "TBD";
  const timeLabel = `${formatTimeIST(plan.starts_at)} to ${formatTimeIST(plan.ends_at)}`;
  const spotsLeft = Math.max(0, plan.max_people - members.length);
  const isFull = spotsLeft === 0;
  const visibleMembers = members.slice(0, 6);
  const extraMembers = Math.max(0, members.length - visibleMembers.length);

  const joinButtonLabel = (() => {
    if (joining) return <Spinner size={16} tone="ink" />;
    if (alreadyJoined && isCreator) return (<><CheckIcon size={16} />You created this plan</>);
    if (alreadyJoined) return (<><CheckIcon size={16} />You&apos;re in</>);
    if (!isAuthenticated) return "Sign in to join";
    if (isFull) return "Plan is full";
    return "Join this plan";
  })();

  return (
    <div className="app-shell pt-0">
      <div className="app-content pb-10">
        {lightboxOpen && plan.image_url && (
          <ImageLightbox src={plan.image_url} onClose={() => setLightboxOpen(false)} />
        )}

        <div className="top-bar">
          <button onClick={() => router.back()} className="icon-btn" aria-label="Back">
            <ArrowLeftIcon size={20} />
          </button>
          <span className="truncate text-[17px] font-semibold text-text-primary">
            {plan.activity}
          </span>
          <button onClick={handleShare} className="icon-btn ml-auto" aria-label="Share">
            <ShareIcon size={18} />
          </button>
        </div>

        {/* Live map sits directly below the back/title bar so it's the
         * first thing a member sees when opening a plan. Group chat
         * lives behind a floating button (same .fab pattern as the
         * Post / Create-hangout FABs) so it doesn't eat vertical
         * space until the user actually wants to read it. */}
        {!ended && alreadyJoined && (
          <div className="px-4 pt-4">
            <LivePresenceMap
              planId={plan.id}
              hostId={plan.creator_id}
              destination={planCoords}
              destinationLabel={plan.location}
              variant="card"
            />
          </div>
        )}

        <div className="px-4 pt-4">
          <section className="surface-panel overflow-hidden">
            {plan.image_url ? (
              <button
                type="button"
                className="relative block h-56 w-full overflow-hidden"
                onClick={() => setLightboxOpen(true)}
                aria-label="Open cover photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={plan.image_url}
                  alt={plan.activity}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                  <span>{emoji}</span>
                  {plan.activity}
                </span>
              </button>
            ) : (
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-ink-850 to-ink-800">
                <span className="text-5xl" aria-hidden>{emoji}</span>
              </div>
            )}

            <div className="p-5">
              <h1 className="text-title-lg font-semibold text-text-primary">
                {plan.activity}
              </h1>
              <button
                type="button"
                onClick={() => openDirections(plan.location, planCoords)}
                className="group mt-1.5 flex items-center gap-1.5 text-body text-text-secondary transition-colors hover:text-text-primary"
                aria-label={`Open directions to ${plan.location} in Google Maps`}
              >
                <MapPinIcon size={14} className="text-text-tertiary" />
                <span className="underline decoration-text-muted decoration-dotted underline-offset-4 group-hover:decoration-text-secondary">
                  {plan.location}
                </span>
                <NavigationIcon size={12} className="text-text-tertiary" />
              </button>

              {plan.description && (
                <p className="mt-3 whitespace-pre-wrap text-body text-text-secondary">
                  {plan.description}
                </p>
              )}

              <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-4">
                <Avatar name={creatorName} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
                    Hosted by
                  </p>
                  <p className="truncate text-body font-semibold text-text-primary">
                    {creatorName}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-1 text-caption text-text-tertiary">
                  <BarChartIcon size={12} />
                  <span className="tabular-nums">{formatViews(plan.views_count)}</span>
                </span>
              </div>
            </div>
          </section>

          <section className="surface-panel mt-3 divide-y divide-border px-4">
            <MetaRow
              icon={<CalendarIcon size={16} />}
              label="When"
              value={<>{dateLabel} <span className="font-normal text-text-tertiary">· {timeLabel}</span></>}
            />
            <MetaRow
              icon={<UsersIcon size={16} />}
              label="Who"
              value={
                <span className="flex items-center gap-2">
                  <span>{members.length} / {plan.max_people} joined</span>
                  {!ended && spotsLeft > 0 && spotsLeft <= 3 && (
                    <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber">
                      {spotsLeft} left
                    </span>
                  )}
                  {!ended && isFull && (
                    <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-semibold text-text-tertiary">
                      Full
                    </span>
                  )}
                </span>
              }
            />
          </section>

          {members.length > 0 && (
            <section className="mt-5">
              <p className="section-eyebrow mb-2.5">In this plan · {members.length}</p>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {visibleMembers.map((m, i) => (
                    <div
                      key={i}
                      className="rounded-full ring-2 ring-surface"
                      title={m.users?.persona_name ?? "?"}
                    >
                      <Avatar name={m.users?.persona_name ?? "?"} size={30} />
                    </div>
                  ))}
                  {extraMembers > 0 && (
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-surface-hover text-[11px] font-semibold text-text-secondary ring-2 ring-surface">
                      +{extraMembers}
                    </div>
                  )}
                </div>
                <p className="ml-1 min-w-0 flex-1 truncate text-caption text-text-tertiary">
                  {visibleMembers.map((m) => m.users?.persona_name ?? "?").join(", ")}
                  {extraMembers > 0 ? ` and ${extraMembers} more` : ""}
                </p>
              </div>
            </section>
          )}

          {!ended ? (
            <div className="mt-5 space-y-2">
              <button
                onClick={handleJoin}
                disabled={joining || alreadyJoined || (!isAuthenticated ? false : isFull)}
                className={
                  alreadyJoined
                    ? "btn-block flex h-11 items-center justify-center gap-2 rounded-full border border-success/35 bg-success/10 text-body font-semibold text-success"
                    : "btn-primary btn-lg btn-block"
                }
              >
                {joinButtonLabel}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => openDirections(plan.location, planCoords)}
                  className="btn-secondary btn-lg flex-1 gap-2"
                  aria-label="Open directions in Google Maps"
                >
                  <NavigationIcon size={16} />
                  Directions
                </button>
                <button onClick={handleShare} className="btn-secondary btn-lg flex-1 gap-2">
                  <ShareIcon size={16} />
                  Share
                </button>
                {alreadyJoined && !isCreator && !confirmLeave && (
                  <button
                    onClick={() => setConfirmLeave(true)}
                    className="btn-secondary btn-lg flex-1"
                  >
                    Leave
                  </button>
                )}
                {isCreator && !confirmDelete && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="btn-lg flex-1 rounded-full border border-danger/30 bg-danger/10 font-semibold text-danger transition-colors hover:bg-danger/15"
                  >
                    Delete
                  </button>
                )}
              </div>

              {alreadyJoined && !isCreator && confirmLeave && (
                <div className="surface-panel space-y-2 p-3">
                  <p className="text-center text-body text-text-secondary">
                    Leave this plan?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmLeave(false)} className="btn-secondary flex-1">
                      Cancel
                    </button>
                    <button onClick={handleLeave} disabled={leaving} className="btn-danger flex-1">
                      {leaving ? <Spinner size={14} tone="white" /> : "Yes, leave"}
                    </button>
                  </div>
                </div>
              )}
              {isCreator && confirmDelete && (
                <div className="space-y-2 rounded-2xl border border-danger/30 p-3">
                  <p className="text-center text-body text-text-secondary">
                    Delete this plan?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1">
                      Cancel
                    </button>
                    <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">
                      {deleting ? <Spinner size={14} tone="white" /> : "Yes, delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="surface-panel mt-5 flex items-center justify-center gap-1.5 px-3 py-3 text-body text-text-tertiary">
              <ClockIcon size={14} />
              This plan has ended
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-center text-caption text-danger">
              {error}
            </p>
          )}
        </div>

        {/* Keep a small bottom gap so the floating chat FAB never
         * covers the join / leave actions above it. */}
        {!ended && alreadyJoined && (
          <div aria-hidden className="h-24" />
        )}
      </div>

      {!ended && alreadyJoined && !chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fab bottom-24 right-4 md:bottom-8 md:right-[max(16px,calc(50%-340px+16px))]"
          aria-label={
            unread > 0
              ? `Open group chat (${unread} new ${
                  unread === 1 ? "message" : "messages"
                })`
              : "Open group chat"
          }
        >
          <MessageCircleIcon size={22} />
          {unread > 0 && (
            <span
              className="chat-fab-badge tabular-nums"
              aria-hidden
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {!ended && alreadyJoined && chatOpen && (
        <div className="fixed inset-0 z-[70] flex animate-fade-in flex-col bg-ink-900">
          <div className="sticky-bar">
            <button
              onClick={() => setChatOpen(false)}
              className="icon-btn"
              aria-label="Close"
            >
              <CloseIcon size={20} />
            </button>
            <span className="text-[17px] font-semibold text-text-primary">
              Group chat
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <PlanChat planId={plan.id} variant="fill" hideHeader />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanPage() {
  const params = useParams();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPlan = useCallback(async () => {
    try {
      const data = await api.getPlan(params.id as string);
      setPlan(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan not found");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPlan();
    const planId = params.id as string;
    try {
      const raw = sessionStorage.getItem("ho_viewed_plans");
      const viewed: string[] = raw ? JSON.parse(raw) : [];
      if (!viewed.includes(planId)) {
        viewed.push(planId);
        if (viewed.length > 200) viewed.splice(0, viewed.length - 200);
        sessionStorage.setItem("ho_viewed_plans", JSON.stringify(viewed));
        api.recordPlanView(planId).catch(() => {});
      }
    } catch {
      api.recordPlanView(planId).catch(() => {});
    }
  }, [fetchPlan, params.id]);

  if (loading) {
    return (
      <div className="app-shell pt-10">
        <div className="app-content flex justify-center">
          <Spinner />
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="app-shell pt-16">
        <div className="mx-auto max-w-sm px-4 text-center">
          <div className="mb-3 text-3xl">🦉</div>
          <h1 className="mb-2 text-title font-semibold text-text-primary">
            Plan not found
          </h1>
          <p className="text-body text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return <PlanContent plan={plan} onRefresh={fetchPlan} />;
}
