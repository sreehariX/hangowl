"use client";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-sm px-4 pt-12 pb-24">
      <div className="text-center mb-10">
        <div className="text-5xl mb-3">🦉</div>
        <h1 className="text-2xl font-bold text-text-primary">Just call me if you face any issues, available 24x7 on call</h1>
        <p className="text-sm text-text-secondary mt-2">
          Built by <span className="text-amber font-semibold">Sreehari</span>
        </p>
      </div>

      <div className="space-y-4">
        <a
          href="tel:+918639012320"
          className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-all hover:bg-surface-hover hover:border-amber/30 active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber/10 text-xl">
            📞
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Phone</p>
            <p className="text-sm text-text-secondary">+91 8639012320</p>
          </div>
          <span className="text-text-muted text-sm">&rarr;</span>
        </a>

        <a
          href="mailto:sreeharixe@gmail.com"
          className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-all hover:bg-surface-hover hover:border-amber/30 active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-mid-blue/10 text-xl">
            📧
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Email</p>
            <p className="text-sm text-text-secondary">sreeharixe@gmail.com</p>
          </div>
          <span className="text-text-muted text-sm">&rarr;</span>
        </a>

        <a
          href="https://www.linkedin.com/in/sreeharix/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-all hover:bg-surface-hover hover:border-amber/30 active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0A66C2]/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-[#0A66C2]">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">LinkedIn</p>
            <p className="text-sm text-text-secondary">in/sreeharix</p>
          </div>
          <span className="text-text-muted text-sm">&rarr;</span>
        </a>
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-text-secondary leading-relaxed">
          HangOwl is built for the IIT Bombay students.
          Got feedback, bugs, or ideas? Reach out anytime.
        </p>
      </div>
    </div>
  );
}
