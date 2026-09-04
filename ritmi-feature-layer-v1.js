(()=>{'use strict';
const S=window.RitmiStorage;
const wait=()=>new Promise(r=>setTimeout(r,0));
async function get(){return await S.snapshot()}
async function save(D){await S.save(D);return await S.snapshot()}
function uid(p){return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`}
window.RitmiFeatures={
 async addSignal(name,kind='scale'){const D=await get();D.customSignals=D.customSignals||[];D.customSignals.push({id:uid('signal'),name:String(name).trim(),kind,createdAt:new Date().toISOString()});return save(D)},
 async removeSignal(id){const D=await get();D.customSignals=(D.customSignals||[]).filter(x=>x.id!==id);Object.values(D.logs||{}).forEach(l=>{if(l.custom)delete l.custom[id]});return save(D)},
 async setCustom(date,id,value){const D=await get();D.logs=D.logs||{};D.logs[date]=D.logs[date]||{};D.logs[date].custom=D.logs[date].custom||{};if(value===null||value==='')delete D.logs[date].custom[id];else D.logs[date].custom[id]=value;return save(D)},
 async addReminder(type,date,time){const D=await get();D.reminders=D.reminders||[];D.reminders.push({id:uid('reminder'),type,date,time,enabled:true});return save(D)},
 async removeReminder(id){const D=await get();D.reminders=(D.reminders||[]).filter(x=>x.id!==id);return save(D)},
 async addNote(date,text){const D=await get();D.notes=D.notes||{};if(String(text).trim())D.notes[date]=String(text).trim();else delete D.notes[date];return save(D)},
 async addProfile(name){const D=await get();D.profiles=D.profiles||[];const id=uid('profile');D.profiles.push({id,name:String(name).trim(),type:'custom'});return save(D)},
 async exportPlain(){const D=await get();return JSON.stringify(D,null,2)},
 async health(){const D=await get();return {persistent:await S.persistent(),storage:await S.estimate(),profiles:(D.profiles||[]).length,periods:(D.periods||[]).length,logs:Object.keys(D.logs||{}).length,signals:(D.customSignals||[]).length}}
};
})();