import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_BINDINGS,eventChord,mouseChord,wheelChord,bindingLabel,held,rebind,loadBindings,saveBindings} from './bindings.js';

test('keyboard, mouse and wheel chords use physical keys with ordered modifiers',()=>{
  assert.equal(eventChord({code:'KeyQ',shiftKey:true,ctrlKey:true,altKey:false,metaKey:false}),'Ctrl+Shift+KeyQ');
  assert.equal(mouseChord({button:2,shiftKey:false,ctrlKey:false,altKey:false,metaKey:false}),'Mouse2');
  assert.equal(wheelChord({deltaY:-1,shiftKey:false,ctrlKey:false,altKey:false,metaKey:false}),'WheelUp');
  assert.equal(bindingLabel('Ctrl+Shift+KeyQ'),'Ctrl + Shift + Q');
});

test('rebinding moves a conflicting key and held controls respect modifiers',()=>{
  const {next,conflict}=rebind(DEFAULT_BINDINGS,'strafeRight','KeyW');
  assert.equal(conflict,'forward');
  assert.equal(next.forward,'');
  assert.equal(next.strafeRight,'KeyW');
  const modified=rebind(next,'forward','Shift+KeyW').next;
  assert.equal(held(modified,'forward',new Set(['ShiftLeft','KeyW'])),true);
  assert.equal(held(modified,'forward',new Set(['KeyW'])),false);
  assert.equal(held(modified,'strafeRight',new Set(['ShiftLeft','KeyW'])),false);
});

test('saved bindings load with defaults and survive malformed storage',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const altered=rebind(DEFAULT_BINDINGS,'spell:MultiShot','Ctrl+KeyF').next;
  assert.equal(saveBindings(storage,altered),true);
  assert.equal(loadBindings(storage)['spell:MultiShot'],'Ctrl+KeyF');
  values.set('hunter-training-keybinds-v1','{broken');
  assert.deepEqual(loadBindings(storage),DEFAULT_BINDINGS);
});