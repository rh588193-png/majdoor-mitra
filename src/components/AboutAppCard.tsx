import { ShieldCheck } from 'lucide-react';
import React from 'react';
import { t } from '../i18n';
import type { Language } from '../types';
import { BrandLogo } from './BrandLogo';

interface Props {
  lang: Language;
  founderName?: string;
  supportContact?: string;
  compact?: boolean;
}

export const AboutAppCard: React.FC<Props> = ({
  lang,
  founderName = 'Raja',
  supportContact,
  compact = false,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-4">
        <BrandLogo size={compact ? 'md' : 'lg'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t(lang, 'appName')}
            </h3>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">v1.1.0</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-orange-600 dark:text-orange-400">
            {t(lang, 'tagline')}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-blue-700 dark:text-blue-400">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Founded by {founderName}</span>
          </p>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <p>
            {lang === 'hi'
              ? 'MAJDOOR MITRA भारतीय श्रमिकों, ठेकेदारों और नियोक्ताओं के लिए दैनिक हाज़िरी, ओवरटाइम और पारदर्शी वेतन हिसाब-किताब का सुरक्षित डिजिटल प्लेटफॉर्म है।'
              : 'MAJDOOR MITRA is a transparent digital attendance, overtime, and payroll accounting platform built for Indian workers, contractors, and employers.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 dark:text-slate-400">
            <span>Owner &amp; Founder: <strong className="text-slate-800 dark:text-slate-200">{founderName}</strong></span>
            <span>Role: <strong className="text-slate-800 dark:text-slate-200">SUPER ADMIN / APP OWNER</strong></span>
            {supportContact && (
              <span>Support: <strong className="text-slate-800 dark:text-slate-200">{supportContact}</strong></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
