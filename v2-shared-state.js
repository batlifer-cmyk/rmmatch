(function(){
'use strict';

const VERSION='2026.08.10.2';
const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbyX5Rm89c_lJOBt6L_aGlz0a87k6V7gqAS7bCP5WfrPE9Cv-SWLD2aDZSCJqMDUstxe6A/exec';
const state={proof:'',revision:0,ready:false,supported:null,suppress:false,syncTimer:null,lastError:''};

function endpoint(){
  try{const a=window.__RMV2_APPS_SCRIPT__;if(a&&typeof a.endpoint==='function'&&a.endpoint())return a.endpoint();}catch(_){ }
  return DEFAULT_ENDPOINT;
}
function jsonp(action,params,timeoutMs){
  return new Promise((resolve,reject)=>{
    const cb='__rmStateCb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const s=document.createElement('script');let done=false;
    const cleanup=()=>{try{delete window[cb];}catch(_){window[cb]=undefined;}if(s.parentNode)s.parentNode.removeChild(s);};
    const timer=setTimeout(()=>{if(done)return;done=true;cleanup();reject(new Error('중앙 설정 응답 시간초과'));},timeoutMs||12000);
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
function renderStatus(message,isError){
  state.lastError=isError?String(message||''):'';const el=document.getElementById('rm-shared-state-status');if(!el)return;
  if(message)el.textContent=message;else if(state.ready)el.textContent='중앙 설정 연결됨 · rev '+state.revision;
  else if(state.supported===false)el.textContent='중앙 공유 백엔드 배포 대기 · 현재 이 브라우저 로컬 설정 사용';
  else el.textContent='중앙 설정 확인 중';
  el.style.color=isError?'var(--danger)':(state.ready?'var(--success)':'var(--muted)');
}
async function status(){
  try{const x=await jsonp('state.status',{},9000);state.supported=!!(x&&x.ok===true&&x.schema==='rm-shared-state-v1');renderStatus();return x;}catch(e){state.supported=false;renderStatus();return null;}
}
async function saveRemoteNow(){
  if(!state.ready||!state.proof||state.suppress)return false;
  const res=await jsonp('state.save',{proof:state.proof,config:JSON.stringify(compactInstructors())},15000);
  if(!res||res.ok!==true)throw new Error(res&&res.message||'중앙 설정 저장 실패');
  state.revision=Number(res.revision)||state.revision;renderStatus('중앙 설정 저장됨 · rev '+state.revision,false);return true;
}
function queueRemoteSave(){
  if(!state.ready||!state.proof||state.suppress)return;clearTimeout(state.syncTimer);
  state.syncTimer=setTimeout(()=>saveRemoteNow().catch(e=>renderStatus('저장 오류 · '+(e.message||String(e)),true)),350);
}
const originalSaveData=typeof saveData==='function'?saveData:null;
if(originalSaveData)saveData=function(){originalSaveData();queueRemoteSave();};

const originalDoLogin=typeof doLogin==='function'?doLogin:null;
doLogin=async function(){
  const pw=document.getElementById('pwInput').value;const err=document.getElementById('loginErr');if(err)err.style.display='none';
  const st=await status();
  if(!st||state.supported!==true){
    if(originalDoLogin)return originalDoLogin();
    return;
  }
  try{
    const proof=await sha256(pw);state.suppress=true;if(typeof loadData==='function')loadData();
    if(!st.passwordInitialized){
      const localExpected=localStorage.getItem('rm_pw')||PW_DEFAULT;
      if(pw!==localExpected){state.suppress=false;if(err)err.style.display='block';return;}
      const boot=await jsonp('state.bootstrap',{newHash:proof,config:JSON.stringify(compactInstructors())},16000);
      if(!boot||boot.ok!==true)throw new Error(boot&&boot.message||'중앙 설정 초기화 실패');
    }else{
      const auth=await jsonp('state.auth',{proof},12000);
      if(!auth||auth.ok!==true||!auth.authorized){state.suppress=false;if(err)err.style.display='block';return;}
    }
    state.proof=proof;const remote=await jsonp('state.get',{proof},15000);
    if(!remote||remote.ok!==true)throw new Error(remote&&remote.message||'중앙 설정 읽기 실패');
    if(Array.isArray(remote.instructors))applyConfig(remote.instructors);state.revision=Number(remote.revision)||0;
    if(originalSaveData)originalSaveData();state.suppress=false;state.ready=true;
    document.getElementById('loginScreen').style.display='none';
    if(typeof refreshInsSel==='function')refreshInsSel();if(typeof renderSubjectCBs==='function')renderSubjectCBs('s-subjects',[]);
    if(typeof renderDayCBs==='function')renderDayCBs();if(typeof ensureFrequencyOptions==='function')ensureFrequencyOptions();
    if(typeof renderInsGrid==='function')renderInsGrid();if(typeof initRangeSelector==='function')initRangeSelector();
    if(typeof initAnthropicKeyDisplay==='function')initAnthropicKeyDisplay();if(typeof initStudentDbFields==='function')initStudentDbFields();renderStatus();
  }catch(e){state.suppress=false;state.proof='';renderStatus('중앙 설정 오류 · '+(e.message||String(e)),true);if(err){err.textContent='중앙 운영 설정 연결 오류';err.style.display='block';}}
};

const originalChangePw=typeof changePw==='function'?changePw:null;
changePw=async function(){
  if(!state.ready){if(originalChangePw)return originalChangePw();return;}
  const p1=document.getElementById('cfg-newpw').value,p2=document.getElementById('cfg-newpw2').value;
  if(!p1)return alert('새 비밀번호를 입력하세요.');if(p1!==p2)return alert('비밀번호가 일치하지 않습니다.');
  try{const newHash=await sha256(p1);const res=await jsonp('state.password',{proof:state.proof,newHash},15000);
    if(!res||res.ok!==true)throw new Error(res&&res.message||'비밀번호 변경 실패');state.proof=newHash;localStorage.removeItem('rm_pw');
    document.getElementById('cfg-newpw').value='';document.getElementById('cfg-newpw2').value='';renderStatus('공용 비밀번호 변경 완료',false);alert('공용 비밀번호가 변경되었습니다.');
  }catch(e){renderStatus('비밀번호 변경 오류 · '+(e.message||String(e)),true);alert(e.message||String(e));}
};

function injectUi(){
  const page=document.getElementById('page-settings');if(!page||document.getElementById('rmSharedStateCard'))return;
  const card=document.createElement('div');card.id='rmSharedStateCard';card.className='card';
  card.innerHTML='<div class="card-title">운영팀 공용 설정</div><div class="notice"><b>온라인 공유 대상:</b> 로그인 비밀번호, 강사 가능요일, 공통/요일별 가능시간, 과목, 최대 연강. 중앙 백엔드가 활성화되면 어느 PC에서 수정해도 동일하게 반영됩니다.</div><div id="rm-shared-state-status" style="font-size:12px;color:var(--muted)">중앙 설정 확인 중</div>';
  const anchor=document.getElementById('rmAppsScriptCard')||page.querySelector('.sec-sub');if(anchor)anchor.insertAdjacentElement('afterend',card);else page.prepend(card);renderStatus();
}
injectUi();status();
window.__RMV2_SHARED_STATE__={version:VERSION,state,status,saveRemoteNow,compactInstructors,applyConfig};
try{parent.postMessage({type:'rmv2-shared-state-ready',shared:{version:VERSION}},location.origin);}catch(_){ }
})();
