(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s);
function mount(){const nav=$('.rt-navin');if(!nav||nav.querySelector('[data-nav="community"]'))return;const b=document.createElement('button');b.dataset.nav='community';b.innerHTML='<i>◉</i><span>Community</span>';b.onclick=()=>{window.location.href='./community.html'};nav.appendChild(b);nav.style.gridTemplateColumns='repeat(6,1fr)'}
let n=0;const boot=()=>{if($('.rt-navin')){mount();return}if(n++<60)setTimeout(boot,100)};boot();
})();
