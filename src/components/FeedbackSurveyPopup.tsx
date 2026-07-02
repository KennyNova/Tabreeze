import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FeedbackSurveySnoozeOption } from "../settings/dashboardSettings";

interface FeedbackSurveyPopupProps {
  open: boolean;
  submitting: boolean;
  onSubmit: (payload: { rating: number; message: string }) => Promise<void>;
  onSnooze: (option: FeedbackSurveySnoozeOption) => void;
}

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;
const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/detail/tabreeze/nicfglggmbdhllhfeciibfbjdicgbdfa";

export default function FeedbackSurveyPopup({ open, submitting, onSubmit, onSnooze }: FeedbackSurveyPopupProps) {
  const [rating, setRating] = useState<number>(4);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [snoozeMenuAnchor, setSnoozeMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const snoozeMenuRef = useRef<HTMLDivElement | null>(null);

  const trimmedMessage = useMemo(() => message.trim(), [message]);
  const canSubmit = trimmedMessage.length > 0 && !submitting;

  if (!open) return null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setError(null);
      await onSubmit({ rating, message: trimmedMessage });
      if (rating >= 4) {
        const shouldLeaveReview = window.confirm(
          "Thank you for the great rating. Would you mind leaving a quick Chrome Web Store review?"
        );
        if (shouldLeaveReview) {
          window.open(CHROME_WEB_STORE_URL, "_blank", "noopener,noreferrer");
        }
      }
      setMessage("");
      setRating(4);
      setSnoozeMenuAnchor(null);
      onSnooze("tomorrow");
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : "Could not send feedback right now.";
      setError(nextError);
    }
  };

  return (
    <div className="feedback-survey-popup">
      <div className="feedback-survey-header">
        <h3 className="text-sm font-semibold theme-text">How are you liking Tabreeze?</h3>
        <button
          type="button"
          aria-label="Close feedback survey"
          className="feedback-survey-close"
          onClick={(event) => {
            const nextX = Math.min(event.clientX + 8, window.innerWidth - 168);
            const nextY = Math.min(event.clientY + 8, window.innerHeight - 128);
            setSnoozeMenuAnchor({ x: Math.max(8, nextX), y: Math.max(8, nextY) });
          }}
        >
          x
        </button>
      </div>

      <p className="text-[11px] theme-text-secondary leading-relaxed mb-2">
        Your voice helps shape Tabreeze. Share bugs, pain points, or feature ideas and we will review and act on what
        the community tells us.
      </p>

      <div className="feedback-survey-rating-row" role="radiogroup" aria-label="Tabreeze rating">
        {RATING_OPTIONS.map((value) => {
          const active = value <= rating;
          return (
            <button
              key={value}
              type="button"
              className={`feedback-survey-rating ${active ? "feedback-survey-rating--active" : ""}`}
              aria-checked={rating === value}
              role="radio"
              onClick={() => setRating(value)}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
            >
              <span aria-hidden="true">★</span>
            </button>
          );
        })}
      </div>

      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        className="input-field feedback-survey-textarea"
        placeholder="Tell us what is not working or what you want next..."
        rows={3}
      />

      {error ? <p className="text-[11px] mt-2 text-red-500 dark:text-red-300">{error}</p> : null}

      <div className="feedback-survey-actions">
        <button type="button" className="btn-primary text-xs" disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? "Sending..." : "Send feedback"}
        </button>
      </div>

      {snoozeMenuAnchor && typeof document !== "undefined"
        ? createPortal(
            <div className="feedback-survey-snooze-layer" onMouseDown={() => setSnoozeMenuAnchor(null)}>
              <div
                className="feedback-survey-snooze-menu"
                ref={snoozeMenuRef}
                style={{ left: `${snoozeMenuAnchor.x}px`, top: `${snoozeMenuAnchor.y}px` }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <p className="text-[11px] theme-text-secondary mb-2">Show this again:</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className="feedback-survey-chip"
                    onClick={() => {
                      setSnoozeMenuAnchor(null);
                      onSnooze("two_hours");
                    }}
                  >
                    In 2 hours
                  </button>
                  <button
                    type="button"
                    className="feedback-survey-chip"
                    onClick={() => {
                      setSnoozeMenuAnchor(null);
                      onSnooze("tomorrow");
                    }}
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    className="feedback-survey-chip"
                    onClick={() => {
                      setSnoozeMenuAnchor(null);
                      onSnooze("never");
                    }}
                  >
                    Never
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
