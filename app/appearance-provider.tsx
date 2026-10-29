'use client';
import { useLayoutEffect } from 'react';
import { APPEARANCE_EVENT, APPEARANCE_KEY, DEFAULT_APPEARANCE, textSizePoints, appearanceError, appearanceTokens, loadAppearance, type Appearance } from './appearance';

// SSR and the first hydration render both use Light. No inline bootstrap script,
// suppressed hydration warnings, hidden app, or relaxed CSP is needed.
export default function AppearanceProvider() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const stored = () => { try { return loadAppearance(window.localStorage); } catch { return { ...DEFAULT_APPEARANCE }; } };
    const apply = (value: Appearance) => {
      root.dataset.theme = value.theme;
      root.dataset.textSize = String(textSizePoints(value.size));
      root.style.colorScheme = value.theme === 'dark' ? 'dark' : 'light';
      for (const [key, color] of Object.entries(appearanceTokens(value))) root.style.setProperty(key, color);
    };
    const change = (event: Event) => {
      const detail: unknown = (event as CustomEvent).detail;
      apply(detail && !appearanceError(detail) ? detail as Appearance : stored());
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== APPEARANCE_KEY && event.key !== null) return;
      try { if (event.storageArea !== window.localStorage) return; } catch { /* denied storage falls back safely */ }
      apply(stored());
    };
    apply(stored());
    window.addEventListener(APPEARANCE_EVENT, change);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener(APPEARANCE_EVENT, change);
      window.removeEventListener('storage', storage);
    };
  }, []);
  return null;
}
