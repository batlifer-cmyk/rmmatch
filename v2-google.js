(function(){
'use strict';

const VERSION='2026.08.08.2';
const CLIENT_KEY='rm_google_oauth_client_id';
const TOKEN_KEY='rm_google_access_token';
const EXP_KEY='rm_google_access_token_exp';
const SCOPE='https://www.googleapis.com/auth/calendar.readonly';
let tokenClient=null;
let gisPromise=null;

function clientId(){return String(localStorage.getItem(CLIENT_KEY)||'').trim();}
function token(){
  const t=sessionStorage.getItem(TOKEN_KEY)||'';
  const exp=Number(sessionStorage.getItem(EXP_KEY)||0);
  if(!t||!exp||Date.now()>exp-60000)return '';
  return t;
}
function clearToken(){sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(EXP_KEY);}
function saveClientId(value){
  const v=String(value||'').trim();
  if(v)localStorage.setItem(CLIENT_KEY,v);else localStorage.removeItem(CLIENT_KEY);
  clearToken();tokenClient=null;renderStatus();
}
function loadGis(){
  if(window.google&&google.accounts&&google.accounts.oauth2)return Promise.resolve();
  if(gisPromise)return gisPromise;
  gisPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;
    s.onload=()=>resolve();s.onerror=()=>reject(new Error('Google Identity Services 로드 실패'));
    document.head.appendChild(s);
  });
  return gisPromise;
}
async function ensureTokenClient(){
  const id=clientId();
  if(!id)throw new Error('Google OAuth Client ID가 설정되지 않았습니다.');
  await loadGis();
  if(tokenClient)return tokenClient;
  tokenClient=google.accounts.oauth2.initTokenClient({client_id:id,scope:SCOPE,callback:()=>{}});
  return tokenClient;
}
async function connect(promptMode){
  const tc=await ensureTokenClient();
  return new Promise((resolve,reject)=>{
    tc.callback=(resp)=>{
      if(resp&&resp.error){clearToken();renderStatus(resp.error);reject(new Error(resp.error));return;}
      if(!resp||!resp.access_token){clearToken();renderStatus('토큰 없음');reject(new Error('Google 로그인 토큰을 받지 못했습니다.'));return;}
      sessionStorage.setItem(TOKEN_KEY,resp.access_token);
      sessionStorage.setItem(EXP_KEY,String(Date.now()+(Number(resp.expires_in)||3600)*1000));
      try{if(typeof icsCache==='object')Object.keys(icsCache).forEach(k=>delete icsCache[k]);}catch(_){ }
      renderStatus();resolve(resp.access_token);
    };
    tc.requestAccessToken({prompt:promptMode===false?'':'select_account consent'});
  });
}
async function apiFetch(url){
  const t=token();
  if(!t)throw new Error('RMHQ Google 로그인이 필요합니다.');
  const res=await fetch(url,{headers:{Authorization:'Bearer '+t},cache:'no-store'});
  if(res.status===401){clearToken();throw new Error('Google 로그인 세션이 만료되었습니다. 다시 연결하세요.');}
  if(!res.ok){let detail='';try{detail=(await res.json())?.error?.message||'';}catch(_){ }throw new Error('Google Calendar API '+res.status+(detail?' · '+detail:''));}
  return res.json();
}
function dateKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function eventToSlot(ev){
  if(!ev||ev.status==='cancelled'||ev.transparency==='transparent'||!ev.start||ev.start.date||!ev.start.dateTime)return null;
  const s=new Date(ev.start.dateTime),e=new Date(ev.end&&ev.end.dateTime||new Date(s.getTime()+3600000));
  if(!Number.isFinite(s.getTime())||!Number.isFinite(e.getTime())||e<=s)return null;
  const startMin=s.getHours()*60+s.getMinutes();
  const duration=Math.max(1,Math.round((e-s)/60000));
  return {dow:s.getDay(),hour:s.getHours(),minute:s.getMinutes(),startMin,endMin:Math.min(1440,startMin+duration),dateStr:dateKey(s),startMs:s.getTime(),endMs:e.getTime(),recurring:false,uid:ev.id||'',summary:ev.summary||'',transport:'google-api'};
}
async function fetchInstructorCalendar(ins){
  if(!ins||!ins.calendarId)return null;
  const weeks=(typeof icsRangeWeeks==='number'&&icsRangeWeeks>0)?icsRangeWeeks:2;
  const from=new Date();from.setHours(0,0,0,0);from.setDate(from.getDate()-weeks*7);
  const to=new Date();to.setHours(23,59,59,999);to.setDate(to.getDate()+weeks*7);
  const params=new URLSearchParams({timeMin:from.toISOString(),timeMax:to.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'2500'});
  let pageToken='',items=[];
  do{
    if(pageToken)params.set('pageToken',pageToken);else params.delete('pageToken');
    const url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(ins.calendarId)+'/events?'+params.toString();
    const data=await apiFetch(url);
    items=items.concat(data.items||[]);pageToken=data.nextPageToken||'';
  }while(pageToken&&items.length<5000);
  const slots=items.map(eventToSlot).filter(Boolean);
  if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots,transport:'google-api',ok:true,calendarId:ins.calendarId};
  return slots;
}
function renderStatus(err){
  const st=document.getElementById('rm-google-status');if(!st)return;
  if(err){st.textContent='연결 오류 · '+err;st.style.color='var(--danger)';return;}
  if(!clientId()){st.textContent='OAuth Client ID 미설정';st.style.color='var(--danger)';return;}
  if(token()){st.textContent='RMHQ Google 연결됨 · Calendar 읽기 가능';st.style.color='var(--success)';return;}
  st.textContent='Client ID 설정됨 · 운영팀 Google 연결 필요';st.style.color='var(--muted)';
}
function injectUi(){
  const page=document.getElementById('page-settings');
  if(!page||document.getElementById('rmGoogleAuthCard'))return;
  const card=document.createElement('div');card.id='rmGoogleAuthCard';card.className='card';
  card.innerHTML='<div class="card-title">Google Calendar · 운영팀 계정</div>'+ '<div class="notice">스케줄러는 <b>ryanmembers.rmhq@gmail.com</b>으로 로그인해 강사 원본 캘린더를 읽습니다. 토큰은 현재 브라우저 탭 세션에만 저장됩니다.</div>'+ '<div class="form-group" style="margin-top:12px"><label>Google OAuth Web Client ID</label><input id="rm-google-client-id" type="text" autocomplete="off" placeholder="1234567890-....apps.googleusercontent.com"></div>'+ '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px"><button id="rm-google-save" class="btn btn-ghost btn-sm">Client ID 저장</button><button id="rm-google-connect" class="btn btn-primary btn-sm">운영팀 Google 연결</button><button id="rm-google-disconnect" class="btn btn-ghost btn-sm">세션 해제</button><span id="rm-google-status" style="font-size:12px"></span></div>'+ '<div style="font-size:11px;color:var(--muted);line-height:1.65;margin-top:10px">Google Cloud의 OAuth Web Client에 <b>Authorized JavaScript origin</b>으로 <code>https://batlifer-cmyk.github.io</code>를 등록해야 합니다. Google Calendar API를 활성화하고, 승인 화면에서는 반드시 <b>ryanmembers.rmhq@gmail.com</b>을 선택하세요. 권한은 Calendar 읽기 전용입니다.</div>';
  const anchor=document.getElementById('rmv2Safety')||page.querySelector('.sec-sub');
  if(anchor)anchor.insertAdjacentElement('afterend',card);else page.prepend(card);
  const input=card.querySelector('#rm-google-client-id');input.value=clientId();
  card.querySelector('#rm-google-save').onclick=()=>saveClientId(input.value);
  card.querySelector('#rm-google-connect').onclick=async()=>{try{await connect(true);if(typeof testAllICS==='function')await testAllICS();}catch(e){renderStatus(e.message||String(e));}};
  card.querySelector('#rm-google-disconnect').onclick=()=>{clearToken();renderStatus();};
  renderStatus();
}

injectUi();
window.__RMV2_GOOGLE__={version:VERSION,clientId,token,connect,fetchInstructorCalendar,clearToken,renderStatus};
try{parent.postMessage({type:'rmv2-google-ready',google:{version:VERSION,configured:!!clientId(),connected:!!token()}},location.origin);}catch(_){ }
})();
