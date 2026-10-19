export const APPEARANCE_KEY = 'debtfree-device-appearance-v1';
export const APPEARANCE_EVENT = 'debtfree-appearance-change';
export const FONTS = { default: 'Helvetica,"Helvetica Neue",Arial,sans-serif', system: 'system-ui,sans-serif', serif: 'Georgia,"Times New Roman",serif' } as const;
export type Appearance = { version: 1; font: keyof typeof FONTS; size: 'standard' | 'large' | 'larger'; accent: string; background: string; surface: string; text: string };
export const DEFAULT_APPEARANCE: Appearance = { version: 1, font: 'default', size: 'standard', accent: '#096b5d', background: '#f7f8fc', surface: '#ffffff', text: '#101b31' };
export const PRESETS = {
  mint: DEFAULT_APPEARANCE,
  ocean: { ...DEFAULT_APPEARANCE, accent: '#24578a', background: '#f1f6fb', surface: '#ffffff', text: '#152a40' },
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
export function appearanceError(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Choose valid appearance settings.';
  const p = value as Record<string, unknown>;
  if (p.version !== 1 || typeof p.font !== 'string' || typeof p.size !== 'string' || !Object.hasOwn(FONTS, p.font) || !['standard', 'large', 'larger'].includes(p.size)) return 'Choose a supported font and text size.';
  const colors = ['accent', 'background', 'surface', 'text'];
  if (colors.some(k => typeof p[k] !== 'string' || !/^#[0-9a-f]{6}$/i.test(p[k] as string))) return 'Use six-digit hex colors, such as #096b5d.';
  const c = p as unknown as Appearance;
  if ([c.background, c.surface].some(bg => contrast(c.text, bg) < 4.5 || contrast(c.accent, bg) < 4.5)) return 'Text and accent need more contrast against background and surface.';
  // Semantic rose/amber panels keep their original backgrounds and text.
  // Light surfaces keep shared fixed dark labels legible until every card uses tokens.
  if ([c.background, c.surface].some(bg => contrast('#101b31', bg) < 4.5 || contrast('#bc2042', bg) < 3)) return 'Choose lighter background and surface colors.';
  return null;
}
export function parseAppearance(raw: string | null): Appearance {
  if (!raw) return { ...DEFAULT_APPEARANCE };
  try {
    const value = JSON.parse(raw);
    if (appearanceError(value)) return { ...DEFAULT_APPEARANCE };
    return { version: 1, font: value.font, size: value.size, ...Object.fromEntries(['accent', 'background', 'surface', 'text'].map(k => [k, value[k].toLowerCase()])) } as Appearance;
  } catch { return { ...DEFAULT_APPEARANCE }; }
}
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function loadAppearance(storage: PreferenceStorage): Appearance { return parseAppearance(storage.getItem(APPEARANCE_KEY)); }
export function saveAppearance(storage: PreferenceStorage, value: Appearance) {
  const error = appearanceError(value); if (error) throw new Error(error);
  storage.setItem(APPEARANCE_KEY, JSON.stringify(parseAppearance(JSON.stringify(value))));
}
export function resetAppearance(storage: PreferenceStorage) { storage.removeItem(APPEARANCE_KEY); }
export function appearanceFlags(p: Appearance) {
  return { colors: (['accent', 'background', 'surface', 'text'] as const).some(k => p[k] !== DEFAULT_APPEARANCE[k]), font: p.font !== 'default', size: p.size !== 'standard' };
}
