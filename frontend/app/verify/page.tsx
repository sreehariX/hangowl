"use client";

import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/primitives";
import { MailIcon } from "@/components/icons";
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

  async function handleSendOTP(e: React.FormEvent) {
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
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (next.every((d) => d !== "")) verifyOtp(next.join(""));
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(""));
      verifyOtp(text);
    }
  }

  async function verifyOtp(code: string) {
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
  }

  if (step === "welcome") {
    return (
      <div className="app-shell pt-12">
        <div className="mx-auto flex max-w-sm flex-col items-center px-4 text-center">
          <Avatar name={persona} size={88} />
          <h1 className="mt-5 text-title font-semibold text-text-primary">
            {isNew ? "Welcome to HangOwl" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-body text-text-secondary">
            Your anonymous name is
          </p>
          <p className="mt-4 text-title-lg font-bold tracking-tight text-amber">
            {persona}
          </p>
          <button
            onClick={() => router.push("/")}
            className="btn-primary btn-lg btn-block mt-8"
          >
            Enter the feed
          </button>
          <p className="mt-3 text-[11px] text-text-tertiary">
            Keep this name - it&apos;s how people will know you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pt-12">
      <div className="mx-auto flex max-w-sm flex-col px-4">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 text-4xl">🦉</div>
          <h1 className="text-title font-semibold text-text-primary">
            {step === "email" ? "Sign in with IIT-B" : "Enter the 6-digit code"}
          </h1>
          <p className="mx-auto mt-2 max-w-[320px] text-body text-text-secondary">
            {step === "email"
              ? "We send a code to your email to sign you in. You remain anonymous to everyone on HangOwl."
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
                className="input pl-11"
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
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="h-14 w-11 rounded-xl border border-border bg-transparent text-center text-xl font-semibold tabular-nums text-text-primary focus:border-amber focus:outline-none"
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
          <p className="mt-4 rounded-lg bg-danger/10 px-4 py-2.5 text-center text-caption text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
