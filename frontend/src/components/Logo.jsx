import { useId } from "react";

/** FinSight mark: a planet carrying a swept "F", an orbit ring passing behind and in front, and a spark. */
export default function Logo({ size = 36, className = "" }) {
  const id = useId().replace(/:/g, "");
  const u = (name) => `${name}${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={u("p")} x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset=".52" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <radialGradient id={u("h")} cx="22" cy="17" r="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity=".34" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={u("r")} x1="2" y1="35" x2="62" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C4B5FD" />
          <stop offset=".5" stopColor="#F472B6" />
          <stop offset="1" stopColor="#C4B5FD" />
        </linearGradient>
        <linearGradient id={u("a")} x1="27" y1="28" x2="42" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CFFAFE" />
          <stop offset="1" stopColor="#67E8F9" />
        </linearGradient>
        <clipPath id={u("back")}><rect x="-10" y="-10" width="90" height="46" /></clipPath>
        <clipPath id={u("front")}><rect x="-10" y="34" width="90" height="50" /></clipPath>
      </defs>
      <g transform="rotate(-17 32 35)" clipPath={`url(#${u("back")})`}>
        <ellipse cx="32" cy="35" rx="30" ry="9.5" stroke={`url(#${u("r")})`} strokeWidth="2.4" />
      </g>
      <circle cx="32" cy="32" r="25" fill={`url(#${u("p")})`} />
      <circle cx="32" cy="32" r="25" fill={`url(#${u("h")})`} />
      <g transform="translate(-1 -2)" strokeLinejoin="round">
        <path d="M21.5 52 L20 25 C20 19.5 23 17 28 17 L47 17 L43 23.2 L30.2 24.6 C28 24.9 27 26 27 28 L27 36 Z" fill="#fff" stroke="#fff" strokeWidth=".8" />
        <path d="M27 31 L41 29.4 L37.6 35 L27 36.4 Z" fill={`url(#${u("a")})`} stroke={`url(#${u("a")})`} strokeWidth=".6" />
      </g>
      <g transform="rotate(-17 32 35)" clipPath={`url(#${u("front")})`}>
        <ellipse cx="32" cy="35" rx="30" ry="9.5" stroke={`url(#${u("r")})`} strokeWidth="2.4" />
      </g>
      <path d="M54 6 C54.7 11 56 12.3 61 13 C56 13.7 54.7 15 54 20 C53.3 15 52 13.7 47 13 C52 12.3 53.3 11 54 6Z" fill="#F9A8D4" />
    </svg>
  );
}
