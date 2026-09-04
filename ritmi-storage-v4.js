/* Ritmi 4.0 storage bootstrap
   IndexedDB is the canonical private-data store.
   localStorage is migration-only compatibility input.
*/
(()=>{
'use strict';
const DB_NAME='ritmi-local-v4',DB_VERSION=1,APP_KEY='ritmi-v3',OLD_KEYS=['ritmi-v2','ritmi-v1','ritmi'];
const STORES=['meta','profiles','periods','logs','notes','settings','customSignals','reminders','communityDrafts'];
const clone=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>({version:4,settings:{cycleLength:28,periodLength:5,mode:'self',reduceMotion:false,privateDisplay:false},profiles:[{id:'self',name:'My cycle',type:'self'}],activeProfile:'self',periods:[],logs:{},notes:{},cycles:[],customSignals:[],reminders:[],communityDrafts:[],onboarded:false});
function migrate(x){const n=fresh();n.settings={...n.settings,...(x?.settings||{})};n.profiles=Array.isArray(x?.profiles)&&x.profiles.length?x.profiles:n.profiles;n.activeProfile=x?.activeProfile||n.profiles[0].id;n.periods=Array.isArray(x?.periods)?x.periods:(Array.isArray(x?.cycles)?x.cycles:[]);n.logs=x?.logs&&typeof x.logs==='object'?x.logs:{};n.notes=x?.journal&&typeof x.journal==='object'?x.journal:(x?.notes||{});n.customSignals=Array.isArray(x?.customSignals)?x.customSignals:(Array.isArray(x?.customFields)?x.customFields:[]);n.reminders=Array.isArray(x?.reminders)?x.reminders:[];n.communityDrafts=Array.isArray(x?.communityDrafts)?x.communityDrafts:[];n.onboarded=!!x?.onboarded;return n}
const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
function open(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;for(const s of STORES)if(!db.objectStoreNames.contains(s)){const os=db.createObjectStore(s,{keyPath:'id'});if(['periods','logs','notes','customSignals','reminders','communityDrafts'].includes(s))os.createIndex('profileId','profileId',{unique:false})}};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
const all=(db,s)=>req(db.transaction(s).objectStore(s).getAll());
async function clear(db,s){await req(db.transaction(s,'readwrite').objectStore(s).clear())}
async function put(db,s,v){await req(db.transaction(s,'readwrite').objectStore(s).put(v))}
async function writeSnapshot(db,D){
 await clear(db,'profiles');await clear(db,'periods');await clear(db,'logs');await clear(db,'notes');await clear(db,'settings');await clear(db,'customSignals');await clear(db,'reminders');
 for(const p of D.profiles||[])await put(db,'profiles',{...clone(p),id:p.id});
 await put(db,'settings',{id:'global',value:clone(D.settings||{})});
 const profiles=(D.profiles||[]).map(p=>p.id);const fallback=profiles[0]||'self';
 for(const profileId of profiles){
  const periodValues=profileId===D.activeProfile?D.periods||[]:[];
  for(let i=0;i<periodValues.length;i++){const o=typeof periodValues[i]==='string'?{date:periodValues[i]}:{...periodValues[i]};await put(db,'periods',{id:o.id||`period-${profileId}-${o.date}-${i}`,profileId,...o})}
  const logs=profileId===D.activeProfile?D.logs||{}:{};for(const [date,value] of Object.entries(logs))await put(db,'logs',{id:`log-${profileId}-${date}`,profileId,date,value:clone(value)});
  const notes=profileId===D.activeProfile?D.notes||{}:{};for(const [date,value] of Object.entries(notes))await put(db,'notes',{id:`note-${profileId}-${date}`,profileId,date,value});
  const signals=profileId===D.activeProfile?D.customSignals||[]:[];for(const s of signals)await put(db,'customSignals',{id:`signal-${profileId}-${s.id||s.key}`,signalId:s.id||s.key,profileId,name:s.name});
  const reminders=profileId===D.activeProfile?D.reminders||[]:[];for(let i=0;i<reminders.length;i++)await put(db,'reminders',{id:`reminder-${profileId}-${i}`,profileId,value:clone(reminders[i])});
 }
 const drafts=D.communityDrafts||[];for(let i=0;i<drafts.length;i++)await put(db,'communityDrafts',{id:drafts[i]?.id||`draft-${i}`,value:clone(drafts[i])});
 await put(db,'meta',{id:'app',activeProfile:D.activeProfile||fallback,onboarded:!!D.onboarded,version:4});
}
async function snapshot(db){const [meta,profiles,periods,logs,notes,settings,signals,reminders,drafts]=await Promise.all(STORES.map(s=>all(db,s)));const m=meta.find(x=>x.id==='app')||{},D=fresh();D.profiles=profiles.length?profiles:D.profiles;D.activeProfile=m.activeProfile||D.profiles[0].id;D.settings=settings.find(x=>x.id==='global')?.value||D.settings;D.periods=periods.filter(x=>x.profileId===D.activeProfile).map(x=>({...x}));D.logs=Object.fromEntries(logs.filter(x=>x.profileId===D.activeProfile).map(x=>[x.date,x.value||{}]));D.notes=Object.fromEntries(notes.filter(x=>x.profileId===D.activeProfile).map(x=>[x.date,x.value||'']));D.customSignals=signals.filter(x=>x.profileId===D.activeProfile).map(x=>({id:x.signalId||x.id,name:x.name}));D.reminders=reminders.filter(x=>x.profileId===D.activeProfile).map(x=>x.value||x);D.communityDrafts=drafts.map(x=>x.value||x);D.onboarded=!!m.onboarded;return D}
async function migrateLegacy(db){let source=null;for(const k of [APP_KEY,...OLD_KEYS]){try{const x=JSON.parse(localStorage.getItem(k)||'null');if(x){source=x;break}}catch{}}if(!(await all(db,'profiles')).length){await writeSnapshot(db,source?migrate(source):fresh());for(const k of [APP_KEY,...OLD_KEYS])try{localStorage.removeItem(k)}catch{}}}
function installCompatibility(db,D){let memory=JSON.stringify(D);const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;Storage.prototype.getItem=function(k){if(k===APP_KEY)return memory;return nativeGet.call(this,k)};Storage.prototype.setItem=function(k,v){if(k===APP_KEY){memory=String(v);try{D=migrate(JSON.parse(memory));writeSnapshot(db,D).catch(console.error)}catch{}return}return nativeSet.call(this,k,v)};Storage.prototype.removeItem=function(k){if(k===APP_KEY){memory=JSON.stringify(fresh());writeSnapshot(db,fresh()).catch(console.error);return}return nativeRemove.call(this,k)};window.RitmiStorage={version:4,dbName:DB_NAME,snapshot:()=>snapshot(db),save:async data=>{D=migrate(data);memory=JSON.stringify(D);await writeSnapshot(db,D)},clear:async()=>{for(const s of ['profiles','periods','logs','notes','settings','customSignals','reminders'])await clear(db,s);D=fresh();memory=JSON.stringify(D)},persistent:async()=>{try{return await navigator.storage?.persist?.()||false}catch{return false}},estimate:async()=>{try{return await navigator.storage?.estimate?.()}catch{return null}}}}
function load(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.body.appendChild(s)})}
async function main(){if(!window.indexedDB)throw Error('IndexedDB unavailable');const db=await open();await migrateLegacy(db);const D=await snapshot(db);installCompatibility(db,D);await window.RitmiStorage.persistent();await load('./ritmi-addon.js?v=4');await load('./ritmi-storage-controls-v4.js?v=1');await load('./ritmi-community-v1.js?v=1');await load('./ritmi-experience-v1.js?v=1')}
main().catch(e=>{console.error(e);alert('Ritmi could not open its local database. Your existing local data was not intentionally deleted. Reload to try again.')});
})();
