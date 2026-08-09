(function(){
'use strict';

const VERSION='2026.08.09.2';
const CANONICAL_IDS=new Set(['matthew','david','paul','jenna','dean']);

function appsReader(){return window.__RMV2_APPS_SCRIPT__||null;}
function appsConfigured(){const a=appsReader();return !!(a&&typeof a.configured==='function'&&a.configured());}
function googleReader(){return window.__RMV2_GOOGLE__||null;}
function googleConnected(){const g=googleReader();return !!(g&&typeof g.token==='function'&&g.token());}
function markUnavailable(id,on){try{const set=window.__RMV2_CALENDAR__&&window.__RMV2_CALENDAR__.unavailableCalendarInstructors;if(set){if(on)set.add(id);else set.delete(id);}}catch(_){ }}

if(typeof fetchICS==='function'){
  const fallbackFetchICS=fetchICS;
  fetchICS=async function(ins){
    if(!ins||!CANONICAL_IDS.has(ins.id))return fallbackFetchICS(ins);

    const a=appsReader();
    if(a&&typeof a.slotsFor==='function'&&appsConfigured()){
      try{
        const slots=await a.slotsFor(ins.id,false);
        if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots:Array.isArray(slots)?slots:[],transport:'apps-script-live',ok:true};
        markUnavailable(ins.id,false);
        return Array.isArray(slots)?slots:[];
      }catch(appErr){
        const g=googleReader();
        if(g&&typeof g.fetchInstructorCalendar==='function'&&googleConnected()){
          try{
            const slots=await g.fetchInstructorCalendar(ins);
            if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots:Array.isArray(slots)?slots:[],transport:'google-api-live-fallback',ok:true,calendarId:ins.calendarId};
            markUnavailable(ins.id,false);
            return Array.isArray(slots)?slots:[];
          }catch(googleErr){
            if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots:[],transport:'live-calendar-failed',ok:false,error:(appErr&&appErr.message||String(appErr))+' / '+(googleErr&&googleErr.message||String(googleErr))};
            markUnavailable(ins.id,true);
            return [];
          }
        }
        if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots:[],transport:'apps-script-live-failed',ok:false,error:appErr&&appErr.message||String(appErr)};
        markUnavailable(ins.id,true);
        return [];
      }
    }

    const g=googleReader();
    if(g&&typeof g.fetchInstructorCalendar==='function'&&googleConnected()){
      try{
        const slots=await g.fetchInstructorCalendar(ins);
        if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots:Array.isArray(slots)?slots:[],transport:'google-api-live',ok:true,calendarId:ins.calendarId};
        markUnavailable(ins.id,false);
        return Array.isArray(slots)?slots:[];
      }catch(e){
        if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots:[],transport:'google-api-live-failed',ok:false,error:e&&e.message||String(e)};
        markUnavailable(ins.id,true);
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
  box.innerHTML='<b>추천 시 최신조회:</b> RMHQ Apps Script가 설정되어 있으면 추천/충돌 확인 시점에 5명 강사 원본 Calendar를 즉시 읽습니다. Apps Script 실패 시 Google 직접연결이 있으면 한 번 더 시도하며, 둘 다 실패하면 해당 강사는 빈 시간으로 보지 않고 추천에서 제외합니다. Apps Script와 Google 직접연결이 모두 없을 때만 익명 BUSY 스냅샷을 사용합니다.';
  const anchor=document.getElementById('rmv2CalendarSourceNotice')||document.getElementById('rmSnapshotCard')||page.querySelector('.sec-sub');
  if(anchor)anchor.insertAdjacentElement('afterend',box);else page.prepend(box);
}

patchUi();
window.__RMV2_LIVE_REFRESH__={version:VERSION,appsConfigured,googleConnected};
try{parent.postMessage({type:'rmv2-live-refresh-ready',live:{version:VERSION,appsConfigured:appsConfigured(),googleConnected:googleConnected()}},location.origin);}catch(_){ }
})();
