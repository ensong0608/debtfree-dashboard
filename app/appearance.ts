// Keep the original key: loading never rewrites or deletes a saved preference.
export const APPEARANCE_KEY = 'debtfree-device-appearance-v1';
export const APPEARANCE_EVENT = 'debtfree-appearance-change';
export const FONTS = { default: 'Inter,system-ui,sans-serif', system: 'system-ui,sans-serif', serif: 'Georgia,"Times New Roman",serif' } as const;
export const TEXT_SIZES = [10, 12, 14] as const;
export const TEXT_SIZE_LABELS = {10: 'Small', 12: 'Medium', 14: 'Large'} as const;
export type TextSize = typeof TEXT_SIZES[number] | 'standard' | 'large' | 'larger';
export function textSizePoints(size: unknown): typeof TEXT_SIZES[number] {
  const numeric = typeof size === 'number' && Number.isFinite(size) && size >= 9 && size <= 20 ? size : size === 'large' || size === 'larger' ? 14 : 12;
  return TEXT_SIZES.reduce((best, next) => Math.abs(next - numeric) <= Math.abs(best - numeric) ? next : best, TEXT_SIZES[0]);
}
export type Theme = 'light' | 'dark' | 'tomorrow';
export const THEME_LABELS = {light:'Light',dark:'Dark',tomorrow:'Sunshine'} as const;
type Colors = { accent: string; background: string; surface: string; text: string };
export type Appearance = Colors & { version: 2; theme: Theme; font: keyof typeof FONTS; size: TextSize; legacyColors?: Colors; primaryLight?: string; primaryDark?: string; primaryTomorrow?: string; darkCarousel?: string; lightCarousel?: string; tomorrowCarousel?: string };
export const PRIMARY_DEFAULTS = { light: '#295e9b', dark: '#1c1c1c', tomorrow: '#d2eee5' };
export const PRIMARY_PRESETS = {
  tomorrow: [{name:"Mint",color:"#d2eee5"},{name:"Lavender",color:"#e4dcf6"},{name:"Peach",color:"#f4d7c6"}],
  dark: [{ name: 'Midnight Navy', color: '#182b45' }, { name: 'Deep Indigo', color: '#292343' }, { name: 'Deep Teal', color: '#123639' }, { name: 'Graphite', color: '#252b35' }],
  light: [{ name: 'Blue & Slate', color: '#295e9b' }, { name: 'Lavender', color: '#e4dcf6' }, { name: 'Mint', color: '#d2eee5' }, { name: 'Silver', color: '#e1e6ed' }],
} satisfies Record<Theme, { name: string; color: string }[]>;
export function carouselKey(theme: Theme) { return theme === 'dark' ? 'darkCarousel' : theme === 'tomorrow' ? 'tomorrowCarousel' : 'lightCarousel'; }
export function primaryKey(theme: Theme) { return theme === 'dark' ? 'primaryDark' : theme === 'tomorrow' ? 'primaryTomorrow' : 'primaryLight'; }
export function primaryColor(p: Appearance, theme = p.theme) { return p[primaryKey(theme)] ?? (p.theme===theme && p.accent.toLowerCase()!==THEMES[theme].accent.toLowerCase() ? p.accent : PRIMARY_DEFAULTS[theme]); }
const PREVIOUS_LIGHT: Colors = { accent: '#0961d9', background: '#f3f7fd', surface: '#ffffff', text: '#101b31' };
const LIGHT: Colors = { accent: '#295e9b', background: '#e4ebf3', surface: '#f5f8fc', text: '#101b31' };
const OLD_DARK: Colors = { accent: '#42cfff', background: '#080e16', surface: '#131e2b', text: '#edf3ff' };
const DARK: Colors = { accent: '#42cfff', background: '#000000', surface: '#121212', text: '#edf3ff' };
export const DARK_CAROUSEL_DEFAULT = '#edab1d';
export const DEFAULT_APPEARANCE: Appearance = { version: 2, theme: 'light', font: 'default', size: 12, ...LIGHT };
export const THEMES = { tomorrow: {...DEFAULT_APPEARANCE,theme:'tomorrow',accent:'#08766f',background:'#fffaf1',surface:'#fffefa',text:'#143b45'}, light: DEFAULT_APPEARANCE, dark: { ...DEFAULT_APPEARANCE, theme: 'dark', ...DARK } } satisfies Record<Theme, Appearance>;
// Retained for the existing editor until Section 2 replaces its preset controls.
export const PRESETS = {
  mint: { ...DEFAULT_APPEARANCE, accent: '#096b5d', background: '#f7f8fc' },
  ocean: { ...DEFAULT_APPEARANCE, accent: '#24578a', background: '#f1f6fb', text: '#152a40' },
  sand: { ...DEFAULT_APPEARANCE, accent: '#795325', background: '#faf6ef', surface: '#fffdfa', text: '#30251b' },
} satisfies Record<string, Appearance>;
export function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
const colorKeys = ['accent', 'background', 'surface', 'text'] as const;
function validColors(value: unknown): value is Colors & Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && colorKeys.every(k => typeof (value as Colors)[k] === 'string' && /^#[0-9a-f]{6}$/i.test((value as Colors)[k])));
}
function readableColors(c: Colors) { return [c.background, c.surface].every(bg => contrast(c.text, bg) >= 4.5 && contrast(c.accent, bg) >= 4.5); }
function lightSurfaces(c: Colors) { return [c.background, c.surface].every(bg => contrast('#000000', bg) > contrast('#ffffff', bg)); }
export function appearanceError(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Choose valid appearance settings.';
  const p = value as Record<string, unknown>;
  if (p.version !== 2 || !['light', 'dark', 'tomorrow'].includes(p.theme as string) || typeof p.font !== 'string' || !Object.hasOwn(FONTS, p.font) || ![...TEXT_SIZES, 'standard', 'large', 'larger'].includes(p.size as never)) return 'Choose a supported theme, font and text size.';
  if (!validColors(p)) return 'Use six-digit hex colors, such as #0961d9.';
  if (['primaryLight', 'primaryDark', 'primaryTomorrow', 'darkCarousel', 'lightCarousel', 'tomorrowCarousel'].some(key => p[key] !== undefined && (typeof p[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(p[key] as string)))) return 'Use a six-digit primary color, such as #182b45.';
  if (!readableColors(p)) return 'Text and accent need more contrast against background and surface.';
  if ((p.theme !== 'dark' && !lightSurfaces(p)) || (p.theme === 'dark' && [p.background, p.surface].some(bg => contrast('#ffffff', bg) <= contrast('#000000', bg)))) return 'Choose surfaces that match the selected theme.';
  if (p.legacyColors !== undefined && (!validColors(p.legacyColors) || !readableColors(p.legacyColors) || !lightSurfaces(p.legacyColors))) return 'Saved custom colors are invalid.';
  return null;
}
function normalizeColors(p: Colors): Colors { return Object.fromEntries(colorKeys.map(k => [k, p[k].toLowerCase()])) as Colors; }
export function parseAppearance(raw: string | null): Appearance {
  if (!raw) return { ...DEFAULT_APPEARANCE };
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return { ...DEFAULT_APPEARANCE };
    if (p.version === 1) {
      // V1 was light-only. Keep usable typography even if its colors are corrupt.
      const font = typeof p.font === 'string' && Object.hasOwn(FONTS, p.font) ? p.font as Appearance['font'] : 'default';
      const size = textSizePoints(p.size);
      if (validColors(p) && readableColors(p) && lightSurfaces(p)) {
        const colors = normalizeColors(p);
        return { ...DEFAULT_APPEARANCE, font, size, ...colors, legacyColors: colors };
      }
      return { ...DEFAULT_APPEARANCE, font, size };
    }
    p.size = textSizePoints(p.size);
    if (appearanceError(p)) return { ...DEFAULT_APPEARANCE };
    // Upgrade only the former built-in Light palette in memory. Keep custom
    // surfaces, typography, the selected theme and separately saved Dark color.
    if (p.theme === 'light' && colorKeys.every(key => p[key].toLowerCase() === PREVIOUS_LIGHT[key])) Object.assign(p, LIGHT);
    // Repair only the accidentally applied built-in palette; keep Light selected,
    // custom accents/headers, typography and the separately saved Dark color.
    if (p.theme === 'light' && p.background.toLowerCase() === '#fffaf1' && p.surface.toLowerCase() === '#fffefa' && p.text.toLowerCase() === '#143b45') {
      Object.assign(p, LIGHT, {accent:p.accent.toLowerCase()==='#08766f'?LIGHT.accent:p.accent});
      if (p.primaryLight?.toLowerCase()==='#d2eee5') delete p.primaryLight;
    }
    // Upgrade only the former built-in dark surfaces; keep customized palettes and stored colors.
    if (p.theme === 'dark' && p.background.toLowerCase() === OLD_DARK.background && p.surface.toLowerCase() === OLD_DARK.surface && p.text.toLowerCase() === OLD_DARK.text && !appearanceError({...p,background:DARK.background,surface:DARK.surface})) Object.assign(p, {background:DARK.background,surface:DARK.surface});
    if (p.theme === 'dark' && p.background.toLowerCase() === '#000000' && p.surface.toLowerCase() === '#222222' && p.text.toLowerCase() === DARK.text && !appearanceError({...p,surface:DARK.surface})) p.surface = DARK.surface;
    if (p.primaryLight?.toLowerCase() === '#cfe7fa') p.primaryLight = PRIMARY_DEFAULTS.light;
    return { version: 2, theme: p.theme, font: p.font, size: p.size, ...normalizeColors(p), ...(p.legacyColors ? { legacyColors: normalizeColors(p.legacyColors) } : {}), ...(p.primaryLight ? { primaryLight: p.primaryLight.toLowerCase() } : {}), ...(p.primaryDark ? { primaryDark: p.primaryDark.toLowerCase() } : {}), ...(p.primaryTomorrow ? { primaryTomorrow: p.primaryTomorrow.toLowerCase() } : {}), ...(p.darkCarousel ? { darkCarousel: p.darkCarousel.toLowerCase() } : {}), ...(p.lightCarousel ? { lightCarousel: p.lightCarousel.toLowerCase() } : {}), ...(p.tomorrowCarousel ? { tomorrowCarousel: p.tomorrowCarousel.toLowerCase() } : {}) };
  } catch { return { ...DEFAULT_APPEARANCE }; }
}
export function withTheme(p: Appearance, theme: Theme): Appearance {
  return { ...THEMES[theme], font: p.font, size: p.size, ...(p.legacyColors ? { legacyColors: p.legacyColors } : {}), ...(p.primaryLight ? { primaryLight: p.primaryLight } : {}), ...(p.primaryDark ? { primaryDark: p.primaryDark } : {}), ...(p.primaryTomorrow ? { primaryTomorrow: p.primaryTomorrow } : {}), ...(p.darkCarousel ? { darkCarousel: p.darkCarousel } : {}), ...(p.lightCarousel ? { lightCarousel: p.lightCarousel } : {}), ...(p.tomorrowCarousel ? { tomorrowCarousel: p.tomorrowCarousel } : {}) };
}
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function loadAppearance(storage: PreferenceStorage): Appearance { return parseAppearance(storage.getItem(APPEARANCE_KEY)); }
export function saveAppearance(storage: PreferenceStorage, value: Appearance) {
  const error = appearanceError(value); if (error) throw new Error(error);
  storage.setItem(APPEARANCE_KEY, JSON.stringify(parseAppearance(JSON.stringify(value))));
}
export function resetAppearance(storage: PreferenceStorage) { storage.removeItem(APPEARANCE_KEY); }
export function appearanceFlags(p: Appearance) {
  return { colors: colorKeys.some(k => p[k] !== THEMES[p.theme][k]) || primaryColor(p) !== PRIMARY_DEFAULTS[p.theme], font: p.font !== 'default', size: textSizePoints(p.size) !== 12 };
}
function mix(a: string, b: string, amount: number) {
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * amount + parseInt(b.slice(i, i + 2), 16) * (1 - amount)).toString(16).padStart(2, '0')).join('');
}
// Shared semantic contract. Custom colors derive secondary surfaces and safe
// foregrounds rather than retaining fixed dark labels or light semantic panels.
export function appearanceTokens(p: Appearance): Record<string, string> {
  const dark = p.theme === 'dark';
  const { surface, background, text } = p;
  const storedPrimary = primaryColor(p);
  let primary = storedPrimary;
  if (dark) for(let amount=1;contrast('#ffffff',primary)<4.5&&amount>0;amount-=.02) primary=mix(storedPrimary,'#000000',Math.max(0,amount));
  const customizedPrimary = p[primaryKey(p.theme)];
  let accent = p.accent;
  if (customizedPrimary) {
    accent = primary;
    for (let amount = 1; amount >= 0 && [surface, background].some(bg => contrast(accent, bg) < 4.5); amount -= .02) accent = mix(primary, text, Math.max(0, amount));
  }
  const tint = (color: string, amount: number) => {
    let result = mix(color, surface, amount);
    while (amount > 0 && [text, accent].some(fg => contrast(fg, result) < 4.5)) {
      amount = Math.max(0, amount - .01); result = mix(color, surface, amount);
    }
    return result;
  };
  const raised = tint(text, .035);
  const accentSoft = tint(accent, .1);
  const mutedCandidate = mix(text, surface, .76);
  const readable = (candidate: string, surfaces = [surface, background, raised], ratio = 4.5) => surfaces.every(bg => contrast(candidate, bg) >= ratio) ? candidate : text;
  const on = (bg: string) => contrast('#ffffff', bg) >= 4.5 ? '#ffffff' : '#000000';
  const gradientStart=mix(accent,surface,dark?.16:.14),gradientEnd=mix(accent,background,dark?.08:.06);
  const onGradient=[gradientStart,gradientEnd].every(bg=>contrast(text,bg)>=4.5)?text:on(gradientStart);
  const headerRail = p.theme === 'tomorrow' ? mix(primary,surface,.2) : mix(primary, '#000000', .82);
  let headerSelected = p.theme === 'tomorrow' ? accent : mix(primary, on(primary), .8);
  if(dark) for(let amount=1;contrast('#ffffff',headerSelected)<4.5&&amount>0;amount-=.02) headerSelected=mix(primary,'#000000',Math.max(0,amount));
  const carousel = p[carouselKey(p.theme)] ?? (dark ? DARK_CAROUSEL_DEFAULT : gradientStart);
  const onCarousel = on(carousel);
  const carouselTone = (color:string) => contrast(color,carousel)>=4.5?color:onCarousel;
  let wordmarkBlue = '#2684ff';
  for (let amount=1;contrast(wordmarkBlue,primary)<4.5&&amount>=0;amount-=.02) wordmarkBlue=mix('#2684ff',on(primary),Math.max(0,amount));
  const t: Record<string, string> = {
    '--theme-wordmark-blue': wordmarkBlue,
    '--theme-primary': primary, '--theme-on-primary': dark ? '#ffffff' : p.theme === 'tomorrow' && contrast(text,primary)>=4.5 ? text : on(primary),
    '--theme-scenery-back': mix(primary,surface,.32), '--theme-scenery-front': mix(accent,surface,.24),
    '--theme-scenery-leaf': mix(accent,surface,.4), '--theme-scenery-sun':'#ffe0a0',
    '--theme-scenery-path':'#fff0cf', '--theme-peach':'#fff0e6',
    '--theme-header-rail': headerRail, '--theme-on-header-rail': on(headerRail),
    '--theme-header-selected': headerSelected, '--theme-on-header-selected': dark ? '#ffffff' : on(headerSelected),
    '--theme-carousel': carousel, '--theme-on-carousel': onCarousel, '--theme-carousel-success': carouselTone('#145637'), '--theme-carousel-danger': carouselTone('#8c1936'),
    '--theme-background': background, '--theme-surface': surface, '--theme-raised': raised,
    '--theme-text': text, '--theme-muted': readable(mutedCandidate), '--theme-border': mix(text, surface, .24),
    '--theme-control-border': readable(mix(text, surface, .6), [surface, background, raised], 3),
    '--theme-accent': readable(accent, [surface, background, raised, accentSoft]), '--theme-accent-fill': accent,
    '--theme-on-accent': dark && accent === DARK.accent ? '#080E16' : on(accent), '--theme-accent-soft': accentSoft,
    '--theme-strong-surface': dark ? '#262626' : '#182c4a', '--theme-on-strong': '#edf3ff',
    '--theme-track': mix(text, surface, .16), '--theme-overlay': '#030a16b3',
    '--theme-focus': readable(accent), '--theme-shadow': dark ? '#00000040' : '#17243a12',
    '--theme-chart-1': readable(dark ? '#42cfff' : accent, undefined, 3),
    '--theme-chart-2': readable(dark ? '#ab94ff' : '#7040c6', undefined, 3),
    '--theme-chart-3': readable(dark ? '#36dfb3' : '#00795d', undefined, 3),
    '--theme-chart-grid': mix(text, surface, .2),
    '--theme-art-sky': tint(accent, .08), '--theme-art-cloud': surface,
    '--theme-art-mountain-back': tint(accent, .14), '--theme-art-mountain-front': tint(text, .12),
    '--theme-art-water': tint(accent, .1), '--theme-art-tree': tint(text, .18),
    '--theme-art-sun': tint(dark ? '#ffd078' : '#855000', .14),
    '--theme-gradient-start': gradientStart, '--theme-gradient-end': gradientEnd,
    '--theme-on-gradient': onGradient,
    '--theme-summary-ring': dark ? '#82DFC4' : '#007458',
    '--theme-font': FONTS[p.font], '--theme-text-scale': String(textSizePoints(p.size) / 12),
  };
  for (const [name, candidate] of Object.entries(dark
    ? { success: '#79DDBB', warning: '#ffd078', danger: '#F3A3B7', info: '#7bcaff', violet: '#A78BFA' }
    : { success: '#007458', warning: '#855000', danger: '#b32143', info: '#095fbd', violet: '#7040b4' })) {
    const soft = tint(candidate, .08);
    t[`--theme-${name}-soft`] = soft;
    t[`--theme-${name}`] = readable(candidate, [surface, background, raised, soft]);
    // Filled buttons use a stable strong tone and a separately validated label.
    const fill = { success: '#007458', warning: '#855000', danger: '#b32143', info: '#095fbd', violet: '#7040b4' }[name as 'success' | 'warning' | 'danger' | 'info' | 'violet'];
    t[`--theme-${name}-fill`] = fill;
    t[`--theme-on-${name}`] = on(fill);
  }
  const panels = [background, surface, raised, ...Object.entries(t).filter(([key]) => key.endsWith('-soft')).map(([, color]) => color)];
  t['--theme-muted'] = readable(dark ? '#B9C0CC' : mutedCandidate, panels);
  return t;
}
