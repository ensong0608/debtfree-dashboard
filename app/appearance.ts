// Keep the original key: loading never rewrites or deletes a saved preference.
export const APPEARANCE_KEY = 'debtfree-device-appearance-v1';
export const APPEARANCE_EVENT = 'debtfree-appearance-change';
export const FONTS = { default: 'Helvetica,"Helvetica Neue",Arial,sans-serif', system: 'system-ui,sans-serif', serif: 'Georgia,"Times New Roman",serif' } as const;
export type Theme = 'light' | 'dark';
type Colors = { accent: string; background: string; surface: string; text: string };
export type Appearance = Colors & { version: 2; theme: Theme; font: keyof typeof FONTS; size: 'standard' | 'large' | 'larger'; legacyColors?: Colors };
const LIGHT: Colors = { accent: '#0961d9', background: '#f3f7fd', surface: '#ffffff', text: '#101b31' };
const DARK: Colors = { accent: '#42cfff', background: '#080e16', surface: '#131e2b', text: '#edf3ff' };
export const DEFAULT_APPEARANCE: Appearance = { version: 2, theme: 'light', font: 'default', size: 'standard', ...LIGHT };
export const THEMES = { light: DEFAULT_APPEARANCE, dark: { ...DEFAULT_APPEARANCE, theme: 'dark', ...DARK } } satisfies Record<Theme, Appearance>;
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
  if (p.version !== 2 || !['light', 'dark'].includes(p.theme as string) || typeof p.font !== 'string' || !Object.hasOwn(FONTS, p.font) || !['standard', 'large', 'larger'].includes(p.size as string)) return 'Choose a supported theme, font and text size.';
  if (!validColors(p)) return 'Use six-digit hex colors, such as #0961d9.';
  if (!readableColors(p)) return 'Text and accent need more contrast against background and surface.';
  if ((p.theme === 'light' && !lightSurfaces(p)) || (p.theme === 'dark' && [p.background, p.surface].some(bg => contrast('#ffffff', bg) <= contrast('#000000', bg)))) return 'Choose surfaces that match the selected theme.';
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
      const size = ['standard', 'large', 'larger'].includes(p.size) ? p.size as Appearance['size'] : 'standard';
      if (validColors(p) && readableColors(p) && lightSurfaces(p)) {
        const colors = normalizeColors(p);
        return { ...DEFAULT_APPEARANCE, font, size, ...colors, legacyColors: colors };
      }
      return { ...DEFAULT_APPEARANCE, font, size };
    }
    if (appearanceError(p)) return { ...DEFAULT_APPEARANCE };
    return { version: 2, theme: p.theme, font: p.font, size: p.size, ...normalizeColors(p), ...(p.legacyColors ? { legacyColors: normalizeColors(p.legacyColors) } : {}) };
  } catch { return { ...DEFAULT_APPEARANCE }; }
}
export function withTheme(p: Appearance, theme: Theme): Appearance {
  return { ...THEMES[theme], font: p.font, size: p.size, ...(p.legacyColors ? { legacyColors: p.legacyColors } : {}) };
}
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function loadAppearance(storage: PreferenceStorage): Appearance { return parseAppearance(storage.getItem(APPEARANCE_KEY)); }
export function saveAppearance(storage: PreferenceStorage, value: Appearance) {
  const error = appearanceError(value); if (error) throw new Error(error);
  storage.setItem(APPEARANCE_KEY, JSON.stringify(parseAppearance(JSON.stringify(value))));
}
export function resetAppearance(storage: PreferenceStorage) { storage.removeItem(APPEARANCE_KEY); }
export function appearanceFlags(p: Appearance) {
  return { colors: colorKeys.some(k => p[k] !== THEMES[p.theme][k]), font: p.font !== 'default', size: p.size !== 'standard' };
}
function mix(a: string, b: string, amount: number) {
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * amount + parseInt(b.slice(i, i + 2), 16) * (1 - amount)).toString(16).padStart(2, '0')).join('');
}
// Shared semantic contract. Custom colors derive secondary surfaces and safe
// foregrounds rather than retaining fixed dark labels or light semantic panels.
export function appearanceTokens(p: Appearance): Record<string, string> {
  const dark = p.theme === 'dark';
  const { surface, background, text, accent } = p;
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
  const t: Record<string, string> = {
    '--theme-background': background, '--theme-surface': surface, '--theme-raised': raised,
    '--theme-text': text, '--theme-muted': readable(mutedCandidate), '--theme-border': mix(text, surface, .24),
    '--theme-control-border': readable(mix(text, surface, .6), [surface, background, raised], 3),
    '--theme-accent': readable(accent, [surface, background, raised, accentSoft]), '--theme-accent-fill': dark ? '#5842c4' : accent,
    '--theme-on-accent': on(dark ? '#5842c4' : accent), '--theme-accent-soft': accentSoft,
    '--theme-strong-surface': dark ? '#19263c' : '#182c4a', '--theme-on-strong': '#edf3ff',
    '--theme-track': mix(text, surface, .16), '--theme-overlay': '#030a16b3',
    '--theme-focus': readable(accent), '--theme-shadow': dark ? '#00000040' : '#17243a12',
    '--theme-chart-1': readable(dark ? '#42cfff' : '#0961d9', undefined, 3),
    '--theme-chart-2': readable(dark ? '#ab94ff' : '#7040c6', undefined, 3),
    '--theme-chart-3': readable(dark ? '#36dfb3' : '#00795d', undefined, 3),
    '--theme-chart-grid': mix(text, surface, .2),
    '--theme-art-sky': tint(accent, .08), '--theme-art-cloud': surface,
    '--theme-art-mountain-back': tint(accent, .14), '--theme-art-mountain-front': tint(text, .12),
    '--theme-art-water': tint(accent, .1), '--theme-art-tree': tint(text, .18),
    '--theme-art-sun': tint(dark ? '#ffd078' : '#855000', .14),
    '--theme-gradient-start': dark ? '#302276' : '#dfeeff', '--theme-gradient-end': dark ? '#142d4b' : '#eff8ff',
    '--theme-on-gradient': dark ? '#edf3ff' : '#101b31',
    '--theme-font': FONTS[p.font], '--theme-text-scale': p.size === 'large' ? '1.12' : p.size === 'larger' ? '1.24' : '1',
  };
  for (const [name, candidate] of Object.entries(dark
    ? { success: '#4ee3bb', warning: '#ffd078', danger: '#ff9cad', info: '#7bcaff', violet: '#b6a1ff' }
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
  t['--theme-muted'] = readable(mutedCandidate, panels);
  return t;
}
