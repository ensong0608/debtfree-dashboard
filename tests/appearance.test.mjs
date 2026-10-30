import assert from 'node:assert/strict';
import test from 'node:test';
import { APPEARANCE_KEY, DEFAULT_APPEARANCE, THEMES, PRESETS, PRIMARY_PRESETS, primaryColor, withTheme, appearanceError, appearanceFlags, appearanceTokens, contrast, parseAppearance, loadAppearance, saveAppearance, resetAppearance } from '../app/appearance.ts';
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
  for (const p of [...Object.values(THEMES), ...Object.values(PRESETS), { ...THEMES.dark, surface:'#202018', background:'#11110e', accent:'#ffb94c', text:'#fffdf6' }, parseAppearance(JSON.stringify(legacy)), { ...DEFAULT_APPEARANCE, accent:'#686868', text:'#686868' }]) {
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

test('separate primary colors survive theme changes, saving and normalization without changing financial storage', () => {
  const values = new Map([['financial-sentinel', 'unchanged']]);
  const storage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const light = {...DEFAULT_APPEARANCE, primaryLight:'#AACCEE', primaryDark:'#123639'};
  saveAppearance(storage,light);
  const dark = withTheme(loadAppearance(storage),'dark');
  assert.equal(primaryColor(dark),'#123639');
  assert.equal(primaryColor(withTheme(dark,'light')),'#aaccee');
  saveAppearance(storage,{...dark,primaryDark:'#292343'});
  assert.equal(primaryColor(withTheme(loadAppearance(storage),'light')),'#aaccee');
  assert.equal(values.get('financial-sentinel'),'unchanged');
  assert.equal(primaryColor(THEMES.dark),'#1c1c1c');
  assert.ok(appearanceError({...dark,primaryLight:'url(bad)'}));
});

test('all presets and extreme custom primary colors keep headers, segments and action labels readable', () => {
  for(const theme of ['light','dark']) for(const color of [...PRIMARY_PRESETS[theme].map(p=>p.color),'#000000','#ffffff','#ff0000','#ffff00']) {
    const p={...THEMES[theme],[theme==='dark'?'primaryDark':'primaryLight']:color};
    assert.equal(appearanceError(p),null);
    const t=appearanceTokens(p);
    for(const [fg,bg] of [['on-primary','primary'],['on-header-rail','header-rail'],['on-header-selected','header-selected'],['on-accent','accent-fill'],['accent','surface'],['accent','background']]) assert.ok(contrast(t['--theme-'+fg],t['--theme-'+bg])>=4.5,`${theme} ${color} ${fg}`);
  }
});


test('previous built-in Light preferences receive Blue & Slate without rewriting saved custom preferences', () => {
  const previous = {...DEFAULT_APPEARANCE, accent:'#0961d9', background:'#f3f7fd', surface:'#ffffff', text:'#101b31', primaryLight:'#cfe7fa', primaryDark:'#123639', font:'serif', size:'large'};
  const upgraded = parseAppearance(JSON.stringify(previous));
  for (const key of ['accent','background','surface','text']) assert.equal(upgraded[key], DEFAULT_APPEARANCE[key]);
  assert.equal(primaryColor(upgraded),'#295e9b');
  assert.equal(upgraded.primaryDark,previous.primaryDark);
  assert.equal(upgraded.font,'serif'); assert.equal(upgraded.size,'large');
  const custom = {...PRESETS.sand, primaryLight:'#aaccee', primaryDark:'#123639'};
  assert.deepEqual(parseAppearance(JSON.stringify(custom)),custom);
  assert.deepEqual(parseAppearance(JSON.stringify({...THEMES.dark,primaryLight:'#aaccee'})),{...THEMES.dark,primaryLight:'#aaccee'});
  const raw=JSON.stringify(previous);
  const storage={getItem:()=>raw,setItem:()=>assert.fail('loading does not rewrite preferences')};
  assert.deepEqual(loadAppearance(storage),upgraded);
});

test('older oversized choices clamp to 16 without losing colors; 9–11 remain supported',()=>{
 for(const size of [17,18,19,20]){
  const next=parseAppearance(JSON.stringify({...THEMES.dark,size,primaryDark:'#123639'}));
  assert.equal(next.size,16);assert.equal(next.theme,'dark');assert.equal(next.primaryDark,'#123639');
 }
 for(const size of [9,10,11])assert.equal(parseAppearance(JSON.stringify({...THEMES.dark,size})).size,size);
});


test('three themes stay distinct and repair the mistakenly modified Light palette',()=>{
 assert.deepEqual(Object.keys(THEMES).sort(),['dark','light','tomorrow']);
 const erroneous={...THEMES.light,accent:'#08766f',background:'#fffaf1',surface:'#fffefa',text:'#143b45',primaryLight:'#d2eee5',primaryDark:'#123639',font:'serif',size:15};
 const restored=parseAppearance(JSON.stringify(erroneous));
 assert.equal(restored.theme,'light');
 for(const key of ['accent','background','surface','text'])assert.equal(restored[key],THEMES.light[key]);
 assert.equal(primaryColor(restored),'#295e9b');assert.equal(restored.primaryDark,'#123639');assert.equal(restored.font,'serif');assert.equal(restored.size,15);
 const custom=parseAppearance(JSON.stringify({...erroneous,accent:'#7040b4',primaryLight:'#7040b4'}));
 assert.equal(custom.accent,'#7040b4');assert.equal(custom.primaryLight,'#7040b4');
 assert.equal(custom.background,THEMES.light.background);
 const independent={...THEMES.tomorrow,primaryTomorrow:'#e4dcf6',primaryLight:'#295e9b',primaryDark:'#123639'};
 for(const theme of ['light','dark','tomorrow']){const next=parseAppearance(JSON.stringify(withTheme(independent,theme)));assert.equal(next.theme,theme);assert.equal(next.primaryTomorrow,'#e4dcf6');assert.equal(next.primaryLight,'#295e9b');assert.equal(next.primaryDark,'#123639');}
 for(const [theme,bg,accent,primary] of [['light','#e4ebf3','#295e9b','#295e9b'],['dark','#000000','#42cfff','#1c1c1c'],['tomorrow','#fffaf1','#08766f','#d2eee5']]){const tokens=appearanceTokens(THEMES[theme]);assert.equal(tokens['--theme-background'],bg);assert.equal(tokens['--theme-accent'],accent);assert.equal(tokens['--theme-primary'],primary);}
});


test('dark surfaces and carousel upgrade old defaults without rewriting preferences or losing custom colors',()=>{
 const original={...THEMES.dark,background:'#080e16',surface:'#131e2b',primaryLight:'#295e9b',primaryDark:'#292343',darkCarousel:'#123456',font:'serif',size:15};
 const raw=JSON.stringify(original);const storage={getItem:()=>raw,setItem:()=>assert.fail('load must not rewrite')};
 const saved=loadAppearance(storage);assert.equal(saved.background,'#000000');assert.equal(saved.surface,'#121212');assert.equal(saved.primaryDark,'#292343');assert.equal(saved.darkCarousel,'#123456');assert.equal(saved.font,'serif');
 const custom={...original,background:'#101010',surface:'#282828'};assert.equal(parseAppearance(JSON.stringify(custom)).surface,'#282828');
 const across=withTheme(withTheme(saved,'light'),'dark');assert.equal(across.darkCarousel,'#123456');
 for(const color of ['#edab1d','#123456','#ffffff','#000000']){const tokens=appearanceTokens({...THEMES.dark,darkCarousel:color,primaryDark:'#ffff00'});assert.equal(tokens['--theme-carousel'],color);assert.ok(contrast(tokens['--theme-on-carousel'],color)>=4.5);assert.equal(tokens['--theme-on-primary'],'#ffffff');assert.ok(contrast(tokens['--theme-on-primary'],tokens['--theme-primary'])>=4.5);}
});


test('carousel choices persist independently per theme and the current dark default upgrades without touching storage',()=>{
 const original={...THEMES.dark,surface:'#222222',darkCarousel:'#edab1d',lightCarousel:'#aabbcc',tomorrowCarousel:'#d2eee5',font:'serif'};const raw=JSON.stringify(original);const storage={getItem:()=>raw,setItem:()=>assert.fail('loading must not write')};
 const upgraded=loadAppearance(storage);assert.equal(upgraded.surface,'#121212');assert.equal(upgraded.darkCarousel,'#edab1d');
 for(const [theme,key,expected] of [['light','lightCarousel','#aabbcc'],['dark','darkCarousel','#edab1d'],['tomorrow','tomorrowCarousel','#d2eee5']]){const value=withTheme(upgraded,theme);assert.equal(value[key],expected);assert.equal(appearanceTokens(value)['--theme-carousel'],expected);}
 const custom={...original,surface:'#303030'};assert.equal(parseAppearance(JSON.stringify(custom)).surface,'#303030');
});
