import assert from 'node:assert/strict';
import test from 'node:test';
import { APPEARANCE_KEY, DEFAULT_APPEARANCE, PRESETS, appearanceError, appearanceFlags, contrast, parseAppearance, loadAppearance, saveAppearance, resetAppearance } from '../app/appearance.ts';

test('missing, malformed, unsupported and corrupt preferences fall back without writing', () => {
  for (const raw of [null, '', '{', 'null', '[]', JSON.stringify({ ...DEFAULT_APPEARANCE, version: 2 }), JSON.stringify({ ...DEFAULT_APPEARANCE, accent: 'red' })]) assert.deepEqual(parseAppearance(raw), DEFAULT_APPEARANCE);
  const calls = []; const storage = { getItem: key => { calls.push(key); return '{damaged'; }, setItem: () => assert.fail('mount must not overwrite'), removeItem: () => assert.fail('mount must not delete') };
  assert.deepEqual(loadAppearance(storage), DEFAULT_APPEARANCE); assert.deepEqual(calls, [APPEARANCE_KEY]);
});
test('presets pass readability and default attaches no overrides', () => {
  assert.equal(contrast('#000000', '#ffffff'), 21);
  for (const p of Object.values(PRESETS)) assert.equal(appearanceError(p), null);
  assert.deepEqual(appearanceFlags(DEFAULT_APPEARANCE), { colors: false, font: false, size: false });
  assert.deepEqual(appearanceFlags({ ...DEFAULT_APPEARANCE, font: 'serif' }), { colors: false, font: true, size: false });
});
test('rejects font/CSS injection, invalid types and unreadable colors', () => {
  for (const patch of [{ font: 'url(https://example.test/font)' }, { font: '__proto__' }, { size: '99px' }, { font: { toString: 'system' } }, { accent: '#fff;}' }, { surface: '#000000' }, { text: '#f7f8fc' }, { accent: '#ffffff' }]) assert.ok(appearanceError({ ...DEFAULT_APPEARANCE, ...patch }));
});
test('save/reopen/reset touch only appearance key, preserving financial and corrupt originals until action', () => {
  const values = new Map([['financial-sentinel', 'unchanged'], [APPEARANCE_KEY, '{corrupt']]); const touched = [];
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => { touched.push(k); values.set(k,v); }, removeItem: k => { touched.push(k); values.delete(k); } };
  loadAppearance(storage); assert.equal(values.get(APPEARANCE_KEY), '{corrupt');
  const value = { ...PRESETS.ocean, size: 'large', font: 'system', accent: '#24578A' }; saveAppearance(storage, value);
  assert.deepEqual(loadAppearance(storage), { ...value, accent: '#24578a' });
  resetAppearance(storage); assert.deepEqual(loadAppearance(storage), DEFAULT_APPEARANCE); assert.equal(values.get('financial-sentinel'), 'unchanged');
  assert.deepEqual(touched, [APPEARANCE_KEY, APPEARANCE_KEY]);
});
test('storage failures propagate for visible UI errors and invalid save never writes', () => {
  const storage = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('quota'); }, removeItem: () => { throw Error('blocked'); } };
  assert.throws(() => loadAppearance(storage), /blocked/); assert.throws(() => saveAppearance(storage, DEFAULT_APPEARANCE), /quota/); assert.throws(() => resetAppearance(storage), /blocked/);
  assert.throws(() => saveAppearance({ setItem: () => assert.fail('invalid write') }, { ...DEFAULT_APPEARANCE, text: '#ffffff' }), /contrast/);
});
