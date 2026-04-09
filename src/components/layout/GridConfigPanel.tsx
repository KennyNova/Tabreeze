import { GRID_COLUMN_OPTIONS } from "../../layout/constants";
import type { GridSpec } from "../../layout/types";

interface GridConfigPanelProps {
  grid: GridSpec;
  onGridChange: (next: GridSpec) => void;
  disabled?: boolean;
  title?: string;
  /** When false, hide column quick picks (e.g. reactive mode has its own col preference) */
  showColumnPicker?: boolean;
}

export default function GridConfigPanel({
  grid,
  onGridChange,
  disabled,
  title = "Grid",
  showColumnPicker = true,
}: GridConfigPanelProps) {
  return (
    <div className="rounded-2xl p-4 border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-blue-500/5 to-cyan-500/10 dark:from-violet-500/15 dark:via-blue-500/10 dark:to-cyan-500/10">
      <div className="text-[11px] uppercase tracking-wide mb-3 font-semibold text-violet-600/90 dark:text-violet-300/90">
        {title}
      </div>

      {showColumnPicker && (
        <div className="mb-4">
          <div className="text-xs text-gray-600/80 dark:text-white/55 mb-2">Columns</div>
          <div className="flex flex-wrap gap-2">
            {GRID_COLUMN_OPTIONS.map((cols) => (
              <button
                key={cols}
                type="button"
                disabled={disabled}
                onClick={() => onGridChange({ ...grid, cols })}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 disabled:opacity-40 ${
                  grid.cols === cols
                    ? "bg-violet-500/25 text-violet-700 dark:text-violet-200 ring-2 ring-violet-400/40"
                    : "bg-white/40 dark:bg-white/10 text-gray-700 dark:text-white/70 hover:bg-white/60 dark:hover:bg-white/15"
                }`}
              >
                {cols}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-gray-600/80 dark:text-white/55 flex justify-between">
            <span>Row height (px)</span>
            <span className="tabular-nums text-violet-600 dark:text-violet-300">{grid.rowHeight}</span>
          </span>
          <input
            type="range"
            min={72}
            max={200}
            step={2}
            disabled={disabled}
            value={grid.rowHeight}
            onChange={(e) => onGridChange({ ...grid, rowHeight: Number(e.target.value) })}
            className="w-full mt-1 accent-violet-600"
          />
        </label>

        <label className="block">
          <span className="text-xs text-gray-600/80 dark:text-white/55 flex justify-between">
            <span>Gap (px)</span>
            <span className="tabular-nums text-cyan-600 dark:text-cyan-300">{grid.gap}</span>
          </span>
          <input
            type="range"
            min={8}
            max={32}
            step={2}
            disabled={disabled}
            value={grid.gap}
            onChange={(e) => onGridChange({ ...grid, gap: Number(e.target.value) })}
            className="w-full mt-1 accent-cyan-600"
          />
        </label>
      </div>
    </div>
  );
}
