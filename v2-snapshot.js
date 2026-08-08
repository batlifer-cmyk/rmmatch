(function(){
'use strict';

const VERSION='2026.08.08.1';
const SNAPSHOT_URL='calendar-busy.json';
const MAX_AGE_MS=3*60*60*1000;
const state={loaded:false,data:null,error:'',promise:null};

function parseEntry(raw){
  const m=String(raw||'').match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if(!m)return null;
  const date=m[1],sh=+m[2],sm=+m[3],eh=+m[4],em=+m[5];
  const startMin=sh*60+sm,endMin=eh*60+em;
  if(endMin<=startMin)return null;
  const [y,mo,d]=date.split('-').map(Number);
  const start=new Date(y,mo-1,d,sh,sm,0,0),end=new Date(y,mo-1,d,eh,em,0,0);
  return {dow:start.getDay(),hour:sh,minute:sm,startMin,endMin,dateStr:date,startMs:start.getTime(),endMs:end.getTime(),recurring:false,uid:'',summary:'',transport:'busy-snapshot'};
}
function ageMs(){
  if(!state.data||!state.data.generatedAt)return Infinity;
  const t=Date.parse(state.data.generatedAt);
  return Number.isFinite(t)?Date.now()-t:Infinity;
}
function isFresh(){return !!(state.loaded&&state.data&&ageMs()>=-5*60*1000&&ageMs()<=MAX_AGE_MS);}
function hasInstructor(id){return !!(state.data&&state.data.instructors&&Object.prototype.hasOwnProperty.call(state.data.instructors,id));}
function slotsFor(id){
  if(!isFresh()||!hasInstructor(id))return null;
  const rows=Array.isArray(state.data.instructors[id])?state.data.instructors[id]:[];
  return rows.map(parseEntry).filter(Boolean);
}
function freshnessLabel(){
  if(!state.loaded)return '불러오는 중';
  if(state.error)return '오류 · '+state.error;
  const mins=Math.max(0,Math.round(ageMs()/60000));
  return isFresh()?'최신 · '+mins+'분 전':'오래됨 · '+mins+'분 전';
}
function renderStatus(){
  const el=document.getElementById('rm-snapshot-status');if(!el)return;
  el.textContent=freshnessLabel();
  el.style.color=isFresh()?'var(--success)':'var(--danger)';
  const gen=document.getElementById('rm-snapshot-generated');
  if(gen)gen.textContent=state.data&&state.data.generatedAt?state.data.generatedAt:'-';
}
async function load(force){
  if(state.promise&&!force)return state.promise;
  state.promise=(async()=>{
    try{
      const res=await fetch(SNAPSHOT_URL+'?t='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      const data=await res.json();
      if(!data||data.schema!=='rm-calendar-busy-v1'||!data.instructors)throw new Error('스냅샷 형식 오류');
      state.data=data;state.error='';state.loaded=true;
    }catch(e){state.error=e&&e.message||String(e);state.loaded=true;state.data=null;}
    renderStatus();
    try{parent.postMessage({type:'rmv2-snapshot-ready',snapshot:{version:VERSION,fresh:isFresh(),generatedAt:state.data&&state.data.generatedAt||'',error:state.error}},location.origin);}catch(_){ }
    return state.data;
  })();
  try{return await state.promise;}finally{state.promise=null;}
}
function injectUi(){
  const page=document.getElementById('page-settings');
  if(!page||document.getElementById('rmSnapshotCard'))return;
  const card=document.createElement('div');card.id='rmSnapshotCard';card.className='card';
  card.innerHTML='<div class="card-title">강사 캘린더 자동 동기화</div>'+ '<div class="notice">Matthew · David · Paul · Jenna · Dean의 Google Calendar에서 <b>학생명 없이 BUSY 시간만</b> 동기화해 사용합니다. 종일 가능시간 메모는 제외됩니다.</div>'+ '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:12px">상태</b><span id="rm-snapshot-status" style="font-size:12px">불러오는 중</span><button id="rm-snapshot-refresh" class="btn btn-ghost btn-sm">스냅샷 다시 읽기</button></div>'+ '<div style="font-size:11px;color:var(--muted);margin-top:8px">마지막 동기화: <span id="rm-snapshot-generated">-</span> · 3시간 이상 갱신되지 않으면 안전을 위해 해당 강사 자동추천을 중단합니다.</div>';
  const anchor=document.getElementById('rmv2Safety')||page.querySelector('.sec-sub');
  if(anchor)anchor.insertAdjacentElement('afterend',card);else page.prepend(card);
  card.querySelector('#rm-snapshot-refresh').onclick=()=>load(true);
  renderStatus();
}

injectUi();
window.__RMV2_SNAPSHOT__={version:VERSION,state,load,isFresh,slotsFor,hasInstructor,ageMs};
load(false);
})();
