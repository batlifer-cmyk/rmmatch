(function(){
'use strict';

const VERSION='2026.08.10.5';
const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbwGu-XsnJnphpLRzP_k--f4H2FM8-SegNP-Y9pCIaqWOhj31E1IcvdMD8q3b-9qORUh/exec';
const STATUS_TIMEOUT_MS=5000;
const LOGIN_STATUS_TIMEOUT_MS=1200;
const STATUS_CACHE_MS=60000;
const RETRY_MS=15000;
const state={proof:'',pendingProof:'',revision:0,ready:false,remoteApplied:false,supported:null,suppress:false,syncTimer:null,lastError:'',statusData:null,statusAt:0,statusPromise:null,retryTimer:null,backgroundTimer:null,savePromise:null};

function endpoint(){
  try{const a=window.__RMV2_APPS_SCRIPT__;if(a&&typeof a.endpoint==='function'&&a.endpoint())return a.endpoint();}catch(_){ }
  return DEFAULT_ENDPOINT;
}
function jsonp(action,params,timeoutMs){
  return new Promise((resolve,reject)=>{
    const cb='__rmStateCb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const s=document.createElement('script');let done=false;
    const cleanup=()=>{try{delete window[cb];}catch(_){window[cb]=undefined;}if(s.parentNode)s.parentNode.removeChild(s);};
    const timer=setTimeout(()=>{if(done)return;done=true;cleanup();reject(new Error('중앙 설정 응답 시간초과'));},timeoutMs||STATUS_TIMEOUT_MS);
    window[cb]=(data)=>{if(done)return;done=true;clearTimeout(timer);cleanup();resolve(data);};
    s.onerror=()=>{if(done)return;done=true;clearTimeout(timer);cleanup();reject(new Error('중앙 설정 연결 실패'));};
    const q=new URLSearchParams(Object.assign({},params||{},{action,callback:cb,_:Date.now()}));
    s.src=endpoint()+(endpoint().includes('?')?'&':'?')+q.toString();document.head.appendChild(s);
  });
}
async function sha256(text){
  const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text||'')));
  return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function compactInstructors(){
  return (Array.isArray(instructors)?instructors:[]).map(ins=>({
    id:String(ins.id||''),days:Array.isArray(ins.days)?ins.days.slice(0,7):[],times:Array.isArray(ins.times)?ins.times.slice(0,32):[],
    dayTimes:ins.dayTimes&&typeof ins.dayTimes==='object'?JSON.parse(JSON.stringify(ins.dayTimes)):{},
    subjects:Array.isArray(ins.subjects)?ins.subjects.slice(0,32):[],maxConsec:Number(ins.maxConsec)||4
  })).filter(x=>x.id);
}
function applyConfig(rows){
  if(!Array.isArray(rows)||!Array.isArray(instructors))return;
  const byId=new Map(rows.filter(x=>x&&x.id).map(x=>[String(x.id),x]));
  instructors.forEach(ins=>{const x=byId.get(String(ins.id));if(!x)return;
    if(Array.isArray(x.days))ins.days=x.days.slice();if(Array.isArray(x.times))ins.times=x.times.slice();
    if(x.dayTimes&&typeof x.dayTimes==='object')ins.dayTimes=JSON.parse(JSON.stringify(x.dayTimes));
    if(Array.isArray(x.subjects))ins.subjects=x.subjects.slice();if(Number.isFinite(Number(x.maxConsec)))ins.maxConsec=Number(x.maxConsec);
  });
}
function refreshRuntimeUi(){
  if(typeof refreshInsSel==='function')refreshInsSel();
  if(typeof renderSubjectCBs==='function')renderSubjectCBs('s-subjects',[]);
  if(typeof renderDayCBs==='function')renderDayCBs();
  if(typeof ensureFrequencyOptions==='function')ensureFrequencyOptions();
  if(typeof renderInsGrid==='function')renderInsGrid();
  if(typeof initRangeSelector==='function')initRangeSelector();
  if(typeof initAnthropicKeyDisplay==='function')initAnthropicKeyDisplay();
  if(typeof initStudentDbFields==='function')initStudentDbFields();
  try{if(typeof icsCache==='object')Object.keys(icsCache).forEach(k=>delete icsCache[k]);}catch(_){ }
}
function persistLocalConfig(){
  if(originalSaveData)originalSaveData();
}
function applyRemoteState(remote){
  if(!remote||remote.ok!==true)throw new Error(remote&&remote.message||'중앙 설정 읽기 실패');
  if(Array.isArray(remote.instructors))applyConfig(remote.instructors);
  state.revision=Number(remote.revision)||0;
  state.remoteApplied=Array.isArray(remote.instructors);
  persistLocalConfig();
  refreshRuntimeUi();
}
function isLoggedIn(){
  const el=document.getElementById('loginScreen');
  return !!(el&&el.style.display==='none');
}
function openScheduler(){
  const el=document.getElementById('loginScreen');
  if(el)el.style.display='none';
  refreshRuntimeUi();
}
function timeoutValue(promise,ms,value){
  return new Promise(resolve=>{
    let done=false;
    const timer=setTimeout(()=>{if(done)return;done=true;resolve(value);},ms);
    Promise.resolve(promise).then(v=>{if(done)return;done=true;clearTimeout(timer);resolve(v);},()=>{if(done)return;done=true;clearTimeout(timer);resolve(value);});
  });
}
function renderStatus(message,isError){
  state.lastError=isError?String(message||''):'';const el=document.getElementById('rm-shared-state-status');if(!el)return;
  if(message)el.textContent=message;else if(state.ready)el.textContent='중앙 설정 연결됨 · rev '+state.revision;
  else if(state.supported===false)el.textContent='중앙 설정 확인 지연 · 앱은 계속 사용 가능 · 백그라운드 재시도 중';
  else if(state.supported===true)el.textContent='중앙 백엔드 확인됨'+(state.statusData&&state.statusData.revision!=null?' · rev '+Number(state.statusData.revision||0):'');
  else el.textContent='중앙 설정 확인 중 · 앱 사용 가능';
  el.style.color=isError?'var(--danger)':(state.ready||state.supported===true?'var(--success)':'var(--muted)');
}
function scheduleRetry(){
  clearTimeout(state.retryTimer);
  if(state.ready||state.supported===true)return;
  state.retryTimer=setTimeout(()=>{status(true).catch(()=>{});},RETRY_MS);
}
async function status(force){
  if(!force&&state.statusData&&Date.now()-state.statusAt<STATUS_CACHE_MS)return state.statusData;
  if(state.statusPromise)return state.statusPromise;
  state.statusPromise=(async()=>{
    try{
      const x=await jsonp('state.status',{},STATUS_TIMEOUT_MS);
      state.statusData=x;state.statusAt=Date.now();
      state.supported=!!(x&&x.ok===true&&x.schema==='rm-shared-state-v1');
      renderStatus();
      if(!state.supported)scheduleRetry();
      return x;
    }catch(e){
      state.supported=false;
      renderStatus('중앙 설정 응답 지연 · 앱은 계속 사용 가능 · 자동 재시도 중',false);
      scheduleRetry();
      return null;
    }finally{state.statusPromise=null;}
  })();
  return state.statusPromise;
}
async function saveRemoteNow(){
  if(!state.ready||!state.proof||state.suppress)return false;
  if(state.savePromise)return state.savePromise;
  state.savePromise=(async()=>{
    const baseRevision=Number(state.revision)||0;
    const res=await jsonp('state.save',{proof:state.proof,baseRevision,config:JSON.stringify(compactInstructors())},10000);
    if(res&&res.status==='revision_conflict'){
      applyRemoteState(res);
      renderStatus('중앙 설정 충돌 · 최신 rev '+state.revision+' 적용됨',true);
      throw new Error('중앙 설정 충돌: 최신 설정을 다시 불러왔습니다. 변경사항을 확인 후 다시 저장하세요.');
    }
    if(!res||res.ok!==true)throw new Error(res&&res.message||'중앙 설정 저장 실패');
    state.revision=Number(res.revision)||state.revision;
    state.statusData=Object.assign({},state.statusData||{},{revision:state.revision,hasConfig:true});
    state.statusAt=Date.now();renderStatus('중앙 설정 저장됨 · rev '+state.revision,false);return true;
  })();
  try{return await state.savePromise;}finally{state.savePromise=null;}
}
function queueRemoteSave(){
  if(!state.ready||!state.proof||state.suppress)return;clearTimeout(state.syncTimer);
  state.syncTimer=setTimeout(()=>saveRemoteNow().catch(e=>renderStatus('저장 오류 · '+(e.message||String(e)),true)),350);
}
const originalSaveData=typeof saveData==='function'?saveData:null;
if(originalSaveData)saveData=function(){originalSaveData();queueRemoteSave();};

