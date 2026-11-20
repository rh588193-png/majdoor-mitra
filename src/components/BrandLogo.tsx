import React from 'react';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
};

export const BrandLogo: React.FC<Props> = ({ size = 'md', className = '' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      aria-label="MAJDOOR MITRA Logo"
      className={`${SIZE_MAP[size]} shrink-0 rounded-xl shadow-sm ${className}`}
    >
      <defs>
        <linearGradient id="mm-ui-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>
        <linearGradient id="mm-ui-helmet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#mm-ui-bg)" />
      <rect
        x="28"
        y="28"
        width="456"
        height="456"
        rx="92"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.14"
        strokeWidth="4"
      />
      <path d="M132 232c0-68.5 55.5-124 124-124s124 55.5 124 124H132z" fill="url(#mm-ui-helmet)" />
      <rect x="238" y="90" width="36" height="54" rx="14" fill="#FDBA74" />
      <rect x="108" y="220" width="296" height="30" rx="15" fill="#F97316" />
      <rect x="144" y="284" width="224" height="132" rx="22" fill="#FFFFFF" />
      <path d="M184 328h104M184 366h74" stroke="#1D4ED8" strokeWidth="18" strokeLinecap="round" />
      <circle cx="322" cy="364" r="24" fill="#EA580C" />
      <path
        d="M311 364l8 8 15-16"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
