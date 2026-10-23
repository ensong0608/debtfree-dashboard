'use client';
import { useEffect, useRef, useState } from 'react';
import { APPEARANCE_EVENT, APPEARANCE_KEY, DEFAULT_APPEARANCE, FONTS, THEMES, appearanceError, loadAppearance, resetAppearance, saveAppearance, withTheme, type Appearance, type Theme } from './appearance';
import styles from './appearance-settings.module.css';

type EditableKey = 'font' | 'size' | 'accent' | 'background' | 'surface' | 'text';
const EDITABLE_KEYS: EditableKey[] = ['font', 'size', 'accent', 'background', 'surface', 'text'];
function announce(value?: Appearance) { window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: value })); }
function isAppearanceStorageEvent(event: StorageEvent) {
  if (event.key !== APPEARANCE_KEY && event.key !== null) return false;
  try { return event.storageArea === window.localStorage; } catch { return true; }
}

export default function AppearanceSettings() {
  const [draft, setDraft] = useState<Appearance>({ ...DEFAULT_APPEARANCE });
  const [saved, setSaved] = useState<Appearance>({ ...DEFAULT_APPEARANCE });
  const base = useRef<Appearance>({ ...DEFAULT_APPEARANCE });
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const error = appearanceError(draft);

  useEffect(() => {
    const readSaved = () => {
      try {
        const value = loadAppearance(window.localStorage);
        setSaved(value);
        base.current = value;
        setDraft(value);
        setStorageError(false);
        announce(value);
        return value;
      } catch {
        setStorageError(true);
        setMessage('Device preferences are unavailable. Changes cannot be saved.');
        return null;
      }
    };
    // Capture the prior base before readSaved updates it for dirty comparison.
    const onStorage = (event: StorageEvent) => {
      if (!isAppearanceStorageEvent(event)) return;
      const prior = base.current;
      try {
        const value = loadAppearance(window.localStorage);
        setSaved(value);
        base.current = value;
        setDraft(current => {
          const rebased = { ...current, theme: value.theme, legacyColors: value.legacyColors } as Appearance;
          for (const key of EDITABLE_KEYS) if (current[key] === prior[key]) (rebased as unknown as Record<string, unknown>)[key] = value[key];
          return rebased;
        });
        setStorageError(false);
        setMessage('Appearance updated from another tab.');
        announce(value);
      } catch {
        setStorageError(true);
        setMessage('Could not read the updated device preferences.');
      }
    };
    const timer = window.setTimeout(() => { readSaved(); setReady(true); }, 0);
    window.addEventListener('storage', onStorage);
    return () => { window.clearTimeout(timer); window.removeEventListener('storage', onStorage); };
  }, []);

  const edit = (key: EditableKey, value: Appearance[EditableKey]) => {
    const next = { ...draft, [key]: value } as Appearance;
    setDraft(next);
    setMessage('');
    announce(appearanceError(next) ? saved : next);
  };

  const selectTheme = (theme: Theme) => {
    try {
      // Read immediately before writing so a stale editor cannot restore old
      // typography or custom-color metadata over a newer tab's saved values.
      const current = loadAppearance(window.localStorage);
      const next = withTheme(current, theme);
      saveAppearance(window.localStorage, next);
      const prior = base.current;
      base.current = next;
      setSaved(next);
      setDraft(value => {
        const rebased = { ...value, theme: next.theme, legacyColors: next.legacyColors } as Appearance;
        for (const key of EDITABLE_KEYS) if (value[key] === prior[key]) (rebased as unknown as Record<string, unknown>)[key] = next[key];
        return rebased;
      });
      setStorageError(false);
      announce(next);
      setMessage(`${theme === 'light' ? 'Light' : 'Dark'} theme saved on this device.`);
    } catch {
      setStorageError(true);
      setMessage('Could not save the theme on this device. Try again.');
    }
  };

  const save = () => {
    try {
      const current = loadAppearance(window.localStorage);
      const next = { ...current } as Appearance;
      // Save only fields actually edited since the latest saved baseline.
      for (const key of EDITABLE_KEYS) if (draft[key] !== base.current[key]) (next as unknown as Record<string, unknown>)[key] = draft[key];
      next.theme = current.theme;
      const colorEdited = (['accent', 'background', 'surface', 'text'] as const).some(key => draft[key] !== base.current[key]);
      const customColors = { accent: draft.accent, background: draft.background, surface: draft.surface, text: draft.text };
      const legacyCandidate = { ...next, theme: 'light' as const, ...customColors, legacyColors: undefined };
      next.legacyColors = colorEdited && !appearanceError(legacyCandidate) ? customColors : current.legacyColors;
      saveAppearance(window.localStorage, next);
      setSaved(next); base.current = next; setDraft(next); setStorageError(false); announce(next);
      setMessage('Appearance saved on this device.');
    } catch {
      setStorageError(true);
      setMessage('Could not save appearance. Try again.');
    }
  };

  const cancel = () => {
    try {
      const current = loadAppearance(window.localStorage);
      setSaved(current); base.current = current; setDraft(current); setStorageError(false); announce(current);
      setMessage('Unsaved changes canceled.');
    } catch {
      setStorageError(true);
      setMessage('Could not reload saved appearance. Try again.');
    }
  };

  const reset = () => {
    try {
      resetAppearance(window.localStorage);
      setSaved({ ...DEFAULT_APPEARANCE }); base.current = { ...DEFAULT_APPEARANCE }; setDraft({ ...DEFAULT_APPEARANCE }); setStorageError(false); announce();
      setMessage('Default Light appearance restored.');
    } catch {
      setStorageError(true);
      setMessage('Could not reset appearance. Try again.');
    }
  };

  return <section className={styles.settings} aria-label="Appearance settings">
    <header><h2>Appearance</h2><p>Preferences are saved on this device.</p></header>
    <fieldset><legend>Themes</legend><div className={styles.themes} role="group" aria-label="Choose theme">
      {(Object.keys(THEMES) as Theme[]).map(theme => <button type="button" key={theme} className={`${styles.themeCard} ${saved.theme === theme ? styles.selected : ''}`} aria-pressed={saved.theme === theme} disabled={!ready || storageError} onClick={() => selectTheme(theme)}>
        <span className={`${styles.swatch} ${theme === 'dark' ? styles.darkSwatch : styles.lightSwatch}`} aria-hidden="true"><i/><i/><i/></span>
        <span className={styles.cardText}><strong>{theme === 'light' ? 'Light' : 'Dark'}</strong><small>{theme === 'light' ? 'Bright surfaces and blue accents' : 'Deep surfaces with purple and cyan accents'}</small></span>
        {saved.theme === theme && <span className={styles.check} aria-hidden="true">✓</span>}
      </button>)}
    </div></fieldset>
    <div className={styles.fields}>
      <label>Font<select aria-label="Font" value={draft.font} disabled={!ready || storageError} onChange={e => edit('font', e.target.value as Appearance['font'])}><option value="default">Helvetica / Arial</option><option value="system">System</option><option value="serif">Georgia / serif</option></select></label>
      <label>Text size<select aria-label="Text size" value={draft.size} disabled={!ready || storageError} onChange={e => edit('size', e.target.value as Appearance['size'])}><option value="standard">Standard</option><option value="large">Large</option><option value="larger">Larger</option></select></label>
    </div>
    <details className={styles.customColors}><summary>Custom colors</summary><p>Choosing Light or Dark applies that built-in palette. Older saved custom colors remain preserved for compatibility.</p>{saved.legacyColors && <button type="button" className="secondary" disabled={!ready || storageError} onClick={() => { setDraft(current => ({ ...current, theme: 'light', ...saved.legacyColors })); setMessage('Legacy custom colors previewed. Save changes to keep them active.'); announce({ ...saved, theme: 'light', ...saved.legacyColors }); }}>Preview saved custom colors</button>}<div className={styles.fields}>{(['accent', 'background', 'surface', 'text'] as const).map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)}<input type="text" spellCheck={false} autoComplete="off" maxLength={7} value={draft[key]} disabled={!ready || storageError} aria-invalid={Boolean(error)} onChange={e => edit(key, e.target.value)}/></label>)}</div></details>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.preview} aria-label="Appearance preview" style={!error ? { background: draft.background, color: draft.text, fontFamily: FONTS[draft.font], fontSize: draft.size === 'standard' ? '16px' : draft.size === 'large' ? '18px' : '20px' } : undefined}><div style={!error ? { background: draft.surface } : undefined}><strong>Preview</strong><p>Your totals and cards keep their layout.</p><span style={!error ? { color: draft.accent } : undefined}>Sample balance · $1,250</span></div></div>
    <div className={styles.actions}><button type="button" className="primary" disabled={!ready || storageError || Boolean(error)} onClick={save}>Save changes</button><button type="button" className="secondary" disabled={!ready} onClick={cancel}>Cancel edits</button><button type="button" className="secondary" disabled={!ready} onClick={reset}>Reset to Light</button></div>
    {message && <p role={storageError ? 'alert' : 'status'}>{message}</p>}
  </section>;
}
