(function(){
'use strict';

const VERSION='2026.08.09.1';
const ENDPOINT_KEY='rm_calendar_apps_script_url';
const CACHE_MS=30000;
const state={data:null,fetchedAt:0,promise:null,error:''};

function endpoint(){return String(localStorage.getItem(ENDPOINT_KEY)||'').trim();}
function saveEndpoint(value){
  const v=String(value||'').trim();
  if(v)localStorage.setItem(ENDPOINT_KEY,v);else localStorage.removeItem(ENDPOINT_KEY);
  state.data=null;state.fetchedAt=0;state.error='';renderStatus();
}
function configured(){return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(endpoint());}
function dateKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function range(){
  const from=new Date();from.setHours(0,0,0,0);
  const to=new Date(from.getTime()+45*24*60*60*1000);
  return {from:dateKey(from),to:dateKey(to)};
}
function jsonp(url,timeoutMs){
  return new Promise((resolve,reject)=>{
    const cb='__rmCalCb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const s=document.createElement('script');
    let done=false;
    const cleanup=()=>{try{delete window[cb];}catch(_){window[cb]=undefined;}if(s.parentNode)s.parentNode.removeChild(s);};
    const timer=setTimeout(()=>{if(done)return;done=true;cleanup();reject(new Error('Apps Script 응답 시간초과'));},timeoutMs||15000);
    window[cb]=(data)=>{if(done)return;done=true;clearTimeout(timer);cleanup();resolve(data);};
    s.onerror=()=>{if(done)return;done=true;clearTimeout(timer);cleanup();reject(new Error('Apps Script 연결 실패'));};
    const sep=url.includes('?')?'&':'?';
    s.src=url+sep+'action=calendar.busy&callback='+encodeURIComponent(cb)+'&from='+encodeURIComponent(range().from)+'&to='+encodeURIComponent(range().to)+'&_='+Date.now();
    document.head.appendChild(s);
  });
}
function slotFromRow(row){
  if(!row||!row.start||!row.end)return null;
  const s=new Date(row.start),e=new Date(row.end);
  if(!Number.isFinite(s.getTime())||!Number.isFinite(e.getTime())||e<=s)return null;
  const startMin=s.getHours()*60+s.getMinutes(),endMin=e.getHours()*60+e.getMinutes();
  return {dow:s.getDay(),hour:s.getHours(),minute:s.getMinutes(),startMin,endMin:endMin||1440,dateStr:dateKey(s),startMs:s.getTime(),endMs:e.getTime(),recurring:false,uid:'',summary:'',transport:'apps-script-live'};
}
async function fetchAll(force){
  if(!configured())throw new Error('Apps Script Web App URL 미설정');
  if(!force&&state.data&&Date.now()-state.fetchedAt<CACHE_MS)return state.data;
  if(state.promise&&!force)return state.promise;
  state.promise=(async()=>{
    try{
      const data=await jsonp(endpoint(),18000);
      if(!data||data.ok!==true||data.schema!=='rm-calendar-live-v1'||!data.instructors)throw new Error(data&&data.message||'Apps Script 응답 형식 오류');
      state.data=data;state.fetchedAt=Date.now();state.error='';renderStatus();
      return data;
    }catch(e){state.error=e&&e.message||String(e);renderStatus();throw e;}
    finally{state.promise=null;}
  })();
  return state.promise;
}
async function slotsFor(id,force){
  const data=await fetchAll(!!force);
  if(!Object.prototype.hasOwnProperty.call(data.instructors,id))throw new Error('강사 일정 없음: '+id);
  return (Array.isArray(data.instructors[id])?data.instructors[id]:[]).map(slotFromRow).filter(Boolean);
}
async function test(){await fetchAll(true);return true;}
function renderStatus(err){
  const el=document.getElementById('rm-apps-status');if(!el)return;
  const msg=err||state.error;
  if(msg){el.textContent='연결 오류 · '+msg;el.style.color='var(--danger)';return;}
  if(!configured()){el.textContent='배포 URL 미설정';el.style.color='var(--muted)';return;}
  if(state.data){el.textContent='연결 정상 · '+(state.data.generatedAt||'최신 BUSY');el.style.color='var(--success)';return;}
  el.textContent='배포 URL 설정됨 · 스케줄링 시 실시간 조회';el.style.color='var(--muted)';
}
function injectUi(){
  const page=document.getElementById('page-settings');
  if(!page||document.getElementById('rmAppsScriptCard'))return;
  const card=document.createElement('div');card.id='rmAppsScriptCard';card.className='card';
  card.innerHTML='<div class="card-title">Google Calendar · RMHQ Apps Script</div>'+
    '<div class="notice"><b>기본 실시간 소스</b>입니다. 스케줄링할 때 RMHQ 권한으로 5명 강사 원본 캘린더를 읽고 학생명 없이 BUSY 시간만 반환합니다. Google Cloud 결제 연결은 필요하지 않습니다.</div>'+
    '<div class="form-group" style="margin-top:12px"><label>Apps Script Web App URL</label><input id="rm-apps-url" type="url" autocomplete="off" placeholder="https://script.google.com/macros/s/.../exec"></div>'+
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px"><button id="rm-apps-save" class="btn btn-primary btn-sm">URL 저장</button><button id="rm-apps-test" class="btn btn-ghost btn-sm">실시간 연결 테스트</button><span id="rm-apps-status" style="font-size:12px"></span></div>';
  const anchor=document.getElementById('rmv2Safety')||page.querySelector('.sec-sub');
  if(anchor)anchor.insertAdjacentElement('afterend',card);else page.prepend(card);
  const input=card.querySelector('#rm-apps-url');input.value=endpoint();
  card.querySelector('#rm-apps-save').onclick=()=>{saveEndpoint(input.value);};
  card.querySelector('#rm-apps-test').onclick=async()=>{try{saveEndpoint(input.value);await test();renderStatus();if(typeof testAllICS==='function')await testAllICS();}catch(e){renderStatus(e.message||String(e));}};
  renderStatus();
}

injectUi();
window.__RMV2_APPS_SCRIPT__={version:VERSION,state,endpoint,saveEndpoint,configured,fetchAll,slotsFor,test};
try{parent.postMessage({type:'rmv2-apps-script-ready',appsScript:{version:VERSION,configured:configured()}},location.origin);}catch(_){ }
})();
