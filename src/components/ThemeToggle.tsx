interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

export default function ThemeToggle({ isDark, onToggle, disabled = false, disabledReason }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`glass p-2.5 transition-all duration-200 ${disabled ? "opacity-45 cursor-not-allowed" : "hover:scale-105"}`}
      title={disabled ? disabledReason ?? "Theme toggle is disabled" : isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <svg className="w-[18px] h-[18px] text-yellow-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      ) : (
        <svg className="w-[18px] h-[18px] text-gray-500/50" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
    </button>
  );
}
