"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ACTIVITY_EMOJI, type PlanDetail } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { ImageLightbox } from "@/components/ImageLightbox";
import { PlanChat } from "@/components/PlanChat";
import { Spinner } from "@/components/primitives";
import {
  ArrowLeftIcon,
  BarChartIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  ShareIcon,
  UsersIcon,
} from "@/components/icons";

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

function Stat({
  icon, value, label,
}: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 px-2">
      <span className="text-text-tertiary">{icon}</span>
      <span className="text-body font-semibold text-text-primary">{value}</span>
      <span className="text-[11px] text-text-tertiary">{label}</span>
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

  const emoji = ACTIVITY_EMOJI[plan.activity] || "✨";
  const creatorName = plan.users?.persona_name ?? "Anonymous";
  const members = plan.plan_members ?? [];
  const ended = new Date(plan.ends_at) < new Date();
  const isCreator = userId === plan.creator_id;
  const alreadyJoined = members.some((m) => m.user_id === userId);

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

  return (
    <div className="app-shell pt-0">
      <div className="app-content pb-4">
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

        {plan.image_url && (
          <button
            type="button"
            className="relative block w-full"
            onClick={() => setLightboxOpen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={plan.image_url}
              alt={plan.activity}
              className="h-56 w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </button>
        )}

        <div className="px-4 py-5">
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover text-3xl">
              {emoji}
            </div>
            <h1 className="text-title font-semibold text-text-primary">
              {plan.activity}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-body text-text-secondary">
              <MapPinIcon size={14} className="text-text-tertiary" />
              {plan.location}
            </p>
          </div>

          {plan.description && (
            <p className="mb-5 text-center text-body text-text-secondary">
              {plan.description}
            </p>
          )}

          <div className="mb-5 flex items-stretch justify-between gap-2 rounded-xl border border-border p-3">
            <Stat
              icon={<CalendarIcon size={16} />}
              value={plan.plan_date ? formatDateIST(plan.plan_date) : "TBD"}
              label={`${formatTimeIST(plan.starts_at)} to ${formatTimeIST(plan.ends_at)}`}
            />
            <div className="w-px bg-border" />
            <Stat
              icon={<UsersIcon size={16} />}
              value={`${members.length}/${plan.max_people}`}
              label="joined"
            />
            <div className="w-px bg-border" />
            <Stat
              icon={<BarChartIcon size={16} />}
              value={formatViews(plan.views_count)}
              label="views"
            />
          </div>

          <div className="mb-5">
            <p className="section-eyebrow mb-2">Created by</p>
            <div className="flex items-center gap-2.5">
              <Avatar name={creatorName} size={30} />
              <p className="text-body font-semibold text-text-primary">{creatorName}</p>
            </div>
          </div>

          {members.length > 0 && (
            <div className="mb-5">
              <p className="section-eyebrow mb-2">People in · {members.length}</p>
              <div className="flex flex-wrap gap-2">
                {members.map((m, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-caption text-text-secondary"
                  >
                    <Avatar name={m.users?.persona_name ?? "?"} size={18} />
                    {m.users?.persona_name ?? "?"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!ended && (
            <div className="space-y-2">
              <button
                onClick={handleJoin}
                disabled={joining || alreadyJoined}
                className={
                  alreadyJoined
                    ? "btn-block flex h-11 items-center justify-center gap-2 rounded-full border border-success/35 bg-success/10 text-body font-semibold text-success"
                    : "btn-primary btn-lg btn-block"
                }
              >
                {joining ? (
                  <Spinner size={16} tone="ink" />
                ) : alreadyJoined && isCreator ? (
                  <><CheckIcon size={16} />You created this plan</>
                ) : alreadyJoined ? (
                  <><CheckIcon size={16} />You&apos;re in</>
                ) : isAuthenticated ? (
                  "Join this plan"
                ) : (
                  "Sign in to join"
                )}
              </button>

              <button onClick={handleShare} className="btn-secondary btn-lg btn-block gap-2">
                <ShareIcon size={16} />
                Share
              </button>

              {alreadyJoined && !isCreator && !confirmLeave && (
                <button onClick={() => setConfirmLeave(true)} className="btn-ghost btn-sm btn-block">
                  Leave this plan
                </button>
              )}
              {alreadyJoined && !isCreator && confirmLeave && (
                <div className="space-y-2 rounded-xl border border-border p-3">
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

              {isCreator && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)} className="btn-danger btn-block">
                  Delete this plan
                </button>
              )}
              {isCreator && confirmDelete && (
                <div className="space-y-2 rounded-xl border border-danger/30 p-3">
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
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-center text-caption text-danger">
              {error}
            </p>
          )}

          {ended && (
            <div className="rounded-xl border border-border px-3 py-2.5 text-center">
              <p className="flex items-center justify-center gap-1.5 text-body text-text-tertiary">
                <ClockIcon size={14} />
                This plan has ended
              </p>
            </div>
          )}
        </div>

        <div className="px-4">
          <PlanChat planId={plan.id} />
        </div>
      </div>
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
