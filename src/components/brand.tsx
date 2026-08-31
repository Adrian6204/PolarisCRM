/**
 * Polaris mark — a geometric four-point "north star" built from SVG primitives
 * in the brand accent (cold-start constructed identity, not a letter in a box).
 */
export function PolarisMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* four-point sparkle */}
      <path
        d="M12 1.6c.5 4.9 2.4 7.2 8.9 8.1v.2c-6.5.9-8.4 3.2-8.9 8.1h-.2c-.5-4.9-2.4-7.2-8.9-8.1v-.2c6.5-.9 8.4-3.2 8.9-8.1h.2Z"
        fill="var(--primary)"
      />
      {/* small secondary spark */}
      <path
        d="M18.8 15.2c.2 1.9.9 2.8 3.4 3.1v.1c-2.5.3-3.2 1.2-3.4 3.1h-.1c-.2-1.9-.9-2.8-3.4-3.1v-.1c2.5-.3 3.2-1.2 3.4-3.1h.1Z"
        fill="var(--primary)"
        opacity="0.55"
      />
    </svg>
  );
}
