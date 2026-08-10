(function(){
'use strict';
const CORE=window.__RMV2_CORE__;
if(!CORE)throw new Error('RM Scheduler v2 core patch not loaded');
const RMV2_VERSION=CORE.version;
const rmv2ValidateSelectedSlot=CORE.validate;
const rmv2ConflictsOnDate=CORE.conflictsOnDate;
const rmv2Overlap=CORE.overlap;
const rmv2DateKey=CORE.dateKey;
const rmv2DateFromKey=CORE.dateFromKey;
async function rmv2FetchText(url,kind){
  const ctrl=new AbortController();const tid=setTimeout(()=>ctrl.abort(),8000);
  try{
    const res=await fetch(url,{signal:ctrl.signal,cache:'no-store'});
    if(!res.ok)throw new Error('HTTP '+res.status);
    if(kind==='allorigins'){const j=await res.json();return j.contents||'';}
    return await res.text();
  }finally{clearTimeout(tid);}
}
fetchICS=async function(ins){
  if(!ins||!ins.calId)return[];
  const now=Date.now();
  if(icsCache[ins.id]&&now-icsCache[ins.id].fetched<5*60*1000)return icsCache[ins.id].slots||[];
  const attempts=[
    {name:'direct',url:ins.calId,kind:'text'},
    {name:'allorigins',url:'https://api.allorigins.win/get?url='+encodeURIComponent(ins.calId),kind:'allorigins'},
    {name:'corsproxy',url:'https://corsproxy.io/?'+encodeURIComponent(ins.calId),kind:'text'}
  ];
  let lastErr='';
  for(const a of attempts){
    try{
      const text=await rmv2FetchText(a.url,a.kind);
      if(!text||!text.includes('VCALENDAR'))throw new Error('VCALENDAR 없음');
      const slots=parseICS(text);
      icsCache[ins.id]={fetched:now,slots,transport:a.name,ok:true};
      return slots;
    }catch(e){lastErr=e&&e.message||String(e);}
  }
  icsCache[ins.id]={fetched:now,slots:[],transport:'failed',ok:false,error:lastErr};
  return[];
};

testAllICS=async function(){
  const statusEl=document.getElementById('ics-status');
  if(statusEl)statusEl.innerHTML='<span style="color:var(--muted)">캘린더 실제 연결 테스트 중…</span>';
  Object.keys(icsCache).forEach(k=>delete icsCache[k]);
  const rows=[];
  for(const ins of instructors){
    if(!ins.calId){rows.push('⚪ <b>'+ins.name+'</b> — URL 미입력');continue;}
    const slots=await fetchICS(ins);
    const c=icsCache[ins.id]||{};
    if(c.ok)rows.push('✅ <b>'+ins.name+'</b> — '+slots.length+'개 일정 · '+(c.transport==='direct'?'직접연결':'프록시 '+c.transport));
    else rows.push('❌ <b>'+ins.name+'</b> — 연결 실패');
  }
  if(statusEl)statusEl.innerHTML=rows.map(x=>'<div style="margin-bottom:6px">'+x+'</div>').join('');
};

(function rmv2ProtectApiKey(){
  const old=localStorage.getItem('rm_anthropic_key');
  if(old&&!sessionStorage.getItem('rm_anthropic_key_session'))sessionStorage.setItem('rm_anthropic_key_session',old);
  if(old)localStorage.removeItem('rm_anthropic_key');
  getAnthropicKey=function(){return sessionStorage.getItem('rm_anthropic_key_session')||'';};
  if(typeof saveAnthropicKey==='function'){
    saveAnthropicKey=function(){
      const el=document.getElementById('cfg-anthropic-key');
      const value=el?el.value.trim():'';
      if(value)sessionStorage.setItem('rm_anthropic_key_session',value);
      else sessionStorage.removeItem('rm_anthropic_key_session');
      localStorage.removeItem('rm_anthropic_key');
      const st=document.getElementById('anthropic-key-status');
      if(st)st.textContent=value?'현재 브라우저 탭 세션에만 저장됨':'키가 삭제되었습니다.';
      if(el)el.value='';
    };
  }
  if(typeof initAnthropicKeyDisplay==='function'){
    initAnthropicKeyDisplay=function(){
      const st=document.getElementById('anthropic-key-status');
      if(st)st.textContent=getAnthropicKey()?'현재 탭 세션에 API Key 있음':'저장된 API Key 없음';
    };
  }
})();

function rmv2ExportInstructors(){
  const blob=new Blob([JSON.stringify({version:RMV2_VERSION,exportedAt:new Date().toISOString(),instructors},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rm-instructors-'+rmv2DateKey(new Date())+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function rmv2ImportInstructors(file){
  if(!file)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const j=JSON.parse(r.result);const arr=Array.isArray(j)?j:j.instructors;
      if(!Array.isArray(arr)||!arr.length)throw new Error('강사 배열 없음');
      instructors=arr;saveData();refreshInsSel();renderInsGrid();
      alert('강사 설정 '+arr.length+'명을 가져왔습니다.');
    }catch(e){alert('가져오기 실패: '+(e.message||e));}
  };
  r.readAsText(file);
}
function rmv2InjectSettingsNotice(){
  const page=document.getElementById('page-settings');
  if(!page||document.getElementById('rmv2Safety'))return;
  const box=document.createElement('div');box.id='rmv2Safety';box.className='card';
  box.innerHTML='<div class="card-title">RM Scheduler v2 운영 안전패치</div>'+ '<div class="notice">실제 날짜·수업 길이·반복 일정·임시 일정·최대 2인 강사를 구분합니다. 임시 일정 1회 때문에 매주 같은 시간이 영구 차단되지 않습니다.</div>'+ '<div style="font-size:12px;color:var(--muted);line-height:1.7;margin-bottom:12px">로그인 후 중앙 설정이 연결되면 강사 운영 설정은 온라인 공용 설정을 기준으로 동기화됩니다. 백업/가져오기는 장애 대응용으로 유지합니다. Anthropic API Key는 v2부터 localStorage에 남기지 않고 현재 탭 세션에만 보관합니다.</div>'+ '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" id="rmv2Export">강사 설정 백업</button><label class="btn btn-ghost btn-sm" style="cursor:pointer">강사 설정 가져오기<input id="rmv2Import" type="file" accept="application/json" style="display:none"></label></div>';
  const anchor=page.querySelector('.sec-sub');
  if(anchor)anchor.insertAdjacentElement('afterend',box);else page.prepend(box);
  box.querySelector('#rmv2Export').onclick=rmv2ExportInstructors;
  box.querySelector('#rmv2Import').onchange=e=>rmv2ImportInstructors(e.target.files[0]);
}
rmv2InjectSettingsNotice();

function rmv2Diagnostics(){
  const checks=[];
  checks.push(['duration',rmv2Overlap(600,690,660,720)===true]);
  checks.push(['non-overlap',rmv2Overlap(600,660,660,720)===false]);
  checks.push(['date',!!rmv2DateFromKey('2026-08-08')]);
  checks.push(['engine',typeof computeSlots==='function'&&typeof isConflictICS==='function'&&typeof fetchICS==='function']);
  const ok=checks.every(x=>x[1]);
  return {ok,version:RMV2_VERSION,checks};
}
window.__RMV2__={version:RMV2_VERSION,validate:rmv2ValidateSelectedSlot,diagnostics:rmv2Diagnostics,conflictsOnDate:rmv2ConflictsOnDate};
const diag=rmv2Diagnostics();
try{parent.postMessage({type:'rmv2-ready',diag},location.origin);}catch(_){}
})();
