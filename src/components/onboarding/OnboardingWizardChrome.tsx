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
      className="sticky bottom-0 z-10 mt-4 p-4 border-t flex items-center justify-between gap-2 backdrop-blur-xl"
      style={{
        borderColor: "color-mix(in srgb, var(--theme-border) 68%, transparent)",
        background: "color-mix(in srgb, var(--theme-bg) 94%, transparent)",
      }}
    >
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost text-xs" onClick={onSaveLater}>
          Save and continue later
        </button>
        <button type="button" className="btn-ghost text-xs" onClick={onExit}>
          Exit
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost text-xs" onClick={onBack} disabled={!canGoBack}>
          Back
        </button>
        {showJumpToFinish && onJumpToFinish ? (
          <button type="button" className="btn-ghost text-xs" onClick={onJumpToFinish} disabled={!canGoNext}>
            Jump to review & finish
          </button>
        ) : null}
        <button
          type="button"
          className="btn-primary text-xs"
          onClick={onNext}
          disabled={!canGoNext}
          style={nextDisabledStyle}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
