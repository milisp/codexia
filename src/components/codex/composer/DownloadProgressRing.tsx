interface DownloadProgressRingProps {
  // 0-100, or null when total size isn't known yet (indeterminate).
  percent: number | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Small radial progress ring used to show model-download progress on the
 * dictation button. Distinct from the generic spinner used elsewhere so it
 * isn't mistaken for an LLM response loading indicator.
 */
export function DownloadProgressRing({
  percent,
  size = 16,
  strokeWidth = 2,
  className,
}: DownloadProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={percent === null ? 'Downloading' : `Downloading ${Math.round(percent)}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={percent === null ? circumference * 0.75 : offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={percent === null ? 'animate-spin origin-center' : undefined}
        style={{ transition: percent === null ? undefined : 'stroke-dashoffset 200ms ease' }}
      />
    </svg>
  );
}
