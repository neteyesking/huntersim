import {ACTIONS,SPELLS,PET_FAMILIES,RECORDS} from './catalog.js';
export const BINDING_GROUPS = [
  {name:'Movement', items:[
    ['forward','Move forward','KeyW'],['backward','Move backward','KeyS'],
    ['turnLeft','Turn left / strafe with camera steer','KeyA'],
    ['turnRight','Turn right / strafe with camera steer','KeyD'],
    ['strafeLeft','Strafe left','KeyQ'],['strafeRight','Strafe right','KeyE'],
    ['jump','Jump','Space'],['autorun','Toggle autorun','KeyN'],['walk','Toggle walk / run','NumpadDivide'],
  ]},
  {name:'Camera', items:[
    ['cameraOrbit','Orbit camera','Mouse0'],['cameraSteer','Turn hunter and camera','Mouse2'],
    ['zoomIn','Zoom in','WheelUp'],['zoomOut','Zoom out','WheelDown'],
  ]},
  {name:'Hunter abilities', items:[
    ['spell:ArcaneShot','Arcane Shot','Digit1'],['spell:AimedShot','Aimed Shot','Digit2'],
    ['spell:MultiShot','Multi-Shot','Digit3'],['spell:SerpentSting','Serpent Sting','Digit4'],
    ['spell:ScorpidSting','Scorpid Sting','Digit5'],['spell:HuntersMark',"Hunter's Mark",'Digit6'],
    ['spell:RaptorStrike','Raptor Strike','Digit7'],['spell:MongooseBite','Mongoose Bite','Digit8'],
    ['spell:RapidFire','Rapid Fire','Digit9'],['spell:SniperShot','Sniper Shot','Digit0'],
    ['spell:AspectOfTheHawk','Aspect of the Hawk','Minus'],
    ['spell:AspectOfTheBeast','Aspect of the Beast','Equal'],
  ]},
  {name:'Interface and encounter', items:[
    ['toggleAuto','Toggle Auto Shot','KeyT'],['toggleMelee','Toggle melee attack','KeyR'],['weaveCombo','Raptor Strike + Strider Kick macro','Shift+KeyR'],['toggleHitboxes','Toggle hitboxes','KeyH'],
    ['howTo','Open weaving guide','F2'],['loadSvWeave','Load SV Weave and reset encounter',''],
    ['talents','Open talents','KeyK'],['controls','Open controls','F1'],
    ['keybinds','Open keybinds','KeyB'],['closePanel','Close panel','Escape'],
    ['resetEncounter','Reset encounter',''],['clearTalents','Clear talents',''],
  ]},
];
const spellGroup=BINDING_GROUPS.find(g=>g.name==='Hunter abilities');
for(const action of ACTIONS)if(!spellGroup.items.some(([id])=>id==='spell:'+action.id))spellGroup.items.push(['spell:'+action.id,SPELLS[action.id].name,'']);
BINDING_GROUPS.push({name:'Pet commands',items:[['pet:attack','Pet attack','Shift+KeyT'],['pet:follow','Pet follow','Shift+KeyF'],['pet:stay','Pet stay',''],['training','Training settings','']]});
BINDING_GROUPS.push({name:'Pet abilities',items:[...new Set(Object.values(PET_FAMILIES).flatMap(f=>f.abilities))].map(id=>['petspell:'+id,RECORDS[id].name,''])});
export const BINDING_ITEMS=BINDING_GROUPS.flatMap(group=>group.items);
export const DEFAULT_BINDINGS=Object.fromEntries(BINDING_ITEMS.map(([id,,binding])=>[id,binding]));
const STORAGE_KEY='hunter-training-keybinds-v1';
const MODIFIERS=['Ctrl','Alt','Shift','Meta'];
const MODIFIER_CODES=new Set(['ControlLeft','ControlRight','AltLeft','AltRight','ShiftLeft','ShiftRight','MetaLeft','MetaRight']);
const CODE_PATTERN=/^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Arrow(?:Up|Down|Left|Right)|Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal)|Mouse[0-4]|Wheel(?:Up|Down)|Space|Escape|Tab|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Backquote|CapsLock)$/;

export function validBinding(chord){
  if(chord==='')return true;
  if(typeof chord!=='string')return false;
  const parts=chord.split('+');
  const code=parts.pop();
  let last=-1;
  for(const part of parts){const index=MODIFIERS.indexOf(part);if(index<=last)return false;last=index;}
  return CODE_PATTERN.test(code);
}
export function eventChord(event,code=event.code){
  if(!code||MODIFIER_CODES.has(code))return null;
  const modifiers=MODIFIERS.filter(name=>event[name.toLowerCase()+'Key']);
  return [...modifiers,code].join('+');
}
export function wheelChord(event){return eventChord(event,event.deltaY<0?'WheelUp':'WheelDown')}
export function mouseChord(event){return eventChord(event,'Mouse'+event.button)}
export function bindingLabel(chord){
  if(!chord)return 'Unbound';
  return chord.split('+').map(part=>{
    if(part.startsWith('Key'))return part.slice(3);
    if(part.startsWith('Digit'))return part.slice(5);
    if(part.startsWith('Numpad'))return 'Num '+part.slice(6);
    if(part.startsWith('Mouse'))return ['Left click','Middle click','Right click','Mouse 4','Mouse 5'][Number(part.slice(5))]||part;
    if(part==='WheelUp')return 'Wheel up';
    if(part==='WheelDown')return 'Wheel down';
    return {Minus:'-',Equal:'=',Space:'Space',Escape:'Esc',Control:'Ctrl'}[part]||part;
  }).join(' + ');
}
export function actionForChord(bindings,chord){
  if(!chord)return null;
  return BINDING_ITEMS.find(([id])=>bindings[id]===chord)?.[0]||null;
}
export function held(bindings,id,pressed){
  const chord=bindings[id];
  if(!chord)return false;
  const parts=chord.split('+'),code=parts.pop();
  if(code.startsWith('Wheel')||!pressed.has(code))return false;
  const active=[
    pressed.has('ControlLeft')||pressed.has('ControlRight')?'Ctrl':null,
    pressed.has('AltLeft')||pressed.has('AltRight')?'Alt':null,
    pressed.has('ShiftLeft')||pressed.has('ShiftRight')?'Shift':null,
    pressed.has('MetaLeft')||pressed.has('MetaRight')?'Meta':null,
  ].filter(Boolean);
  return active.join('+')===parts.join('+');
}
export function rebind(bindings,id,chord){
  if(!(id in DEFAULT_BINDINGS)||!validBinding(chord))throw new Error('Invalid keybind');
  const next={...bindings};
  const conflict=actionForChord(next,chord);
  if(conflict&&conflict!==id)next[conflict]='';
  next[id]=chord;
  return {next,conflict:conflict===id?null:conflict};
}
export function loadBindings(storage){
  try{
    const saved=JSON.parse(storage.getItem(STORAGE_KEY));
    if(!saved||typeof saved!=='object')return {...DEFAULT_BINDINGS};
    const next={...DEFAULT_BINDINGS};
    for(const [id,value] of Object.entries(saved)){
      if(id in next&&validBinding(value))next[id]=value;
    }
    const seen=new Set();
    for(const [id] of BINDING_ITEMS){
      const chord=next[id];
      if(chord&&seen.has(chord))next[id]='';
      else if(chord)seen.add(chord);
    }
    return next;
  }catch{return {...DEFAULT_BINDINGS}}
}
export function saveBindings(storage,bindings){
  try{storage.setItem(STORAGE_KEY,JSON.stringify(bindings));return true}catch{return false}
}