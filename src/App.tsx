/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { OwnerDashboard } from './components/OwnerDashboard';
import { SplashScreen } from './components/SplashScreen';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { WorkerDashboard } from './components/WorkerDashboard';
import type { AppSettings, DbMode, Language, ThemeMode, UserProfile } from './types';
import {
  apiFetch,
  flushOfflineQueue,
  getOfflineQueue,
  setAuthToken,
  useOnlineStatus,
} from './utils/api';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<DbMode>('prod');
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [booting, setBooting] = useState(true);

  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('mm_lang');
    return saved === 'en' ? 'en' : 'hi';
  });

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('mm_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const isOnline = useOnlineStatus();
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getOfflineQueue().length);

  // Sync Tailwind v4 dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('mm_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('mm_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // Restore session & public app config on startup with branded Splash reveal
  useEffect(() => {
    let active = true;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const startTime = Date.now();

    (async () => {
      try {
        const [configRes, meRes] = await Promise.allSettled([
          apiFetch<AppSettings>('/api/app/public-config'),
          apiFetch<{ user: UserProfile; mode: DbMode; appSettings?: AppSettings }>('/api/auth/me'),
        ]);
        if (!active) return;
        if (configRes.status === 'fulfilled') {
          setAppSettings(configRes.value);
        }
        if (meRes.status === 'fulfilled') {
          setUser(meRes.value.user);
          setMode(meRes.value.mode);
          if (meRes.value.appSettings) setAppSettings(meRes.value.appSettings);
          if (meRes.value.user.language) setLang(meRes.value.user.language);
          if (meRes.value.user.theme) setTheme(meRes.value.user.theme);
        }
      } finally {
        const elapsed = Date.now() - startTime;
        const minSplashMs = prefersReducedMotion ? 0 : 600;
        const waitMs = Math.max(0, minSplashMs - elapsed);
        setTimeout(() => {
          if (active) setBooting(false);
        }, waitMs);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSyncOffline = useCallback(async () => {
    if (!isOnline || !user || user.role === 'SUPER_ADMIN') return;
    try {
      const res = await flushOfflineQueue();
      setPendingSyncCount(res.remaining);
    } catch {
      setPendingSyncCount(getOfflineQueue().length);
    }
  }, [isOnline, user]);

  useEffect(() => {
    if (isOnline && user && user.role !== 'SUPER_ADMIN' && getOfflineQueue().length > 0) {
      handleSyncOffline();
    }
  }, [isOnline, user, handleSyncOffline]);

  // Keep pending count refreshed on storage changes
  useEffect(() => {
    const id = setInterval(() => {
      setPendingSyncCount(getOfflineQueue().length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const handleToggleLang = async () => {
    const next: Language = lang === 'hi' ? 'en' : 'hi';
    setLang(next);
    if (user) {
      try {
        await apiFetch('/api/auth/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ language: next }),
        });
      } catch {
        // ignore
      }
    }
  };

  const handleToggleTheme = async () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user) {
      try {
        await apiFetch('/api/auth/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ theme: next }),
        });
      } catch {
        // ignore
      }
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken('');
    setUser(null);
  };

  if (booting) {
    return <SplashScreen founderName={appSettings?.founderName || 'Raja'} />;
  }

  if (!user) {
    return (
      <AuthScreen
        lang={lang}
        theme={theme}
        appSettings={appSettings}
        onToggleLang={handleToggleLang}
        onToggleTheme={handleToggleTheme}
        onAuthenticated={(u, m) => {
          setUser(u);
          setMode(m);
          if (u.language) setLang(u.language);
        }}
      />
    );
  }

  if (user.role === 'SUPER_ADMIN') {
    return (
      <SuperAdminDashboard
        user={user}
        lang={lang}
        theme={theme}
        onToggleLang={handleToggleLang}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
        onSettingsUpdated={setAppSettings}
      />
    );
  }

  if (user.role === 'OWNER') {
    return (
      <OwnerDashboard
        user={user}
        mode={mode}
        lang={lang}
        theme={theme}
        appSettings={appSettings}
        isOnline={isOnline}
        onToggleLang={handleToggleLang}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
        onSyncOffline={handleSyncOffline}
        pendingSyncCount={pendingSyncCount}
        onUserUpdated={setUser}
      />
    );
  }

  return (
    <WorkerDashboard
      user={user}
      mode={mode}
      lang={lang}
      theme={theme}
      appSettings={appSettings}
      isOnline={isOnline}
      onToggleLang={handleToggleLang}
      onToggleTheme={handleToggleTheme}
      onLogout={handleLogout}
      onSyncOffline={handleSyncOffline}
      pendingSyncCount={pendingSyncCount}
    />
  );
}
