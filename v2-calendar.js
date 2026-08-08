(function(){
'use strict';

const RMV2_CALENDAR_VERSION='2026.08.08.1';
const DAVID_CALENDAR_ID='parkdavid0211@gmail.com';
const DAVID_EMBED_URL='https://calendar.google.com/calendar/embed?src=parkdavid0211%40gmail.com&ctz=Asia%2FSeoul';
const PAUL_AVAILABILITY_REV='2026-08-08-paul-1';

function googlePublicIcs(calendarId){
  return 'https://calendar.google.com/calendar/ical/'+encodeURIComponent(calendarId)+'/public/basic.ics';
}

function normalizeCalendarSource(raw){
  const value=String(raw||'').trim();
  if(!value)return '';
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return googlePublicIcs(value);
  try{
    const u=new URL(value,location.href);
    if(u.hostname==='calendar.google.com'&&/\/calendar\/embed\/?$/i.test(u.pathname)){
      const src=u.searchParams.get('src');
      if(src)return googlePublicIcs(src);
    }
  }catch(_){ }
  return value;
}

function migrateInstructorSources(){
  if(!Array.isArray(instructors))return false;
  let dirty=false;

  const david=instructors.find(i=>i&&i.id==='david');
  if(david){
    if(!david.calId){david.calId=DAVID_EMBED_URL;dirty=true;}
    if(david.calendarId!==DAVID_CALENDAR_ID){david.calendarId=DAVID_CALENDAR_ID;dirty=true;}
    if(david.calendarSourceLabel!=='RM 데이빗 (강사소유 원본)'){
      david.calendarSourceLabel='RM 데이빗 (강사소유 원본)';dirty=true;
    }
  }

  const paul=instructors.find(i=>i&&i.id==='paul');
  if(paul&&paul.rmv2AvailabilityRevision!==PAUL_AVAILABILITY_REV){
    paul.days=['월','화','수','목','금','토'];
    paul.dayTimes={
      '월':['19:30','20:30'],
      '화':['17:00','18:00','19:00','20:00','21:00'],
      '수':['17:00','18:00','19:00','20:00','21:00'],
      '목':['19:00','20:00','21:00'],
      '금':['19:00','20:00','21:00'],
      '토':['10:00','11:00','12:00','13:00']
    };
    paul.rmv2AvailabilityRevision=PAUL_AVAILABILITY_REV;
    dirty=true;
  }

  return dirty;
}

if(typeof loadData==='function'){
  const originalLoadData=loadData;
  loadData=function(){
    originalLoadData();
    const dirty=migrateInstructorSources();
    if(dirty&&typeof saveData==='function')saveData();
    if(typeof refreshInsSel==='function')refreshInsSel();
  };
}

if(typeof fetchICS==='function'){
  const originalFetchICS=fetchICS;
  fetchICS=async function(ins){
    if(!ins)return[];
    const source=normalizeCalendarSource(ins.calId||'');
    if(!source)return[];
    if(source===ins.calId)return originalFetchICS(ins);
    const proxyIns=Object.assign({},ins,{calId:source});
    return originalFetchICS(proxyIns);
  };
}

function patchCalendarUi(){
  const input=document.getElementById('modal-calid');
  if(input){
    const label=input.closest('.form-group')&&input.closest('.form-group').querySelector('label');
    if(label)label.textContent='캘린더 URL / Google Calendar ID';
    input.placeholder='Google Calendar embed URL · calendar@gmail.com · ICS URL';
  }
  const settings=document.getElementById('page-settings');
  if(settings){
    const notices=Array.from(settings.querySelectorAll('.notice'));
    const old=notices.find(n=>/강사별 ICS URL/.test(n.textContent||''));
    if(old)old.innerHTML='강사별 일정 소스는 <b>강사 설정 → 편집 → 캘린더 URL / Google Calendar ID</b>에서 관리합니다. Google Calendar embed 주소나 캘린더 ID(email 형태)를 넣으면 public ICS 형식으로 자동 변환합니다.';
    if(!document.getElementById('rmv2CalendarSourceNotice')){
      const box=document.createElement('div');
      box.id='rmv2CalendarSourceNotice';
      box.className='notice';
      box.style.marginTop='12px';
      box.innerHTML='<b>중앙 소스 보정:</b> David는 <code>parkdavid0211@gmail.com</code> 원본 캘린더를 기본 소스로 사용합니다. Paul 가능시간은 2026-08-10부터 전달받은 새 시간대로 반영했습니다.';
      const status=document.getElementById('ics-status');
      if(status)status.insertAdjacentElement('beforebegin',box);
    }
  }
}

patchCalendarUi();

const calendarDiagnostics={
  version:RMV2_CALENDAR_VERSION,
  davidCalendarId:DAVID_CALENDAR_ID,
  davidConfigured:true,
  paulAvailabilityRevision:PAUL_AVAILABILITY_REV,
  normalizeCalendarSource
};
window.__RMV2_CALENDAR__=calendarDiagnostics;
try{parent.postMessage({type:'rmv2-calendar-ready',calendar:{version:RMV2_CALENDAR_VERSION,davidConfigured:true,paulAvailabilityRevision:PAUL_AVAILABILITY_REV}},location.origin);}catch(_){ }
})();
