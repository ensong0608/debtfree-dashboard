import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTabIndex } from '../app/tab-navigation.ts';
test('horizontal tab keys wrap, support Home/End and leave normal typing/Tab untouched',()=>{
 assert.equal(nextTabIndex('ArrowRight',1,2),0);
 assert.equal(nextTabIndex('ArrowLeft',0,2),1);
 assert.equal(nextTabIndex('Home',1,2),0);
 assert.equal(nextTabIndex('End',0,2),1);
 for(const key of ['Tab','Enter','ArrowDown','x']) assert.equal(nextTabIndex(key,0,2),null);
 assert.equal(nextTabIndex('ArrowRight',0,0),null);
});
