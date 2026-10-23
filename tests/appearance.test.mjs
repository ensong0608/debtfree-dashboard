import assert from 'node:assert/strict';
import test from 'node:test';
import { APPEARANCE_KEY, DEFAULT_APPEARANCE, THEMES, PRESETS, withTheme, appearanceError, appearanceFlags, appearanceTokens, contrast, parseAppearance, loadAppearance, saveAppearance, resetAppearance } from '../app/appearance.ts';
const legacy = { version: 1, font: 'serif', size: 'larger', accent: '#795325', background: '#faf6ef', surface: '#fffdfa', text: '#30251b' };

test('new/reset/corrupt/unknown preferences use Light without rewriting storage', () => {
  for (const raw of [null, '', '{', 'null', '[]', JSON.stringify({ ...DEFAULT_APPEARANCE, version: 99 }), JSON.stringify({ ...DEFAULT_APPEARANCE, accent: 'red' })]) assert.deepEqual(parseAppearance(raw), DEFAULT_APPEARANCE);
  const storage = { getItem: key => { assert.equal(key, APPEARANCE_KEY); return '{damaged'; }, setItem: () => assert.fail('mount must not overwrite'), removeItem: () => assert.fail('mount must not delete') };
  assert.deepEqual(loadAppearance(storage), DEFAULT_APPEARANCE);
});
test('v1 custom colors migrate in memory with font/size and remain recoverable after theme changes', () => {
  const p = parseAppearance(JSON.stringify(legacy));
  assert.equal(p.version, 2); assert.equal(p.theme, 'light'); assert.equal(p.font, 'serif'); assert.equal(p.size, 'larger');
  for (const key of ['accent','background','surface','text']) assert.equal(p[key], legacy[key]);
  assert.deepEqual(withTheme(p, 'dark').legacyColors, p.legacyColors);
  assert.equal(withTheme(p, 'dark').font, 'serif'); assert.equal(withTheme(p, 'light').size, 'larger');
  assert.deepEqual(parseAppearance(JSON.stringify({ ...legacy, surface: '#000000' })), { ...DEFAULT_APPEARANCE, font: 'serif', size: 'larger' });
});
test('both palettes and supported customs validate theme identity and readable semantic pairs', () => {
  assert.equal(contrast('#000000', '#ffffff'), 21);
  for (const p of [...Object.values(THEMES), ...Object.values(PRESETS), { ...THEMES.dark, surface:'#202018', background:'#11110e', accent:'#ffb94c', text:'#fffdf6' }, parseAppearance(JSON.stringify(legacy)), { ...DEFAULT_APPEARANCE, accent:'#707070', text:'#707070' }]) {
    assert.equal(appearanceError(p), null);
    const t = appearanceTokens(p);
    const check=(fg,bg,min=4.5)=>assert.ok(contrast(t[`--theme-${fg}`],t[`--theme-${bg}`]) >= min, `${p.theme}: ${fg} / ${bg}`);
    for(const bg of ['background','surface','raised','accent-soft']) for(const fg of ['text','muted','accent']) check(fg,bg);
    for(const bg of ['art-sky','art-cloud','art-mountain-back','art-mountain-front','art-tree','art-water','art-sun']) check('text',bg);
    check('on-accent','accent-fill'); check('on-strong','strong-surface'); check('on-gradient','gradient-start'); check('on-gradient','gradient-end');
    for(const state of ['success','warning','danger','info','violet']) { check(state,`${state}-soft`); check('muted',`${state}-soft`); check(state,'surface'); check(`on-${state}`,`${state}-fill`); }
    for(const series of ['chart-1','chart-2','chart-3']) check(series,'surface',3);
  }
  assert.deepEqual(appearanceFlags(DEFAULT_APPEARANCE), { colors:false, font:false, size:false });
  assert.deepEqual(appearanceFlags(THEMES.dark), { colors:false, font:false, size:false });
});
test('rejects injection, invalid types, contradictory identity and unreadable custom palettes', () => {
  for (const patch of [{ font:'url(https://example.test/font)' }, { font:'__proto__' }, { size:'99px' }, { font:{ toString:'system' } }, { accent:'#fff;}' }, { surface:'#000000' }, { text:'#f3f7fd' }, { accent:'#ffffff' }, { theme:'system' }, { theme:'dark' }, {legacyColors:{...legacy,accent:'red'}}]) assert.ok(appearanceError({ ...DEFAULT_APPEARANCE, ...patch }));
});
test('save/reopen/reset affect only appearance, normalize colors, and preserve legacy originals until explicit action', () => {
  const raw=JSON.stringify(legacy); const values=new Map([['financial-sentinel','unchanged'],[APPEARANCE_KEY,raw]]); const touched=[];
  const storage={ getItem:k=>values.get(k)??null, setItem:(k,v)=>{touched.push(k);values.set(k,v);},removeItem:k=>{touched.push(k);values.delete(k);} };
  const migrated=loadAppearance(storage); assert.equal(values.get(APPEARANCE_KEY),raw);
  const value={...withTheme(migrated,'dark'), accent:'#42CFFF'};saveAppearance(storage,value);
  assert.deepEqual(loadAppearance(storage),{...value,accent:'#42cfff'});
  resetAppearance(storage);assert.deepEqual(loadAppearance(storage),DEFAULT_APPEARANCE);assert.equal(values.get('financial-sentinel'),'unchanged');
  assert.deepEqual(touched,[APPEARANCE_KEY,APPEARANCE_KEY]);
});
test('storage failures propagate for truthful UI errors; invalid saves never write', () => {
  const storage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');},removeItem:()=>{throw Error('blocked');}};
  assert.throws(()=>loadAppearance(storage),/blocked/);assert.throws(()=>saveAppearance(storage,DEFAULT_APPEARANCE),/quota/);assert.throws(()=>resetAppearance(storage),/blocked/);
  assert.throws(()=>saveAppearance({setItem:()=>assert.fail('invalid write')},{...DEFAULT_APPEARANCE,text:'#ffffff'}),/contrast/);
});