const originalDoLogin=typeof doLogin==='function'?doLogin:null;
async function completeRemoteLogin(proof,st,opts){
  opts=opts||{};
  state.suppress=true;
  try{
    if(!opts.skipLoad&&typeof loadData==='function')loadData();
    if(!st||st.schema!=='rm-shared-state-v1')st=await status(true);
    if(!st||state.supported!==true)throw new Error('중앙 설정 확인 지연');
    if(!st.passwordInitialized){
      const boot=await jsonp('state.bootstrap',{newHash:proof,config:JSON.stringify(compactInstructors())},10000);
      if(!boot||boot.ok!==true)throw new Error(boot&&boot.message||'중앙 설정 초기화 실패');
      state.statusData=Object.assign({},st,{passwordInitialized:true,hasConfig:true,revision:Number(boot.revision)||1});state.statusAt=Date.now();
    }else{
      const auth=await jsonp('state.auth',{proof},8000);
      if(!auth||auth.ok!==true||!auth.authorized)throw new Error('중앙 비밀번호가 일치하지 않습니다');
    }
    state.proof=proof;
    const remote=await jsonp('state.get',{proof},10000);
    applyRemoteState(remote);
    state.ready=true;state.pendingProof='';clearTimeout(state.retryTimer);clearTimeout(state.backgroundTimer);
    if(!opts.keepOpen)openScheduler();
    renderStatus();
    return true;
  }finally{
    state.suppress=false;
  }
}
function scheduleBackgroundLogin(proof){
  if(!proof||state.ready)return;
  state.pendingProof=proof;
  clearTimeout(state.backgroundTimer);
  const run=async()=>{
    if(state.ready||!state.pendingProof)return;
    try{
      renderStatus((isLoggedIn()?'로컬 설정으로 사용 중 · ':'')+'중앙 설정 백그라운드 확인 중',false);
      const st=await status(true);
      if(st&&state.supported===true){
        const localOpen=isLoggedIn();
        await completeRemoteLogin(state.pendingProof,st,{skipLoad:localOpen,keepOpen:localOpen});
        return;
      }
    }catch(e){
      if(/비밀번호|unauthorized|Invalid shared password/i.test(e&&e.message||String(e))){
        state.pendingProof='';renderStatus(e.message||String(e),true);return;
      }
    }
    state.backgroundTimer=setTimeout(run,RETRY_MS);
  };
  state.backgroundTimer=setTimeout(run,0);
}
doLogin=async function(){
  const pw=document.getElementById('pwInput').value;const err=document.getElementById('loginErr');if(err)err.style.display='none';
  const proof=await sha256(pw);
  const st=await timeoutValue(status(false),LOGIN_STATUS_TIMEOUT_MS,null);
  if(!st||state.supported!==true){
    if(originalDoLogin)originalDoLogin();
    scheduleBackgroundLogin(proof);
    return;
  }
  try{
    if(!st.passwordInitialized){
      state.suppress=true;if(typeof loadData==='function')loadData();state.suppress=false;
      const localExpected=localStorage.getItem('rm_pw')||PW_DEFAULT;
      if(pw!==localExpected){state.suppress=false;if(err)err.style.display='block';return;}
    }
    await completeRemoteLogin(proof,st,{skipLoad:!st.passwordInitialized,keepOpen:false});
  }catch(e){state.suppress=false;state.proof='';renderStatus('중앙 설정 오류 · '+(e.message||String(e)),true);if(err){err.textContent=e.message||'중앙 운영 설정 연결 오류';err.style.display='block';}}
};

