'use client';
import TitleSelect from './title-select';
import { useEffect, useRef, useState } from 'react';
import { APPEARANCE_EVENT, APPEARANCE_KEY, DEFAULT_APPEARANCE, FONTS, THEME_LABELS, primaryKey as themePrimaryKey, PRIMARY_PRESETS, TEXT_SIZES, textSizePoints, primaryColor, DARK_CAROUSEL_DEFAULT, appearanceError, appearanceTokens, loadAppearance, saveAppearance, withTheme, type Appearance, type Theme } from './appearance';
import type { CSSProperties } from 'react';
import styles from './appearance-settings.module.css';

type EditableKey = 'font' | 'size' | 'accent' | 'background' | 'surface' | 'text' | 'primaryLight' | 'primaryDark' | 'primaryTomorrow' | 'darkCarousel';
const EDITABLE_KEYS: EditableKey[] = ['font', 'size', 'accent', 'background', 'surface', 'text', 'primaryLight', 'primaryDark', 'primaryTomorrow', 'darkCarousel'];
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
  const primaryKey = themePrimaryKey(draft.theme);
  const previewTokens = !error ? appearanceTokens(draft) : undefined;

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
    if(key==='accent') next[primaryKey]=draft.theme==='tomorrow' && value==='#08766f' ? '#d2eee5' : String(value);
    setDraft(next);
    setMessage('');
    if (appearanceError(next)) return;
    try {
      const current = loadAppearance(window.localStorage);
      const merged = { ...current } as Appearance;
      for (const field of EDITABLE_KEYS) if (next[field] !== base.current[field]) (merged as unknown as Record<string, unknown>)[field] = next[field];
      const customColors = { accent: merged.accent, background: merged.background, surface: merged.surface, text: merged.text };
      if (['accent', 'background', 'surface', 'text'].includes(key) && !appearanceError({ ...merged, theme: 'light', legacyColors: undefined })) merged.legacyColors = customColors;
      saveAppearance(window.localStorage, merged);
      setSaved(merged); base.current = merged; setDraft(merged); announce(merged);
      setMessage('Saved on this device.');
    } catch {
      setMessage('Could not save appearance. Try again.');
    }
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
      setMessage(`${THEME_LABELS[theme]} theme saved on this device.`);
    } catch {
      setStorageError(true);
      setMessage('Could not save the theme on this device. Try again.');
    }
  };

  const accents = draft.theme === 'dark' ? [{name:'Cyan',color:'#42cfff'},{name:'Purple',color:'#a78bfa'},{name:'Teal',color:'#79ddbb'},{name:'Graphite',color:'#b9c0cc'}] : [...(draft.theme==='tomorrow'?[{name:'Mint',color:'#08766f'}]:[]),{name:'Blue',color:'#295e9b'},{name:'Purple',color:'#7040b4'},{name:'Teal',color:'#007458'},{name:'Graphite',color:'#495262'}];
  return <section className={`${styles.settings} appearance-board`} aria-label="Appearance settings">
    <fieldset className="appearance-theme-section"><legend>Theme</legend><div className={styles.themes} role="group" aria-label="Choose theme">{(['light','dark','tomorrow'] as Theme[]).map(theme=><button type="button" key={theme} className={`${styles.themeCard} ${saved.theme===theme?styles.selected:''}`} aria-pressed={saved.theme===theme} disabled={!ready||storageError} onClick={()=>selectTheme(theme)}><span className={`${styles.swatch} ${theme==='dark'?styles.darkSwatch:theme==='tomorrow'?styles.tomorrowSwatch:styles.lightSwatch}`} aria-hidden="true"><i/><i/><i/><i/><i/></span><span className={styles.cardText}><i className="appearance-radio" aria-hidden="true">{saved.theme===theme?'✓':''}</i><strong>{THEME_LABELS[theme]}</strong></span></button>)}</div></fieldset>
    <fieldset className="appearance-accents"><legend>Accent color</legend><div>{accents.map(accent=><button type="button" key={accent.name} aria-pressed={draft.accent.toLowerCase()===accent.color} disabled={!ready||storageError} onClick={()=>edit('accent',accent.color)}><span style={{background:accent.color}}>{draft.accent.toLowerCase()===accent.color?'✓':''}</span><small>{accent.name}</small></button>)}</div></fieldset>
    {draft.theme==='dark' && <fieldset className={styles.carouselColor}><legend>Carousel color</legend><label><input type="color" aria-label="Carousel color" value={draft.darkCarousel??DARK_CAROUSEL_DEFAULT} disabled={!ready||storageError} onChange={e=>edit('darkCarousel',e.target.value)}/><span>{(draft.darkCarousel??DARK_CAROUSEL_DEFAULT).toUpperCase()}</span></label></fieldset>}
    <fieldset className="appearance-text-size"><legend>Text size</legend><div><label className={styles.sizeField}><span className="sr-only">Text size</span><TitleSelect aria-label="Text size" value={textSizePoints(draft.size)} disabled={!ready||storageError} onChange={e=>edit('size',Number(e.target.value) as Appearance['size'])}>{TEXT_SIZES.map(size=><option key={size} value={size}>{size} pt</option>)}</TitleSelect></label></div></fieldset>
    <div className={styles.preview} aria-label="Appearance preview" style={!error ? {...previewTokens,fontFamily:FONTS[draft.font]} as CSSProperties : undefined}><h3>Preview</h3><div className="appearance-summary-preview"><span>Sample balance</span><strong>$1,250.00</strong><div className="appearance-preview-progress"><i/><span>62%</span></div></div></div>
    <details className={styles.customColors}><summary><span>Advanced colors</span><span aria-hidden="true">›</span></summary><fieldset className={styles.primaryColors}><legend>Header color · {THEME_LABELS[draft.theme]}</legend><div className={styles.colorPresets}>{PRIMARY_PRESETS[draft.theme].map(preset=><button type="button" key={preset.name} aria-pressed={primaryColor(draft).toLowerCase()===preset.color} disabled={!ready||storageError} onClick={()=>edit(primaryKey,preset.color)}><span style={{background:preset.color}}/>{preset.name}</button>)}</div><div className={styles.colorPicker}><label>Custom color<input type="color" aria-label="Custom primary color" value={/^#[0-9a-f]{6}$/i.test(primaryColor(draft))?primaryColor(draft):primaryColor(saved)} disabled={!ready||storageError} onChange={e=>edit(primaryKey,e.target.value)}/></label><label>Hex color<input aria-label="Primary color hex" value={draft[primaryKey]??primaryColor(draft)} maxLength={7} disabled={!ready||storageError} aria-invalid={Boolean(error)} onChange={e=>edit(primaryKey,e.target.value)}/></label></div></fieldset><div className={styles.fields}>{(['accent','background','surface','text'] as const).map(key=><label key={key}>{key[0].toUpperCase()+key.slice(1)}<input spellCheck={false} maxLength={7} value={draft[key]} disabled={!ready||storageError} aria-invalid={Boolean(error)} onChange={e=>edit(key,e.target.value)}/></label>)}</div><label className="appearance-font">Font<TitleSelect aria-label="Font" value={draft.font} disabled={!ready||storageError} onChange={e=>edit('font',e.target.value as Appearance['font'])}><option value="default">Helvetica / Arial</option><option value="system">System</option><option value="serif">Georgia / serif</option></TitleSelect></label>{saved.legacyColors&&<button className="secondary" type="button" onClick={()=>{const next={...saved,theme:'light' as const,...saved.legacyColors};try{saveAppearance(window.localStorage,next);setSaved(next);base.current=next;setDraft(next);announce(next);}catch{setMessage('Could not save appearance. Try again.');}}}>Use saved custom colors</button>}</details>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{message&&<p className="appearance-message" role={storageError?'alert':'status'}>{message}</p>}
  </section>;
}
