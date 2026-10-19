'use client';
import { useEffect, useState } from 'react';
import { APPEARANCE_EVENT, APPEARANCE_KEY, DEFAULT_APPEARANCE, FONTS, PRESETS, appearanceError, appearanceFlags, loadAppearance, resetAppearance, saveAppearance, type Appearance } from './appearance';
import styles from './appearance-settings.module.css';
import { useHouseholdMoney } from './household-currency-context';

function stored() { try { return loadAppearance(window.localStorage); } catch { return { ...DEFAULT_APPEARANCE }; } }
function announce(value?: Appearance) { window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: value })); }
export function useAppearanceSettings(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const roots = () => [...document.querySelectorAll<HTMLElement>('.app-shell[data-mobile-layout="true"]')];
    const clean = (root: HTMLElement) => { root.classList.remove(styles.colors, styles.font, styles.size); for (const key of ['accent', 'background', 'surface', 'text', 'font', 'scale']) root.style.removeProperty('--appearance-' + key); };
    let value = stored();
    const apply = () => { for (const root of roots()) {
      clean(root); const flags = appearanceFlags(value);
      if (flags.colors) { root.classList.add(styles.colors); for (const key of ['accent', 'background', 'surface', 'text'] as const) root.style.setProperty('--appearance-' + key, value[key]); }
      if (flags.font) { root.classList.add(styles.font); root.style.setProperty('--appearance-font', FONTS[value.font]); }
      if (flags.size) { root.classList.add(styles.size); root.style.setProperty('--appearance-scale', value.size === 'large' ? '1.12' : '1.24'); }
    } };
    const change = (event: Event) => { const detail = (event as CustomEvent<Appearance>).detail; value = detail && !appearanceError(detail) ? detail : stored(); apply(); };
    const storage = (event: StorageEvent) => { if (event.key === APPEARANCE_KEY || event.key === null) { value = stored(); apply(); } };
    apply();
    // Core may mark the shell after this effect's first pass.
    const observer = new MutationObserver(apply); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mobile-layout'] });
    window.addEventListener(APPEARANCE_EVENT, change); window.addEventListener('storage', storage);
    return () => { observer.disconnect(); window.removeEventListener(APPEARANCE_EVENT, change); window.removeEventListener('storage', storage); roots().forEach(clean); };
  }, [enabled]);
}

export default function AppearanceSettings() {
  const { money } = useHouseholdMoney();
  const [draft, setDraft] = useState<Appearance>({ ...DEFAULT_APPEARANCE });
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const error = appearanceError(draft);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { const value = loadAppearance(window.localStorage); setDraft(value); }
      catch { setMessage('Device preferences are unavailable. Changes cannot be saved.'); }
      setReady(true);
    }, 0);
    return () => { window.clearTimeout(timer); announce(); };
  }, []);
  const edit = (value: Appearance) => { setDraft(value); setMessage(''); announce(appearanceError(value) ? stored() : value); };
  const save = () => { try { saveAppearance(window.localStorage, draft); announce(); setMessage('Appearance saved on this device.'); } catch { setMessage('Could not save appearance. Try again.'); } };
  const cancel = () => { setDraft(stored()); announce(); setMessage('Changes canceled.'); };
  const reset = () => { try { resetAppearance(window.localStorage); setDraft({ ...DEFAULT_APPEARANCE }); announce(); setMessage('Default appearance restored.'); } catch { setMessage('Could not reset appearance. Try again.'); } };
  return <section className={styles.settings} aria-label="Appearance settings">
    <header><h2>Appearance</h2><p>Saved on this device for every account.</p></header>
    <fieldset><legend>Theme</legend><div className={styles.themes}>{Object.entries(PRESETS).map(([key, value]) => <button type="button" key={key} onClick={() => edit({ ...value, font: draft.font, size: draft.size })}>{key === 'mint' ? 'Mint · default' : key === 'ocean' ? 'Ocean' : 'Sand'}</button>)}</div></fieldset>
    <div className={styles.fields}><label>Font<select aria-label="Font" value={draft.font} onChange={e => edit({ ...draft, font: e.target.value as Appearance['font'] })}><option value="default">Helvetica / Arial</option><option value="system">System</option><option value="serif">Georgia / serif</option></select></label>
    <label>Text size<select aria-label="Text size" value={draft.size} onChange={e => edit({ ...draft, size: e.target.value as Appearance['size'] })}><option value="standard">Standard</option><option value="large">Large</option><option value="larger">Larger</option></select></label></div>
    <fieldset><legend>Colors</legend><div className={styles.fields}>{(['accent', 'background', 'surface', 'text'] as const).map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)}<input type="text" spellCheck={false} autoComplete="off" maxLength={7} value={draft[key]} aria-invalid={Boolean(error)} onChange={e => edit({ ...draft, [key]: e.target.value })}/></label>)}</div></fieldset>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.preview} aria-label="Appearance preview" style={!error ? { background: draft.background, color: draft.text, fontFamily: FONTS[draft.font], fontSize: draft.size === 'standard' ? '16px' : draft.size === 'large' ? '18px' : '20px' } : undefined}><div style={!error ? { background: draft.surface } : undefined}><strong>Live preview</strong><p>Your totals and cards keep their layout.</p><span style={!error ? { color: draft.accent } : undefined}>Sample balance · {money.format(1250)}</span></div></div>
    <div className={styles.actions}><button type="button" className="primary" disabled={!ready || Boolean(error)} onClick={save}>Save</button><button type="button" className="secondary" onClick={cancel}>Cancel</button><button type="button" className="secondary" onClick={reset}>Reset to defaults</button></div>
    {message && <p role="status">{message}</p>}
  </section>;
}
