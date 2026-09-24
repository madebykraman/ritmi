/* Ritmi 4.0 storage v7
   Local-first boot: the UI never waits for IndexedDB.
   IndexedDB remains the richer local backend when available.
*/
(()=>{'use strict';
const DB_NAME='ritmi-local-v4',DB_VERSION=2,APP_KEY='ritmi-v3',LOCAL_KEY='ritmi-local-v7';
const OLD_KEYS=['ritmi-v2','ritmi-v1','ritmi'];
const STORES=['meta','profiles','periods','logs','notes','settings','customSignals','reminders','communityDrafts'];
const clone=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>({version:4,settings:{cycleLength:28,periodLength:5,mode:'self',reduceMotion:false,privateDisplay:false},profiles:[{id:'self',name:'My cycle',type:'self'}],activeProfile:'self',periods:[],logs:{},notes:{},cycles:[],customSignals:[],reminders:[],communityDrafts:[],onboarded:false});
function migrate(x){const n=fresh();n.settings={...n.settings,...(x?.settings||{})};n.profiles=Array.isArray(x?.profiles)&&x.profiles.length?x.profiles:n.profiles;n.activeProfile=x?.activeProfile||n.profiles[0].id;n.periods=Array.isArray(x?.periods)?x.periods:(Array.isArray(x?.cycles)?x.cycles:[]);n.logs=x?.logs&&typeof x.logs==='object'?x.logs:{};n.notes=x?.journal&&typeof x.journal==='object'?x.journal:(x?.notes||{});n.customSignals=Array.isArray(x?.customSignals)?x.customSignals:(Array.isArray(x?.customFields)?x.customFields:[]);n.reminders=Array.isArray(x?.reminders)?x.reminders:[];n.communityDrafts=Array.isArray(x?.communityDrafts)?x.communityDrafts:[];n.onboarded=!!x?.onboarded;return n}
const meaningful=x=>!!(x?.onboarded||x?.periods?.length||Object.keys(x?.logs||{}).length||Object.keys(x?.notes||{}).length||x?.profiles?.length>1||x?.communityDrafts?.length);
let memory=fresh(),idb=null,idbReady=false,upgradePending=false;
function localRead(){try{const raw=localStorage.getItem(LOCAL_KEY)||localStorage.getItem(APP_KEY)||OLD_KEYS.map(k=>localStorage.getItem(k)).find(Boolean);return raw?migrate(JSON.parse(raw)):fresh()}catch{return fresh()}}
function localWrite(x){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(x));return true}catch{return false}}
memory=localRead();
if(!memory._savedAt)delete memory._savedAt;
const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error||Error('IndexedDB request failed'))});
function open(){return new Promise((res,rej)=>{if(!window.indexedDB)return rej(Error('IndexedDB unavailable'));let r;try{r=indexedDB.open(DB_NAME,DB_VERSION)}catch(e){rej(e);return}r.onupgradeneeded=()=>{const db=r.result;for(const name of STORES){let os;if(!db.objectStoreNames.contains(name))os=db.createObjectStore(name,{keyPath:'id'});else os=r.transaction.objectStore(name);if(['periods','logs','notes','customSignals','reminders','communityDrafts'].includes(name)&&!os.indexNames.contains('profileId'))os.createIndex('profileId','profileId',{unique:false})}};r.onblocked=()=>rej(Error('IndexedDB upgrade blocked'));r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{try{db.close()}catch{}};db.onclose=()=>{if(idb===db){idbReady=false;idb=null}};res(db)};r.onerror=()=>rej(r.error||Error('IndexedDB open failed'))})}
const all=(db,s)=>req(db.transaction(s).objectStore(s).getAll());
async function clear(db,s){await req(db.transaction(s,'readwrite').objectStore(s).clear())}
async function put(db,s,v){await req(db.transaction(s,'readwrite').objectStore(s).put(v))}
async function clearProfile(db,s,profileId){const tx=db.transaction(s,'readwrite'),os=tx.objectStore(s);const rows=await req(os.getAll());for(const row of rows)if(row.profileId===profileId)await req(os.delete(row.id))}
async function writeSnapshot(db,D){
 await clear(db,'profiles');await clear(db,'settings');await clear(db,'communityDrafts');
 for(const p of D.profiles||[])await put(db,'profiles',{...clone(p),id:p.id});
 await put(db,'settings',{id:'global',value:clone(D.settings||{})});
 const profiles=(D.profiles||[]).map(p=>p.id),fallback=profiles[0]||'self',active=D.activeProfile||fallback;
 for(const profileId of profiles){
  if(profileId===active){for(const s of ['periods','logs','notes','customSignals','reminders'])await clearProfile(db,s,profileId)}
  const periodValues=profileId===active?D.periods||[]:[];
  for(let i=0;i<periodValues.length;i++){const o=typeof periodValues[i]==='string'?{date:periodValues[i]}:{...periodValues[i]};await put(db,'periods',{id:o.id||`period-${profileId}-${o.date}-${i}`,profileId,...o})}
  const logs=profileId===active?D.logs||{}:{};for(const [date,value] of Object.entries(logs))await put(db,'logs',{id:`log-${profileId}-${date}`,profileId,date,value:clone(value)});
  const notes=profileId===active?D.notes||{}:{};for(const [date,value] of Object.entries(notes))await put(db,'notes',{id:`note-${profileId}-${date}`,profileId,date,value});
  const signals=profileId===active?D.customSignals||[]:[];for(const s of signals)await put(db,'customSignals',{id:`signal-${profileId}-${s.id||s.key}`,signalId:s.id||s.key,profileId,name:s.name});
  const reminders=profileId===active?D.reminders||[]:[];for(let i=0;i<reminders.length;i++)await put(db,'reminders',{id:`reminder-${profileId}-${i}`,profileId,value:clone(reminders[i])});
 }
 for(let i=0;i<(D.communityDrafts||[]).length;i++)await put(db,'communityDrafts',{id:D.communityDrafts[i]?.id||`draft-${i}`,value:clone(D.communityDrafts[i])});
 await put(db,'meta',{id:'app',activeProfile:D.activeProfile||fallback,onboarded:!!D.onboarded,version:4,savedAt:D._savedAt||Date.now()});
}
async function snapshotDB(db){const [meta,profiles,periods,logs,notes,settings,signals,reminders,drafts]=await Promise.all(STORES.map(s=>all(db,s)));const m=meta.find(x=>x.id==='app')||{},D=fresh();D.profiles=profiles.length?profiles:D.profiles;D.activeProfile=m.activeProfile||D.profiles[0].id;D.settings=settings.find(x=>x.id==='global')?.value||D.settings;D.periods=periods.filter(x=>x.profileId===D.activeProfile).map(x=>({...x}));D.logs=Object.fromEntries(logs.filter(x=>x.profileId===D.activeProfile).map(x=>[x.date,x.value||{}]));D.notes=Object.fromEntries(notes.filter(x=>x.profileId===D.activeProfile).map(x=>[x.date,x.value||'']));D.customSignals=signals.filter(x=>x.profileId===D.activeProfile).map(x=>({id:x.signalId||x.id,name:x.name}));D.reminders=reminders.filter(x=>x.profileId===D.activeProfile).map(x=>x.value||x);D.communityDrafts=drafts.map(x=>x.value||x);D.onboarded=!!m.onboarded;D._savedAt=m.savedAt||0;return D}
async function profileDB(db,id){const D=await snapshotDB(db);D.activeProfile=id;const [periods,logs,notes,signals,reminders]=await Promise.all(['periods','logs','notes','customSignals','reminders'].map(s=>all(db,s)));D.periods=periods.filter(x=>x.profileId===id).map(x=>({...x}));D.logs=Object.fromEntries(logs.filter(x=>x.profileId===id).map(x=>[x.date,x.value||{}]));D.notes=Object.fromEntries(notes.filter(x=>x.profileId===id).map(x=>[x.date,x.value||'']));D.customSignals=signals.filter(x=>x.profileId===id).map(x=>({id:x.signalId||x.id,name:x.name}));D.reminders=reminders.filter(x=>x.profileId===id).map(x=>x.value||x);return D}
function installCompatibility(){
 let compat=JSON.stringify(memory);
 const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;
 Storage.prototype.getItem=function(k){if(k===APP_KEY)return compat;return nativeGet.call(this,k)};
 Storage.prototype.setItem=function(k,v){if(k===APP_KEY){compat=String(v);try{memory=migrate(JSON.parse(compat));memory._savedAt=Date.now();localWrite(memory);if(idbReady)writeSnapshot(idb,memory).catch(console.error)}catch{}return}return nativeSet.call(this,k,v)};
 Storage.prototype.removeItem=function(k){if(k===APP_KEY){memory=fresh();localWrite(memory);if(idbReady)writeSnapshot(idb,memory).catch(console.error);return}return nativeRemove.call(this,k)};
 window.RitmiStorage={version:4,dbName:DB_NAME,ready:true,persistent:async()=>{try{return await navigator.storage?.persist?.()||false}catch{return false}},estimate:async()=>{try{return await navigator.storage?.estimate?.()}catch{return null}},snapshot:async()=>clone(memory),profileSnapshot:async id=>idbReady?profileDB(idb,id):Object.assign(clone(memory),{activeProfile:id,periods:[],logs:{},notes:{}}),save:async data=>{memory=migrate(data);memory._savedAt=Date.now();localWrite(memory);if(idbReady)writeSnapshot(idb,memory).catch(console.error)},clear:async()=>{memory=fresh();localWrite(memory);if(idbReady){for(const s of STORES)await clear(idb,s).catch(()=>{})}},};
}
function publishUpgrade(D){memory=migrate(D);memory._savedAt=D._savedAt||Date.now();localWrite(memory);upgradePending=true;window.__RitmiStorageHydrated=true;window.dispatchEvent(new CustomEvent('ritmi-storage-upgraded',{detail:clone(memory)}))}
function hydrate(){
 open().then(async db=>{
  idb=db;idbReady=true;
  let data;
  try{data=await snapshotDB(db)}catch(e){console.error('Ritmi IndexedDB read failed',e);return}
  if(meaningful(data)){
   if(!meaningful(memory)||Number(data._savedAt||0)>=Number(memory._savedAt||0))publishUpgrade(data);
  }else if(meaningful(memory)){
   writeSnapshot(db,memory).catch(console.error);
  }else{
   const source=(()=>{for(const k of [APP_KEY,...OLD_KEYS]){try{const x=localStorage.getItem(k);if(x)return migrate(JSON.parse(x))}catch{}}return null})();
   if(source){memory=migrate(source);localWrite(memory);writeSnapshot(db,memory).catch(console.error)}
  }
  window.RitmiStorage.backend='indexeddb';
  window.dispatchEvent(new Event('ritmi-storage-backend-ready'));
  window.RitmiStorage.persistent().catch(()=>{});
 }).catch(e=>{console.warn('Ritmi: IndexedDB unavailable; continuing with local storage.',e)});
}
installCompatibility();
window.RitmiStorage.backend='localStorage';
window.__RitmiStorageReady=true;
window.dispatchEvent(new Event('ritmi-storage-ready'));
setTimeout(hydrate,0);
})();