(function(){
'use strict';

const VERSION='2026.08.10.1';
const DAY_INDEX={'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6};

function pad(n){return String(n).padStart(2,'0');}
function dateKey(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function minutes(t){
  const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);
  return m?(+m[1]*60 + +m[2]):null;
}
function lessonMinutes(){
  const direct=document.getElementById('s-duration-direct');
  const select=document.getElementById('s-duration');
  const raw=(direct&&direct.value.trim()) || (select&&select.value) || '1';
  const h=parseFloat(raw);
  return Number.isFinite(h)&&h>0?Math.max(15,Math.round(h*60)):60;
}
function slotInterval(slot){
  const s=Number.isFinite(slot.startMin)?slot.startMin:(Number.isFinite(slot.hour)?slot.hour*60+(slot.minute||0):0);
  const e=Number.isFinite(slot.endMin)?slot.endMin:s+60;
  return [s,e];
}
function overlap(a1,a2,b1,b2){return a1 < b2 && b1 < a2;}

// STEP 3 기본 시작일 정책과 동일하게 "오늘 제외 가장 가까운 선택요일"을 본다.
function nextDateKey(day){
  const target=DAY_INDEX[day];
  if(target===undefined)return '';
  const d=new Date();
  d.setHours(0,0,0,0);
  let diff=(target-d.getDay()+7)%7;
  if(diff===0)diff=7;
  d.setDate(d.getDate()+diff);
  return dateKey(d);
}

function actualDateConflict(insId,day,time){
  const cache=(typeof icsCache==='object'&&icsCache)?icsCache[insId]:null;
  if(!cache||!Array.isArray(cache.slots)||!cache.slots.length)return false;
  const targetDate=nextDateKey(day);
  if(!targetDate)return false;
  const start=minutes(time);
  if(start===null)return false;
  const end=start+lessonMinutes();
  return cache.slots.some(function(slot){
    if(slot.dateStr!==targetDate)return false;
    const iv=slotInterval(slot);
    return overlap(start,end,iv[0],iv[1]);
  });
}

if(typeof isConflictICS==='function'){
  const previous=isConflictICS;
  isConflictICS=function(insId,day,time){
    if(previous(insId,day,time))return true;
    return actualDateConflict(insId,day,time);
  };
  isConflict=function(insId,day,time){return isConflictICS(insId,day,time);};
}

// 시작일을 사용자가 바꾼 뒤에도 실제 날짜 충돌을 확인할 수 있게 공개한다.
function conflictOnDate(insId,dateStr,time,duration){
  const cache=(typeof icsCache==='object'&&icsCache)?icsCache[insId]:null;
  if(!cache||!Array.isArray(cache.slots))return false;
  const start=minutes(time);
  if(start===null)return false;
  const end=start+(duration||lessonMinutes());
  return cache.slots.some(function(slot){
    if(slot.dateStr!==dateStr)return false;
    const iv=slotInterval(slot);
    return overlap(start,end,iv[0],iv[1]);
  });
}

window.__RMV2_DATE_GUARD__={version:VERSION,nextDateKey,actualDateConflict,conflictOnDate};
try{parent.postMessage({type:'rmv2-date-guard-ready',dateGuard:{version:VERSION}},location.origin);}catch(_){ }
})();
