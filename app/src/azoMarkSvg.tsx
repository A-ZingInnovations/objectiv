/** AZO ring mark — stroke uses currentColor (set color on parent). */
export function AzoMarkSvg({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <circle
        cx="512"
        cy="512"
        r="292"
        stroke="currentColor"
        strokeWidth="136"
        strokeLinecap="butt"
        strokeDasharray="1680 240"
        transform="rotate(-32 512 512)"
      />
    </svg>
  );
}

export const AZO_MARK_COLOR = '#0a8083';
