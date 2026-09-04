(()=>{'use strict';
const S=window.RitmiStorage;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let D=null;
const get=()=>S.snapshot().then(x=>(D=x,x));
const save=async()=>{await S.save(D);D=await S.snapshot()};
const sheet=(title,html)=>{const layer=document.querySelector('#r-layer');if(!layer)return;layer.innerHTML=`<div class="r-sheet-backdrop" onclick="RitmiFeature.close()"></div><section class="r-sheet"><button class="r-close" onclick="RitmiFeature.close()">Close</button><div class="r-eyebrow">Ritmi</div><h2>${esc(title)}</h2>${html}</section>`};
const custom=()=>{get().then(()=>{const list=D.customSignals||[];sheet('Your signals',`<p>Add small things that matter to you. They stay on this device and appear as choices in your tracking flow.</p><div class="r-choice">${list.length?list.map((x,i)=>`<button><span>${esc(x.name||x.label||x.key)}</span><b onclick="RitmiFeature.remove(${i})">Remove</b></button>`).join(''):'<p class="r-muted">Nothing custom yet.</p>'}</div><button class="r-sheet-action" onclick="RitmiFeature.add()">Add a signal</button>`)})};
const add=()=>{const name=prompt('What would you like to track?');if(!name?.trim())return;get().then(async()=>{D.customSignals=D.customSignals||[];D.customSignals.push({id:'s-'+Math.random().toString(36).slice(2,9),name:name.trim()});await save();custom()})};
const remove=i=>get().then(async()=>{D.customSignals.splice(i,1);await save();custom()});
const close=()=>{const l=document.querySelector('#r-layer');if(l)l.innerHTML=''};
const onboarding=()=>{get().then(x=>{if(x.onboarded)return;sheet('A quieter way to track',`<p>Ritmi is free, local-first and made without an account. You choose what to record. Your health data stays in this browser.</p><div class="r-note"><strong>Nothing is required.</strong><br>Start with a period date, add symptoms when useful, and leave everything else alone.</div><button class="r-sheet-action" onclick="RitmiFeature.finishOnboarding()">Start with Ritmi</button>`)})};
const finishOnboarding=()=>get().then(async()=>{D.onboarded=true;await save();close()});
function inject(){const main=document.querySelector('#r-main');if(!main||document.querySelector('[data-feature-custom]'))return;const more=main.querySelector('.r-menu-list');if(!more)return;const b=document.createElement('button');b.className='r-row';b.dataset.featureCustom='1';b.innerHTML='<span>Custom tracking</span><b>→</b>';b.onclick=custom;more.insertBefore(b,more.children[2]||null);get().then(x=>{if(!x.onboarded)setTimeout(onboarding,350)});}
window.RitmiFeature={custom,add,remove,close,onboarding,finishOnboarding};
const timer=setInterval(()=>{inject();if(document.querySelector('[data-feature-custom]'))clearInterval(timer)},180);
})();