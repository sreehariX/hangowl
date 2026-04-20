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
        <div className="mx-auto max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <Avatar name={persona} size={80} />
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-text-primary">
          {isNew ? "Welcome to HangOwl!" : "Welcome back!"}
        </h1>
        <p className="mb-6 text-text-secondary">Your anonymous name is</p>
        <div className="hero-surface mb-8 px-6 py-4">
          <span className="text-xl font-bold text-amber">{persona}</span>
        </div>
        <button
          onClick={() => router.push("/")}
          className="premium-button w-full py-3.5"
        >
          Go to Feed
        </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pt-12">
      <div className="mx-auto max-w-sm">
      <div className="text-center mb-8">
        <div className="text-4xl mb-4">🦉</div>
        <h1 className="mb-1 text-2xl font-semibold text-text-primary">
          {step === "email" ? "Verify your IIT-B email" : "Enter the 6-digit code"}
        </h1>
        <p className="text-sm text-text-secondary">
          {step === "email"
            ? "We send a code to your email to sign you in. Your email is only used for that. To everyone else on the app you're anonymous."
            : `We sent a code to ${email}`}
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
              className="premium-input py-3.5"
              autoFocus
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email}
            className="premium-button w-full py-3.5"
          >
            {loading ? "Sending..." : "Send verification code"}
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
                className="h-14 w-11 rounded-xl border border-border bg-navy-light/85 text-center text-xl font-bold text-text-primary transition-colors focus:border-mid-blue focus:outline-none"
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
    </div>
  );
}
