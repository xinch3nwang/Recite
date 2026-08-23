interface ProgressBarProps {
  progress: number;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <div className="fixed left-0 top-0 z-50 h-1 w-full bg-stone-200/50">
      <div
        className="h-full origin-left bg-gradient-to-r from-amber-500 to-amber-400 transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${clamped / 100})` }}
        aria-hidden="true"
      />
    </div>
  );
}
