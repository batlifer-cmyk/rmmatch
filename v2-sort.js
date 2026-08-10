(function(){
'use strict';

const RMV2_SORT_VERSION='2026.08.10.1';
const SORT_KEY='rmv2_result_sort';
let currentSort=localStorage.getItem(SORT_KEY)||'recommended';
let lastSlots=[];
let rendering=false;

function mins(t){
  const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);
  return m?(+m[1]*60 + +m[2]):9999;
}
function stats(slot){
  const rows=(slot&&slot.entries||[]).map(e=>mins(e.time)).filter(Number.isFinite);
  const min=rows.length?Math.min(...rows):9999;
  const max=rows.length?Math.max(...rows):9999;
  const avg=rows.length?rows.reduce((a,b)=>a+b,0)/rows.length:9999;
  const spread=rows.length?max-min:9999;
  const instructors=new Set((slot&&slot.entries||[]).map(e=>e&&e.instructor&&e.instructor.id).filter(Boolean)).size;
  const conn=slot&&slot.fit&&slot.fit.connection||{};
  const warning=!!(slot&&slot.workloadWarning)||!!conn.actualMaxRunExceeded||!!(slot&&slot.rmv2ConsecutiveWarning);
  return {min,max,avg,spread,instructors,warning,score:Number(slot&&slot.score)||0};
}
function cmpNum(a,b){return a===b?0:(a<b?-1:1);}
function sortSlots(slots,mode){
  const out=(slots||[]).slice();
  out.sort((a,b)=>{
    const x=stats(a),y=stats(b);
    if(mode==='early'){
      return cmpNum(x.max,y.max)||cmpNum(x.avg,y.avg)||cmpNum(x.min,y.min)||cmpNum(y.score,x.score);
    }
    if(mode==='late'){
      return cmpNum(y.min,x.min)||cmpNum(y.avg,x.avg)||cmpNum(y.max,x.max)||cmpNum(y.score,x.score);
    }
    if(mode==='same_time'){
      return cmpNum(x.spread,y.spread)||cmpNum(x.avg,y.avg)||cmpNum(y.score,x.score);
    }
    if(mode==='single_instructor'){
      return cmpNum(x.instructors,y.instructors)||cmpNum(x.max,y.max)||cmpNum(y.score,x.score);
    }
    if(mode==='low_workload'){
      return cmpNum(x.warning?1:0,y.warning?1:0)||cmpNum(x.instructors,y.instructors)||cmpNum(x.max,y.max)||cmpNum(y.score,x.score);
    }
    return cmpNum(y.score,x.score);
  });
  return out;
}

function ensureToolbar(){
  const results=document.getElementById('slotResults');
  if(!results||document.getElementById('rmv2-sortbar'))return;
  const bar=document.createElement('div');
  bar.id='rmv2-sortbar';
  bar.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;padding:10px 12px;background:#fafafa;border:1px solid #e0e0e0;border-radius:5px';
  bar.innerHTML='<span style="font-size:12px;font-weight:700;color:var(--muted)">결과 정렬</span>'+
    '<select id="rmv2-sort-select" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:4px;background:#fff;font-family:inherit;font-size:12px">'+
      '<option value="recommended">추천순</option>'+ 
      '<option value="early">이른 시간순</option>'+ 
      '<option value="late">늦은 시간순</option>'+ 
      '<option value="same_time">같은 시간 우선</option>'+ 
      '<option value="single_instructor">한 강사 우선</option>'+ 
      '<option value="low_workload">강사 부담 적은 순</option>'+ 
    '</select>'+ 
    '<span id="rmv2-sort-hint" style="font-size:11px;color:var(--muted)"></span>';
  results.parentNode.insertBefore(bar,results);
  const sel=bar.querySelector('#rmv2-sort-select');
  sel.value=currentSort;
  sel.onchange=function(){
    currentSort=this.value;
    localStorage.setItem(SORT_KEY,currentSort);
    rerender();
  };
  updateHint();
}
function updateHint(){
  const el=document.getElementById('rmv2-sort-hint');
  if(!el)return;
  const hints={
    recommended:'희망조건·강사·연강 점수를 종합한 기본 추천',
    early:'각 조합에서 가장 늦은 수업시간이 이른 순',
    late:'늦은 시간대 조합부터 표시',
    same_time:'요일별 수업시간 차이가 작은 조합 우선',
    single_instructor:'가능하면 한 명의 강사로 통일',
    low_workload:'5시간 이상 연강 경고 없는 조합 우선'
  };
  el.textContent=hints[currentSort]||'';
}

function renderFlat(slots){
  const el=document.getElementById('slotResults');
  if(!el)return;
  el.innerHTML='';
  const warnings=typeof getAvailabilityWarnings==='function'?getAvailabilityWarnings():[];
  if(warnings.length){
    const warn=document.createElement('div');
    warn.className='notice';
    warn.style.marginBottom='12px';
    warn.innerHTML='⚠️ '+warnings.join('<br>⚠️ ');
    el.appendChild(warn);
  }
  if(!slots.length){
    el.innerHTML+='<div class="empty">조건에 맞는 일정이 없습니다.</div>';
    return;
  }
  const info=document.createElement('div');
  info.style.cssText='font-size:12px;color:var(--muted);margin:0 2px 10px';
  info.textContent='현재 후보 '+slots.length+'개 · 정렬만 변경하며 캘린더 충돌 판정은 그대로 유지됩니다.';
  el.appendChild(info);
  const subjects=typeof getChecked==='function'?getChecked('s-subjects').join(', '):'';
  const freq=typeof getSelectedFrequency==='function'?getSelectedFrequency():1;
  slots.forEach(slot=>{
    if(typeof renderSlotCard==='function')el.appendChild(renderSlotCard(slot,subjects,freq));
  });
  if(typeof canLoadMoreSlots==='function'&&canLoadMoreSlots()){
    const more=document.createElement('div');
    more.className='slot-more-wrap';
    more.innerHTML='<button class="btn btn-ghost btn-sm" onclick="loadMoreSlots()">＋ 추천 조금 더 보기</button>';
    el.appendChild(more);
  }
  const first=el.querySelector('.slot-result');
  if(first)first.click();
}

const previousRender=typeof renderSlotResults==='function'?renderSlotResults:null;
if(previousRender){
  renderSlotResults=function(slots){
    if(rendering)return previousRender(slots);
    lastSlots=(slots||[]).slice();
    ensureToolbar();
    updateHint();
    if(currentSort==='recommended'){
      rendering=true;
      try{return previousRender(slots);}finally{rendering=false;}
    }
    renderFlat(sortSlots(lastSlots,currentSort));
  };
}

function rerender(){
  ensureToolbar();
  updateHint();
  if(!lastSlots.length)return;
  if(currentSort==='recommended'){
    rendering=true;
    try{previousRender(lastSlots.slice());}finally{rendering=false;}
  }else{
    renderFlat(sortSlots(lastSlots,currentSort));
  }
}

window.__RMV2_SORT__={version:RMV2_SORT_VERSION,mode:()=>currentSort,sortSlots,rerender};
try{parent.postMessage({type:'rmv2-sort-ready',sort:{version:RMV2_SORT_VERSION,mode:currentSort}},location.origin);}catch(_){ }
})();
