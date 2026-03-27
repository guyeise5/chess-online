import { useId } from "react";

/**
 * UK: inline SVG. Israel: bundled file from Wikimedia Commons (served from /flags/, not a runtime CDN).
 * Original SVG: https://upload.wikimedia.org/wikipedia/commons/d/d4/Flag_of_Israel.svg
 */

export function FlagGb(props: { className?: string }) {
  const { className } = props;
  const clipId = useId().replace(/:/g, "");
  return (
    <svg {...(className !== undefined && className !== "" ? { className } : {})} viewBox="0 0 60 30" width="28" height="14" aria-hidden>
      <clipPath id={clipId}>
        <path d="M0 0h60v30H0z" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <path fill="#012169" d="M0 0h60v30H0z" />
        <path stroke="#fff" strokeWidth="6" d="M0 0l60 30M60 0L0 30" />
        <path stroke="#C8102E" strokeWidth="4" d="M0 0l60 30M60 0L0 30" />
        <path stroke="#fff" strokeWidth="10" d="M30 0v30M0 15h60" />
        <path stroke="#C8102E" strokeWidth="6" d="M30 0v30M0 15h60" />
      </g>
    </svg>
  );
}

export function FlagIl(props: { className?: string }) {
  const { className } = props;
  return (
    <img
      src="/flags/flag-il.svg"
      width={28}
      height={14}
      alt=""
      decoding="async"
      {...(className !== undefined && className !== "" ? { className } : {})}
      style={{ display: "block", objectFit: "cover" }}
      aria-hidden
    />
  );
}
