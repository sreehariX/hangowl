"use client";

import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/primitives";
import { MailIcon, SparkleIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Step = "email" | "otp" | "welcome";

const IITB_DOMAIN = "@iitb.ac.in";

export default function VerifyPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [persona, setPersona] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNew, setIsNew] = useState(true);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const { login } = useAuth();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith(IITB_DOMAIN)) {
      setError("Only @iitb.ac.in emails are allowed");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.sendOTP(normalized);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== "")) {
      verifyOtp(next.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      const digits = text.split("");
      setOtp(digits);
      verifyOtp(text);
    }
  };

  const verifyOtp = async (code: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.verifyOTP(email.trim().toLowerCase(), code);
      login(data.user_id, data.persona_name, data.token);
      setPersona(data.persona_name);
      setIsNew(data.is_new);
      setStep("welcome");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code, try again");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  if (step === "welcome") {
    return (
      <div className="app-shell pt-12">
        <div className="mx-auto flex max-w-sm flex-col items-center text-center">
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-amber/25 blur-2xl"
            />
            <Avatar name={persona} size={88} />
          </div>
          <h1 className="mt-6 text-title font-semibold tracking-tight text-text-primary">
            {isNew ? "Welcome to HangOwl" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-body text-text-secondary">
            Your anonymous name is
          </p>
          <div className="surface-hero mt-5 w-full px-6 py-5">
            <span className="bg-gradient-gold bg-clip-text text-title font-bold tracking-tight text-transparent">
              {persona}
            </span>
          </div>
          <button
            onClick={() => router.push("/")}
            className="btn-primary btn-lg btn-block mt-8"
          >
            Enter the feed
          </button>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-text-tertiary">
            <SparkleIcon size={11} className="text-amber" />
            Keep this name — it&apos;s how people will know you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pt-12">
      <div className="mx-auto flex max-w-sm flex-col">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-surface-raised/60 text-4xl shadow-soft">
            🦉
          </div>
          <h1 className="text-title font-semibold tracking-tight text-text-primary">
            {step === "email" ? "Sign in with IIT-B" : "Enter the 6-digit code"}
          </h1>
          <p className="mx-auto mt-2 max-w-[320px] text-body text-text-secondary">
            {step === "email"
              ? "We send a code to your email to sign you in. To everyone else on HangOwl you remain anonymous."
              : `We sent a code to ${email}`}
          </p>
        </div>

        {step === "email" && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <label className="relative block">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary">
                <MailIcon size={18} />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rollnumber@iitb.ac.in"
                className="input py-3.5 pl-11"
                autoComplete="email"
                spellCheck={false}
                autoFocus
                required
              />
            </label>
            <button
              type="submit"
              disabled={loading || !email}
              className="btn-primary btn-lg btn-block"
            >
              {loading ? <Spinner size={18} tone="ink" /> : "Send verification code"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <div className="space-y-6">
            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="h-14 w-11 rounded-xl border border-border/70 bg-ink-850/70 text-center text-xl font-bold tabular-nums text-text-primary transition-colors focus:border-amber focus:bg-ink-800 focus:outline-none"
                  autoFocus={i === 0}
                />
              ))}
            </div>
            {loading && (
              <p className="flex items-center justify-center gap-2 text-body text-text-secondary">
                <Spinner size={14} /> Verifying…
              </p>
            )}
            <button
              onClick={() => {
                setStep("email");
                setOtp(["", "", "", "", "", ""]);
                setError("");
              }}
              className="block w-full text-center text-body text-text-tertiary transition-colors hover:text-text-primary"
            >
              Use a different email
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-center text-caption text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
