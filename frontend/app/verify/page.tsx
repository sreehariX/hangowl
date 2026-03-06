"use client";

import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Step = "email" | "otp" | "welcome";

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
    if (!email.endsWith("@iitb.ac.in")) {
      setError("Only @iitb.ac.in emails are allowed");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.sendOTP(email);
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
      const data = await api.verifyOTP(email, code);
      login(data.user_id, data.persona_name, data.token);
      setPersona(data.persona_name);
      setIsNew(data.is_new);
      setStep("welcome");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  if (step === "welcome") {
    return (
      <div className="mx-auto max-w-sm px-4 pt-20 text-center">
        <div className="flex justify-center mb-6">
          <Avatar name={persona} size={80} />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          {isNew ? "Welcome to HangOwl!" : "Welcome back!"}
        </h1>
        <p className="text-text-secondary mb-6">You are now</p>
        <div className="rounded-2xl bg-surface border border-amber/30 px-6 py-4 mb-8">
          <span className="text-xl font-bold text-amber">{persona}</span>
        </div>
        <button
          onClick={() => router.push("/board")}
          className="w-full rounded-xl bg-amber py-3.5 font-semibold text-navy transition-colors hover:bg-amber-dark"
        >
          Go to Board
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 pt-20">
      <div className="text-center mb-8">
        <div className="text-4xl mb-4">🦉</div>
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          {step === "email" ? "Verify your identity" : "Enter OTP"}
        </h1>
        <p className="text-sm text-text-secondary">
          {step === "email"
            ? "Use your IIT Bombay email. We never store it."
            : `Sent to ${email}`}
        </p>
      </div>

      {step === "email" && (
        <form onSubmit={handleSendOTP} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rollnumber@iitb.ac.in"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-text-primary placeholder:text-text-muted focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
              autoFocus
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-xl bg-amber py-3.5 font-semibold text-navy transition-colors hover:bg-amber-dark disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send OTP"}
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
                className="h-14 w-11 rounded-xl border border-border bg-surface text-center text-xl font-bold text-text-primary focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
                autoFocus={i === 0}
              />
            ))}
          </div>
          {loading && (
            <p className="text-center text-sm text-text-secondary">
              Verifying...
            </p>
          )}
          <button
            onClick={() => {
              setStep("email");
              setOtp(["", "", "", "", "", ""]);
              setError("");
            }}
            className="block w-full text-center text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Use a different email
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 text-center text-sm text-error">{error}</p>
      )}
    </div>
  );
}
