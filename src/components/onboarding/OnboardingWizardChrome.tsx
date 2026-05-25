interface OnboardingWizardChromeProps {
  canGoBack: boolean;
  canGoNext: boolean;
  nextLabel: string;
  showJumpToFinish?: boolean;
  onBack: () => void;
  onNext: () => void;
  onJumpToFinish?: () => void;
  onSaveLater: () => void;
  onExit: () => void;
}

export default function OnboardingWizardChrome({
  canGoBack,
  canGoNext,
  nextLabel,
  showJumpToFinish = false,
  onBack,
  onNext,
  onJumpToFinish,
  onSaveLater,
  onExit,
}: OnboardingWizardChromeProps) {
  const nextDisabledStyle = !canGoNext
    ? {
      background: "#9ca3af",
      borderColor: "#9ca3af",
      color: "#f3f4f6",
      boxShadow: "none",
    }
    : undefined;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[260] px-5 sm:px-8 py-4 sm:py-5 border-t flex items-center justify-between gap-3 backdrop-blur-xl"
      style={{
        borderColor: "color-mix(in srgb, var(--theme-border) 68%, transparent)",
        background: "color-mix(in srgb, var(--theme-bg) 94%, transparent)",
      }}
    >
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost text-sm" onClick={onSaveLater}>
          Save and continue later
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={onExit}>
          Exit
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost text-sm" onClick={onBack} disabled={!canGoBack}>
          Back
        </button>
        {showJumpToFinish && onJumpToFinish ? (
          <button type="button" className="btn-ghost text-sm" onClick={onJumpToFinish} disabled={!canGoNext}>
            Jump to review & finish
          </button>
        ) : null}
        <button
          type="button"
          className="btn-primary text-sm px-5 py-2.5 inline-flex items-center gap-1.5"
          onClick={onNext}
          disabled={!canGoNext}
          style={nextDisabledStyle}
        >
          <span>{nextLabel}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
