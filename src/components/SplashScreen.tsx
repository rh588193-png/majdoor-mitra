import React from 'react';
import { BrandLogo } from './BrandLogo';

interface Props {
  founderName?: string;
}

export const SplashScreen: React.FC<Props> = ({ founderName = 'Raja' }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-slate-950 px-6 py-12 text-white">
      <div className="h-6" />

      <div className="flex flex-col items-center text-center">
        <BrandLogo size="xl" className="rounded-2xl shadow-2xl ring-1 ring-white/15" />
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
          MAJDOOR MITRA
        </h1>
        <p className="mt-2 text-sm font-medium text-orange-400">
          मजदूर का साथी, हिसाब में पारदर्शिता
        </p>
        <div className="mt-8 h-1 w-32 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs font-semibold tracking-wide text-slate-400">
          Founded by <span className="text-white">{founderName}</span>
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Digital Attendance &amp; Transparent Payroll Platform
        </p>
      </div>
    </div>
  );
};