const originalChangePw=typeof changePw==='function'?changePw:null;
changePw=async function(){
  if(!state.ready){if(originalChangePw)return originalChangePw();return;}
  const p1=document.getElementById('cfg-newpw').value,p2=document.getElementById('cfg-newpw2').value;
  if(!p1)return alert('새 비밀번호를 입력하세요.');if(p1!==p2)return alert('비밀번호가 일치하지 않습니다.');
  try{const newHash=await sha256(p1);const res=await jsonp('state.password',{proof:state.proof,newHash},10000);
    if(!res||res.ok!==true)throw new Error(res&&res.message||'비밀번호 변경 실패');state.proof=newHash;localStorage.removeItem('rm_pw');
    document.getElementById('cfg-newpw').value='';document.getElementById('cfg-newpw2').value='';renderStatus('공용 비밀번호 변경 완료',false);alert('공용 비밀번호가 변경되었습니다.');
  }catch(e){renderStatus('비밀번호 변경 오류 · '+(e.message||String(e)),true);alert(e.message||String(e));}
};

function injectUi(){
  const page=document.getElementById('page-settings');if(!page||document.getElementById('rmSharedStateCard'))return;
  const card=document.createElement('div');card.id='rmSharedStateCard';card.className='card';
  card.innerHTML='<div class="card-title">운영팀 공용 설정</div><div class="notice"><b>온라인 공유 저장</b> 로그인 비밀번호, 강사 가능요일, 공통/요일별 가능시간, 과목, 최대 연강만 중앙 저장합니다. 학생 정보, Calendar 이벤트 내용, Calendar ID/profile 전체 객체는 중앙화하지 않습니다.</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span id="rm-shared-state-status" style="font-size:12px;color:var(--muted)">중앙 설정 확인 중 · 앱 사용 가능</span><button id="rm-shared-state-retry" class="btn btn-sm" type="button">다시 확인</button><button id="rm-shared-state-pull" class="btn btn-sm" type="button">중앙 설정 불러오기</button><button id="rm-shared-state-push" class="btn btn-sm" type="button">현재 설정 저장</button></div>';
  const anchor=document.getElementById('rmAppsScriptCard')||page.querySelector('.sec-sub');if(anchor)anchor.insertAdjacentElement('afterend',card);else page.prepend(card);
  card.querySelector('#rm-shared-state-retry').onclick=()=>{renderStatus('중앙 설정 다시 확인 중 · 앱 사용 가능',false);status(true).catch(()=>{});};
  card.querySelector('#rm-shared-state-pull').onclick=async()=>{try{if(!state.ready)throw new Error('로그인 후 사용할 수 있습니다');state.suppress=true;const remote=await jsonp('state.get',{proof:state.proof},10000);applyRemoteState(remote);renderStatus('중앙 설정 불러옴 · rev '+state.revision,false);}catch(e){renderStatus('불러오기 오류 · '+(e.message||String(e)),true);}finally{state.suppress=false;}};
  card.querySelector('#rm-shared-state-push').onclick=()=>saveRemoteNow().catch(e=>renderStatus('저장 오류 · '+(e.message||String(e)),true));
  renderStatus();
}
injectUi();
setTimeout(()=>{status(false).catch(()=>{});},0);
window.__RMV2_SHARED_STATE__={version:VERSION,state,status,saveRemoteNow,compactInstructors,applyConfig,applyRemoteState};
try{parent.postMessage({type:'rmv2-shared-state-ready',shared:{version:VERSION}},location.origin);}catch(_){ }
})();
