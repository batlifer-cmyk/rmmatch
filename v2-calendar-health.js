(function(){
'use strict';

const VERSION='2026.08.10.1';
const CANONICAL=new Set(['matthew','david','paul','jenna','dean']);
let lastHealth=null;

function apps(){return window.__RMV2_APPS_SCRIPT__||null;}
function msText(ms){return (ms/1000).toFixed(ms>=10000?1:2)+'초';}
function targetInstructors(){
  return (Array.isArray(instructors)?instructors:[]).filter(function(ins){
    return ins && (ins.calendarId || ins.calId || CANONICAL.has(ins.id));
  });
}
function statusEl(){return document.getElementById('step2-ics-status');}
function setStatus(html,ok){
  const el=statusEl();
  if(!el)return;
  el.style.display='flex';
  el.style.background=ok===true?'#e8f5e9':(ok===false?'#fce4ec':'#fff8e1');
  el.style.color=ok===true?'#2e7d32':(ok===false?'#c62828':'#856400');
  el.innerHTML='<div class="dot" style="background:'+(ok===true?'var(--success)':(ok===false?'var(--danger)':'#f9a825'))+'"></div><span>'+html+'</span>';
}
function cacheRow(ins,slots){
  const c=(typeof icsCache==='object'&&icsCache)?(icsCache[ins.id]||{}):{};
  const ok=c.ok!==false;
  return {
    id:ins.id,
    name:ins.name||ins.id,
    count:Array.isArray(slots)?slots.length:(Array.isArray(c.slots)?c.slots.length:0),
    ok:ok,
    transport:c.transport||'',
    error:c.error||''
  };
}

async function robustPrefetch(force){
  const started=performance.now();
  const targets=targetInstructors();
  const a=apps();
  if(force){
    try{if(typeof icsCache==='object')targets.forEach(function(ins){delete icsCache[ins.id];});}catch(_){ }
  }

  // Apps Script는 5명 BUSY를 한 번에 받는다. 강제 새로고침이면 이 요청을 먼저 딱 한 번 수행한다.
  if(force&&a&&typeof a.configured==='function'&&a.configured()&&typeof a.fetchAll==='function'){
    await a.fetchAll(true);
  }

  const rows=[];
  for(const ins of targets){
    try{
      const slots=await fetchICS(ins);
      rows.push(cacheRow(ins,slots));
    }catch(e){
      rows.push({id:ins.id,name:ins.name||ins.id,count:0,ok:false,transport:'',error:e&&e.message||String(e)});
    }
  }
  const elapsed=Math.round(performance.now()-started);
  const failed=rows.filter(r=>!r.ok);
  lastHealth={rows,elapsed,failed,generatedAt:(a&&a.state&&a.state.data&&a.state.data.generatedAt)||'',checkedAt:new Date().toISOString()};
  return lastHealth;
}

function summaryText(h){
  const bits=h.rows.filter(r=>CANONICAL.has(r.id)).map(r=>r.name.split(' ')[0]+' '+(r.ok?r.count+' BUSY':'실패'));
  return bits.join(' · ')+' · 조회 '+msText(h.elapsed);
}
function failureText(h){
  return h.failed.map(r=>r.name+' — '+(r.error||'조회 실패')).join(' / ');
}

async function refreshHealthOnly(){
  setStatus('최신 Google Calendar BUSY를 강제로 다시 읽는 중…',null);
  try{
    const h=await robustPrefetch(true);
    if(h.failed.length){
      setStatus('조회 실패 · '+failureText(h),false);
      return h;
    }
    setStatus('조회 완료 · '+summaryText(h),true);
    return h;
  }catch(e){
    setStatus('조회 실패 · '+(e&&e.message||String(e)),false);
    throw e;
  }
}

// legacy prefetchAllICS는 calId만 검사해서 canonical calendarId 5명을 건너뛸 수 있었다.
// 이후 모든 추천 경로는 이 함수로 통일한다.
prefetchAllICS=async function(){
  const h=await robustPrefetch(false);
  if(h.failed.length)throw new Error(failureText(h));
  return h;
};

const previousRunCalendarFind=typeof runCalendarFind==='function'?runCalendarFind:null;
if(previousRunCalendarFind){
  runCalendarFind=async function(){
    if(typeof resetSlotBatchSearch==='function')resetSlotBatchSearch();
    setStatus('최신 Google Calendar BUSY 조회 중…',null);
    const results=document.getElementById('slotResults');
    if(results)results.innerHTML='<div class="empty">5명 강사 캘린더 확인 중…</div>';
    let h;
    try{
      h=await robustPrefetch(true);
    }catch(e){
      setStatus('조회 실패 · '+(e&&e.message||String(e)),false);
      if(results)results.innerHTML='<div class="empty">캘린더 조회에 실패했습니다.<br>최신 캘린더 다시 읽기를 눌러 재시도해주세요.</div>';
      return;
    }
    if(h.failed.length){
      setStatus('조회 실패 · '+failureText(h),false);
      if(results)results.innerHTML='<div class="empty">일부 강사 캘린더를 확인하지 못해 추천을 중단했습니다.<br>'+failureText(h)+'</div>';
      return;
    }
    setStatus('조회 완료 · '+summaryText(h),true);
    const calSlots=computeSlots();
    calSlots.forEach(function(s){if(!s.source)s.source='calendar';});
    renderSlotResults(calSlots);
  };
}

function injectButton(){
  const section=document.getElementById('modeSection-calendar');
  if(!section||document.getElementById('rmv2-calendar-force-refresh'))return;
  const btn=document.createElement('button');
  btn.id='rmv2-calendar-force-refresh';
  btn.className='btn btn-ghost btn-sm mt16';
  btn.style.marginLeft='8px';
  btn.textContent='↻ 최신 캘린더 다시 읽기';
  btn.onclick=function(){refreshHealthOnly().catch(function(){});};
  const primary=section.querySelector('button');
  if(primary)primary.insertAdjacentElement('afterend',btn);else section.appendChild(btn);
}

injectButton();
window.__RMV2_CALENDAR_HEALTH__={version:VERSION,refresh:refreshHealthOnly,prefetch:robustPrefetch,last:()=>lastHealth};
try{parent.postMessage({type:'rmv2-calendar-health-ready',calendarHealth:{version:VERSION}},location.origin);}catch(_){ }
})();
