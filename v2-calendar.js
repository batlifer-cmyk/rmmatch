(function(){
'use strict';

const RMV2_CALENDAR_VERSION='2026.08.08.4';
const PAUL_AVAILABILITY_REV='2026-08-08-paul-1';
const CANONICAL={
  matthew:{calendarId:'matthew.g.mun@gmail.com',label:'RM 매튜 (강사소유 원본)'},
  david:{calendarId:'parkdavid0211@gmail.com',label:'RM 데이빗 (강사소유 원본)'},
  paul:{calendarId:'78705a8de54b56ea1c21af40a1b8c80b468dcdc82b1e92d2943db0d121ac4bec@group.calendar.google.com',label:'RM 폴'},
  jenna:{calendarId:'6bfaa96f9c8bf215a51189ab58c6426586b77751a85c898365d2f6ffb86eb73f@group.calendar.google.com',label:'RM 제나'},
  dean:{calendarId:'2f1dff2664bb6fd9c5de5bf31aa0dbc87e680ae675fc474302f975a78b39bf64@group.calendar.google.com',label:'RM 딘'}
};
const OLD_DAVID_EMBED='https://calendar.google.com/calendar/embed?src=parkdavid0211%40gmail.com&ctz=Asia%2FSeoul';
const unavailableCalendarInstructors=new Set();

function normalizeCalendarSource(raw){return String(raw||'').trim();}
function snapshotReader(){return window.__RMV2_SNAPSHOT__||null;}
function googleReader(){return window.__RMV2_GOOGLE__||null;}
function googleConnected(){const g=googleReader();return !!(g&&typeof g.token==='function'&&g.token());}

function migrateInstructorSources(){
  if(!Array.isArray(instructors))return false;
  let dirty=false;
  instructors.forEach(ins=>{
    const c=ins&&CANONICAL[ins.id];if(!c)return;
    if(ins.calendarId!==c.calendarId){ins.calendarId=c.calendarId;dirty=true;}
    if(ins.calendarSourceLabel!==c.label){ins.calendarSourceLabel=c.label;dirty=true;}
    if(ins.id==='david'&&ins.calId===OLD_DAVID_EMBED){ins.calId='';dirty=true;}
  });
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
    paul.rmv2AvailabilityRevision=PAUL_AVAILABILITY_REV;dirty=true;
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
    try{if(typeof icsCache==='object')Object.keys(CANONICAL).forEach(k=>delete icsCache[k]);}catch(_){ }
  };
}

if(typeof fetchICS==='function'){
  const originalFetchICS=fetchICS;
  fetchICS=async function(ins){
    if(!ins)return[];
    if(ins.calendarId){
      const snap=snapshotReader();
      if(snap&&typeof snap.load==='function'&&typeof snap.slotsFor==='function'){
        try{
          await snap.load(false);
          const snapshotSlots=snap.slotsFor(ins.id);
          if(snapshotSlots!==null){
            if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots:snapshotSlots,transport:'busy-snapshot',ok:true,generatedAt:snap.state&&snap.state.data&&snap.state.data.generatedAt||''};
            unavailableCalendarInstructors.delete(ins.id);
            return snapshotSlots;
          }
        }catch(_){ }
      }
      const g=googleReader();
      if(g&&typeof g.fetchInstructorCalendar==='function'&&googleConnected()){
        try{
          const slots=await g.fetchInstructorCalendar(ins);
          unavailableCalendarInstructors.delete(ins.id);
          return Array.isArray(slots)?slots:[];
        }catch(e){
          unavailableCalendarInstructors.add(ins.id);
          if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots:[],transport:'google-api-failed',ok:false,error:e&&e.message||String(e)};
          return[];
        }
      }
      unavailableCalendarInstructors.add(ins.id);
      if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots:[],transport:'calendar-source-unavailable',ok:false,error:'캘린더 자동동기화가 오래되었고 Google 직접연결도 없습니다.'};
      return[];
    }
    const source=normalizeCalendarSource(ins.calId||'');
    if(!source){unavailableCalendarInstructors.delete(ins.id);return[];}
    const proxyIns=source===ins.calId?ins:Object.assign({},ins,{calId:source});
    const slots=await originalFetchICS(proxyIns);
    const cache=(typeof icsCache==='object'&&icsCache)?icsCache[ins.id]:null;
    if(cache&&cache.ok===false)unavailableCalendarInstructors.add(ins.id);else unavailableCalendarInstructors.delete(ins.id);
    return slots;
  };
}

