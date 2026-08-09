(function(){
'use strict';

const VERSION='2026.08.09.1';
const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbyX5Rm89c_lJOBt6L_aGlz0a87k6V7gqAS7bCP5WfrPE9Cv-SWLD2aDZSCJqMDUstxe6A/exec';
const state={proof:'',revision:0,ready:false,suppress:false,syncTimer:null,lastError:''};

function endpoint(){
  try{
    const a=window.__RMV2_APPS_SCRIPT__;
    if(a&&typeof a.endpoint==='function'&&a.endpoint())return a.endpoint();
  }catch(_){ }
  return DEFAULT_ENDPOINT;
}

function jsonp(action,params,timeoutMs){
  return new Promise((resolve,reject)=>{
    const cb='__rmStateCb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const s=document.createElement('script');
    let done=false;
    const cleanup=()=>{try{delete window[cb];}catch(_){window[cb]=undefined;}if(s.parentNode)s.parentNode.removeChild(s);};
    const timer=setTimeout(()=>{if(done)return;done=true;cleanup();reject(new Error('중앙 설정 응답 시간초과'));},timeoutMs||15000);
    window[cb]=(data)=>{if(done)return;done=true;clearTimeout(timer);cleanup();resolve(data);};
    s.onerror=()=>{if(done)return;done=true;clearTimeout(timer);cleanup();reject(new Error('중앙 설정 연결 실패'));};
    const q=new URLSearchParams(Object.assign({},params||{},{action,callback:cb,_:Date.now()}));
    s.src=endpoint()+(endpoint().includes('?')?'&':'?')+q.toString();
    document.head.appendChild(s);
  });
}

async function sha256(text){
  const bytes=new TextEncoder().encode(String(text||''));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function compactInstructors(){
  return (Array.isArray(instructors)?instructors:[]).map(ins=>({
    id:String(ins.id||''),
    days:Array.isArray(ins.days)?ins.days.slice(0,7):[],
    times:Array.isArray(ins.times)?ins.times.slice(0,32):[],
    dayTimes:ins.dayTimes&&typeof ins.dayTimes==='object'?ins.dayTimes:{},
    subjects:Array.isArray(ins.subjects)?ins.subjects.slice(0,32):[],
    maxConsec:Number(ins.maxConsec)||4
  })).filter(x=>x.id);
}

function applyConfig(rows){
  if(!Array.isArray(rows)||!Array.isArray(instructors))return;
  const byId=new Map(rows.filter(x=>x&&x.id).map(x=>[String(x.id),x]));
  instructors.forEach(ins=>{
    const x=byId.get(String(ins.id));
    if(!x)return;
    if(Array.isArray(x.days))ins.days=x.days.slice();
    if(Array.isArray(x.times))ins.times=x.times.slice();
    if(x.dayTimes&&typeof x.dayTimes==='object')ins.dayTimes=JSON.parse(JSON.stringify(x.dayTimes));
    if(Array.isArray(x.subjects))ins.subjects=x.subjects.slice();
    if(Number.isFinite(Number(x.maxConsec)))ins.maxConsec=Number(x.maxConsec);
  });
}

function renderStatus(message,isError){
  state.lastError=isError?String(message||''):'';
  const el=document.getElementById('rm-shared-state-status');
  if(!el)return;
  el.textContent=message|| (state.ready?'중앙 설정 연결됨':'중앙 설정 대기');
  el.style.color=isError?'var(--danger)':(state.ready?'var(--success)':'var(--muted)');
}

async function saveRemoteNow(){
  if(!state.proof||state.suppress)return false;
  const config=JSON.stringify(compactInstructors());
  const res=await jsonp('state.save',{proof:state.proof,config},18000);
  if(!res||res.ok!==true){throw new Error(res&&res.message||'중앙 설정 저장 실패');}
  state.revision=Number(res.revision)||state.revision;
  renderStatus('중앙 설정 저장됨 · rev '+state.revision,false);
  return true;
}

function queueRemoteSave(){
  if(!state.proof||state.suppress)return;
  clearTimeout(state.syncTimer);
  state.syncTimer=setTimeout(()=>{
    saveRemoteNow().catch(e=>renderStatus('저장 오류 · '+(e.message||String(e)),true));
  },250);
}

const originalSaveData=typeof saveData==='function'?saveData:null;
if(originalSaveData){
  saveData=function(){
    originalSaveData();
    queueRemoteSave();
  };
}

const originalDoLogin=typeof doLogin==='function'?doLogin:null;
doLogin=async function(){
  const pw=document.getElementById('pwInput').value;
  const errEl=document.getElementById('loginErr');
  if(errEl)errEl.style.display='none';
  try{
    const proof=await sha256(pw);
    const status=await jsonp('state.status',{},12000);
    if(!status||status.ok!==true||status.schema!=='rm-shared-state-v1')throw new Error('중앙 설정 API가 아직 활성화되지 않았습니다.');

    state.suppress=true;
    if(typeof loadData==='function')loadData();

    if(!status.passwordInitialized){
      const localExpected=localStorage.getItem('rm_pw')||PW_DEFAULT;
      if(pw!==localExpected){
        state.suppress=false;
        if(errEl)errEl.style.display='block';
        return;
      }
      const boot=await jsonp('state.bootstrap',{newHash:proof,config:JSON.stringify(compactInstructors())},18000);
      if(!boot||boot.ok!==true)throw new Error(boot&&boot.message||'중앙 설정 초기화 실패');
    }else{
      const auth=await jsonp('state.auth',{proof},12000);
      if(!auth||auth.ok!==true||!auth.authorized){
        state.suppress=false;
        if(errEl)errEl.style.display='block';
        return;
      }
    }

    state.proof=proof;
    const remote=await jsonp('state.get',{proof},15000);
    if(!remote||remote.ok!==true)throw new Error(remote&&remote.message||'중앙 설정 읽기 실패');
    if(Array.isArray(remote.instructors))applyConfig(remote.instructors);
    state.revision=Number(remote.revision)||0;
    if(originalSaveData)originalSaveData();
    state.suppress=false;
    state.ready=true;

    document.getElementById('loginScreen').style.display='none';
    if(typeof refreshInsSel==='function')refreshInsSel();
    if(typeof renderSubjectCBs==='function')renderSubjectCBs('s-subjects',[]);
    if(typeof renderDayCBs==='function')renderDayCBs();
    if(typeof ensureFrequencyOptions==='function')ensureFrequencyOptions();
    if(typeof renderInsGrid==='function')renderInsGrid();
    if(typeof initRangeSelector==='function')initRangeSelector();
    if(typeof initAnthropicKeyDisplay==='function')initAnthropicKeyDisplay();
    if(typeof initStudentDbFields==='function')initStudentDbFields();
    renderStatus('중앙 설정 연결됨 · rev '+state.revision,false);
  }catch(e){
    state.suppress=false;
    state.proof='';
    renderStatus('연결 오류 · '+(e.message||String(e)),true);
    if(errEl){errEl.textContent='중앙 운영 설정 연결 오류';errEl.style.display='block';}
  }
};

changePw=async function(){
  const p1=document.getElementById('cfg-newpw').value;
  const p2=document.getElementById('cfg-newpw2').value;
  if(!p1)return alert('새 비밀번호를 입력하세요.');
  if(p1!==p2)return alert('비밀번호가 일치하지 않습니다.');
  if(!state.proof)return alert('중앙 설정 로그인 상태가 아닙니다.');
  try{
    const newHash=await sha256(p1);
    const res=await jsonp('state.password',{proof:state.proof,newHash},15000);
    if(!res||res.ok!==true)throw new Error(res&&res.message||'비밀번호 변경 실패');
    state.proof=newHash;
    localStorage.removeItem('rm_pw');
    document.getElementById('cfg-newpw').value='';
    document.getElementById('cfg-newpw2').value='';
    renderStatus('공용 비밀번호 변경 완료',false);
    alert('공용 비밀번호가 변경되었습니다. 다른 운영팀원도 새 비밀번호를 사용합니다.');
  }catch(e){
    renderStatus('비밀번호 변경 오류 · '+(e.message||String(e)),true);
    alert(e.message||String(e));
  }
};

function injectUi(){
  const page=document.getElementById('page-settings');
  if(!page||document.getElementById('rmSharedStateCard'))return;
  const card=document.createElement('div');
  card.id='rmSharedStateCard';card.className='card';
  card.innerHTML='<div class="card-title">운영팀 공용 설정</div><div class="notice"><b>비밀번호와 강사 스케줄 설정은 RMHQ 중앙 저장소를 사용합니다.</b> 어느 PC에서 수정해도 다음 로그인부터 다른 운영팀원에게 동일하게 적용됩니다.</div><div id="rm-shared-state-status" style="font-size:12px;color:var(--muted)">중앙 설정 대기</div>';
  const anchor=document.getElementById('rmAppsScriptCard')||page.querySelector('.sec-sub');
  if(anchor)anchor.insertAdjacentElement('afterend',card);else page.prepend(card);
  renderStatus();
}

injectUi();
window.__RMV2_SHARED_STATE__={version:VERSION,state,saveRemoteNow,compactInstructors};
})();
