(function(){
'use strict';

const VERSION='2026.08.09.1';
const CANONICAL_IDS=new Set(['matthew','david','paul','jenna','dean']);

function googleReader(){return window.__RMV2_GOOGLE__||null;}
function googleConnected(){const g=googleReader();return !!(g&&typeof g.token==='function'&&g.token());}

if(typeof fetchICS==='function'){
  const fallbackFetchICS=fetchICS;
  fetchICS=async function(ins){
    if(!ins||!CANONICAL_IDS.has(ins.id))return fallbackFetchICS(ins);

    const g=googleReader();
    if(g&&typeof g.fetchInstructorCalendar==='function'&&googleConnected()){
      try{
        const slots=await g.fetchInstructorCalendar(ins);
        if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots:Array.isArray(slots)?slots:[],transport:'google-api-live',ok:true,calendarId:ins.calendarId};
        try{if(window.__RMV2_CALENDAR__&&window.__RMV2_CALENDAR__.unavailableCalendarInstructors)window.__RMV2_CALENDAR__.unavailableCalendarInstructors.delete(ins.id);}catch(_){ }
        return Array.isArray(slots)?slots:[];
      }catch(e){
        if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots:[],transport:'google-api-live-failed',ok:false,error:e&&e.message||String(e)};
        try{if(window.__RMV2_CALENDAR__&&window.__RMV2_CALENDAR__.unavailableCalendarInstructors)window.__RMV2_CALENDAR__.unavailableCalendarInstructors.add(ins.id);}catch(_){ }
        return [];
      }
    }

    return fallbackFetchICS(ins);
  };
}

function patchUi(){
  const page=document.getElementById('page-settings');
  if(!page||document.getElementById('rmLiveRefreshNotice'))return;
  const box=document.createElement('div');
  box.id='rmLiveRefreshNotice';
  box.className='notice';
  box.style.marginTop='12px';
  box.innerHTML='<b>추천 시 최신조회:</b> 운영팀 Google Calendar가 연결되어 있으면 스케줄 충돌 확인 때마다 Matthew · David · Paul · Jenna · Dean의 원본 캘린더를 즉시 다시 읽습니다. 직접조회 실패 시 해당 강사는 빈 시간으로 보지 않고 추천에서 제외합니다. Google 연결이 없을 때만 익명 BUSY 스냅샷을 사용합니다.';
  const anchor=document.getElementById('rmv2CalendarSourceNotice')||document.getElementById('rmSnapshotCard')||page.querySelector('.sec-sub');
  if(anchor)anchor.insertAdjacentElement('afterend',box);else page.prepend(box);
}

patchUi();
window.__RMV2_LIVE_REFRESH__={version:VERSION,googleConnected};
try{parent.postMessage({type:'rmv2-live-refresh-ready',live:{version:VERSION,googleConnected:googleConnected()}},location.origin);}catch(_){ }
})();
