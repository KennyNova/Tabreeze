import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

interface BugReportModalProps {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { message: string; includeDiagnostics: boolean }) => Promise<void>;
}

export default function BugReportModal({ open, submitting, onClose, onSubmit }: BugReportModalProps) {
  const [message, setMessage] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSent(false);
  }, [open]);

  const trimmedMessage = useMemo(() => message.trim(), [message]);
  const canSubmit = trimmedMessage.length > 0 && consentChecked && !submitting;

  if (!open || typeof document === "undefined") return null;

  const handleSend = async () => {
    if (!consentChecked) {
      setError("Please confirm you are okay sharing the listed data.");
      return;
    }
    if (!trimmedMessage) {
      setError("Please describe the bug or pain point first.");
      return;
    }
    try {
      setError(null);
      await onSubmit({ message: trimmedMessage, includeDiagnostics });
      setSent(true);
      setMessage("");
      setConsentChecked(false);
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : "Could not send bug report.";
      setError(nextError);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[190] flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
      <button
        type="button"
        aria-label="Close bug report dialog"
        className="absolute inset-0 bg-black/45 dark:bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
        className="relative z-10 w-full max-w-2xl my-6 rounded-3xl border shadow-2xl backdrop-blur-xl p-4 sm:p-6"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-border) 72%, transparent)",
          background: "color-mix(in srgb, var(--theme-bg) 95%, transparent)",
          color: "var(--theme-text)",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 id="bug-report-title" className="text-base font-semibold theme-text">
              Report a bug
            </h2>
            <p className="text-xs mt-1 theme-text-secondary">
              We will show exactly what is sent before you confirm.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{
              color: "var(--theme-text-secondary)",
              background: "color-mix(in srgb, var(--theme-surface-hover) 70%, transparent)",
            }}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-xs theme-text-secondary">
            What happened?
            <textarea
              className="input-field mt-2 min-h-[130px]"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe what you expected, what happened, and steps to reproduce."
            />
          </label>

          <div className="rounded-2xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--theme-border) 70%, transparent)" }}>
            <h3 className="text-xs font-semibold theme-text mb-2">Data that will be sent</h3>
            <ul className="text-[11px] theme-text-secondary space-y-1">
              <li>- Your bug report message</li>
              <li>- Report type (bug_report)</li>
              <li>- Timestamp</li>
              <li>- Extension version</li>
              <li>- Current app URL (new tab page)</li>
              <li>- Browser user agent</li>
              <li>
                - Diagnostics snapshot ({includeDiagnostics ? "included" : "not included"}): theme preset,
                theme automation enabled, wallpaper enabled, onboarding completed, customize-layout visibility
              </li>
            </ul>
            <label className="mt-3 inline-flex items-center gap-2 text-xs theme-text-secondary">
              <input
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(event) => setIncludeDiagnostics(event.target.checked)}
              />
              Include diagnostics snapshot
            </label>
          </div>

          <label className="inline-flex items-center gap-2 text-xs theme-text-secondary">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
            />
            I reviewed this data and I am okay sending it to support.
          </label>

          {error ? <p className="text-[11px] text-red-500 dark:text-red-300">{error}</p> : null}
          {sent ? (
            <p className="text-[11px]" style={{ color: "color-mix(in srgb, #16a34a 78%, var(--theme-text))" }}>
              Bug report sent. Thank you for helping improve Tabreeze.
            </p>
          ) : null}

          <div className="flex items-center gap-2 justify-end">
            <button type="button" className="btn-ghost text-xs" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary text-xs" onClick={handleSend} disabled={!canSubmit}>
              {submitting ? "Sending..." : "Send bug report"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