if(typeof isConflictICS==='function'){
  const originalIsConflictICS=isConflictICS;
  isConflictICS=function(insId,day,time){if(unavailableCalendarInstructors.has(insId))return true;return originalIsConflictICS(insId,day,time);};
  isConflict=function(insId,day,time){return isConflictICS(insId,day,time);};
}

if(typeof testAllICS==='function'){
  testAllICS=async function(){
    const statusEl=document.getElementById('ics-status');
    if(statusEl)statusEl.innerHTML='<span style="color:var(--muted)">강사 캘린더 실제 연결 테스트 중…</span>';
    try{if(typeof icsCache==='object')Object.keys(icsCache).forEach(k=>delete icsCache[k]);}catch(_){ }
    const rows=[];
    for(const ins of instructors){
      if(!ins.calendarId&&!ins.calId){rows.push('⚪ <b>'+ins.name+'</b> — 일정 소스 미설정');continue;}
      const slots=await fetchICS(ins);const c=(typeof icsCache==='object'&&icsCache[ins.id])||{};
      const sourceLabel=c.transport==='busy-snapshot'?'자동동기화':c.transport==='google-api'?'Google API':'ICS';
      if(c.ok)rows.push('✅ <b>'+ins.name+'</b> — '+slots.length+'개 BUSY · '+sourceLabel);
      else rows.push('❌ <b>'+ins.name+'</b> — '+(c.error||'연결 실패'));
    }
    if(statusEl)statusEl.innerHTML=rows.map(x=>'<div style="margin-bottom:6px">'+x+'</div>').join('');
  };
}

function patchCalendarUi(){
  const input=document.getElementById('modal-calid');
  if(input){const group=input.closest('.form-group');const label=group&&group.querySelector('label');if(label)label.textContent='보조 ICS URL';input.placeholder='자동동기화 미사용 강사용 ICS URL';}
  const settings=document.getElementById('page-settings');
  if(settings){
    const notices=Array.from(settings.querySelectorAll('.notice'));
    const old=notices.find(n=>/강사별 ICS URL|강사별 일정 소스/.test(n.textContent||''));
    if(old)old.innerHTML='<b>Matthew · David · Paul · Jenna · Dean</b>은 익명 BUSY 스냅샷을 우선 사용합니다. 학생 이름·설명·참석자 정보는 스케줄러에 저장하지 않습니다. Google 직접연결은 백업 수단입니다.';
    if(!document.getElementById('rmv2CalendarSourceNotice')){
      const box=document.createElement('div');box.id='rmv2CalendarSourceNotice';box.className='notice';box.style.marginTop='12px';
      box.innerHTML='<b>중앙 캘린더:</b> Matthew/David는 강사소유 원본, Paul/Jenna/Dean은 RM 운영 원본에서 BUSY 시간만 동기화합니다. 종일 가능시간 메모는 BUSY에서 제외합니다. 동기화가 오래되면 빈 시간으로 오인하지 않고 해당 강사 추천을 차단합니다.';
      const status=document.getElementById('ics-status');if(status)status.insertAdjacentElement('beforebegin',box);
    }
  }
}

patchCalendarUi();
const snap=snapshotReader();
const snapshotFresh=!!(snap&&typeof snap.isFresh==='function'&&snap.isFresh());
const calendarDiagnostics={version:RMV2_CALENDAR_VERSION,canonical:CANONICAL,paulAvailabilityRevision:PAUL_AVAILABILITY_REV,unavailableCalendarInstructors,googleConnected,snapshotFresh};
window.__RMV2_CALENDAR__=calendarDiagnostics;
try{parent.postMessage({type:'rmv2-calendar-ready',calendar:{version:RMV2_CALENDAR_VERSION,davidConfigured:true,googleConnected:googleConnected(),snapshotFresh,paulAvailabilityRevision:PAUL_AVAILABILITY_REV}},location.origin);}catch(_){ }
})();
