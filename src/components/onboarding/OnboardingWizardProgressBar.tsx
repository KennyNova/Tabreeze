interface OnboardingWizardProgressBarProps {
  fraction: number;
}

export default function OnboardingWizardProgressBar({ fraction }: OnboardingWizardProgressBarProps) {
  const safe = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  const percent = Math.round(safe * 100);
  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Setup progress"
        className="h-[3px] w-full rounded-full overflow-hidden"
        style={{ background: "color-mix(in srgb, var(--theme-border) 48%, transparent)" }}
      >
        <div
          className="h-full transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{
            width: `${percent}%`,
            background: "color-mix(in srgb, var(--theme-accent) 85%, transparent)",
          }}
        />
      </div>
    </div>
  );
}
