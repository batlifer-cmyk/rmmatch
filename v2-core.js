
(function(){
'use strict';
const RMV2_VERSION='2026.08.08.2';
const RMV2_DAY_INDEX={'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6};
const RMV2_DAY_NAME=['일','월','화','수','목','금','토'];
const RMV2_RRULE_DAY={SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6};
const RMV2_TODAY=()=>{const d=new Date();d.setHours(0,0,0,0);return d;};
const rmv2Pad=n=>String(n).padStart(2,'0');
const rmv2DateKey=d=>d.getFullYear()+'-'+rmv2Pad(d.getMonth()+1)+'-'+rmv2Pad(d.getDate());
const rmv2DateFromKey=s=>{const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(+m[1],+m[2]-1,+m[3],0,0,0,0):null;};
const rmv2Minutes=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?(+m[1]*60 + +m[2]):null;};
const rmv2Overlap=(a1,a2,b1,b2)=>a1 < b2 && b1 < a2;

function rmv2LessonMinutes(){
  const direct=document.getElementById('s-duration-direct');
  const select=document.getElementById('s-duration');
  const raw=(direct&&direct.value.trim()) || (select&&select.value) || '1';
  const h=parseFloat(raw);
  return Number.isFinite(h)&&h>0?Math.max(15,Math.round(h*60)):60;
}

function rmv2GetProp(block,key){
  const re=new RegExp('^'+key+'(?:;([^:]*))?:(.*)$','mi');
  const m=String(block||'').match(re);
  if(!m)return null;
  const params=m[1]||'';
  const tz=(params.match(/TZID=([^;]+)/i)||[])[1]||'';
  return {params,tzid:tz.replace(/^"|"$/g,''),value:(m[2]||'').trim(),allDay:/VALUE=DATE(?:;|$)/i.test(params)};
}
function rmv2GetProps(block,key){
  const out=[];
  const re=new RegExp('^'+key+'(?:;([^:]*))?:(.*)$','gmi');
  let m;
  while((m=re.exec(String(block||'')))){
    const params=m[1]||'';
    const tz=(params.match(/TZID=([^;]+)/i)||[])[1]||'';
    out.push({params,tzid:tz.replace(/^"|"$/g,''),value:(m[2]||'').trim(),allDay:/VALUE=DATE(?:;|$)/i.test(params)});
  }
  return out;
}
function rmv2ParseICSValue(prop){
  if(!prop||!prop.value)return null;
  const raw=prop.value.trim();
  const clean=raw.replace(/Z$/,'');
  if(!/^\d{8}(T\d{4,6})?$/.test(clean))return null;
  const y=+clean.slice(0,4),mo=+clean.slice(4,6)-1,d=+clean.slice(6,8);
  const h=clean.includes('T')?+clean.slice(9,11):0;
  const mi=clean.includes('T')?+clean.slice(11,13):0;
  if(raw.endsWith('Z')) return new Date(Date.UTC(y,mo,d,h,mi,0));
  return new Date(y,mo,d,h,mi,0,0);
}
function rmv2ParseDurationMinutes(raw){
  const m=String(raw||'').match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if(!m)return null;
  return (+m[1]||0)*1440+(+m[2]||0)*60+(+m[3]||0);
}
function rmv2EventSummary(block){
  const p=rmv2GetProp(block,'SUMMARY');
  return p?p.value.replace(/\\,/g,',').replace(/\\n/gi,' '):'';
}

function rmv2AddOccurrence(out,meta,date,startMin,durationMin){
  const start=new Date(date.getFullYear(),date.getMonth(),date.getDate(),Math.floor(startMin/60),startMin%60,0,0);
  const end=new Date(start.getTime()+durationMin*60000);
  out.push({dow:start.getDay(),hour:start.getHours(),minute:start.getMinutes(),startMin:start.getHours()*60+start.getMinutes(),endMin:Math.min(1440,start.getHours()*60+start.getMinutes()+durationMin),dateStr:rmv2DateKey(start),startMs:start.getTime(),endMs:end.getTime(),recurring:!!meta.recurring,uid:meta.uid||'',summary:meta.summary||'',transport:'ics-v2'});
}

parseICS=function(text){
  text=String(text||'').replace(/\r\n[ \t]/g,'').replace(/\r/g,'');
  const now=RMV2_TODAY();
  const weeks=(typeof icsRangeWeeks==='number'&&icsRangeWeeks>0)?icsRangeWeeks:2;
  const rangeStart=new Date(now);rangeStart.setDate(rangeStart.getDate()-weeks*7);
  const rangeEnd=new Date(now);rangeEnd.setDate(rangeEnd.getDate()+weeks*7+1);
  const out=[];
  const blocks=text.split('BEGIN:VEVENT').slice(1);
  for(let rawBlock of blocks){
    const endIdx=rawBlock.indexOf('END:VEVENT');
    if(endIdx>=0)rawBlock=rawBlock.slice(0,endIdx);
    const startProp=rmv2GetProp(rawBlock,'DTSTART');
    const dtStart=rmv2ParseICSValue(startProp);
    if(!dtStart||startProp.allDay)continue;
    const endProp=rmv2GetProp(rawBlock,'DTEND');
    const durProp=rmv2GetProp(rawBlock,'DURATION');
    let durationMin=60;
    if(endProp){const dtEnd=rmv2ParseICSValue(endProp);if(dtEnd&&dtEnd>dtStart)durationMin=Math.max(1,Math.round((dtEnd-dtStart)/60000));}
    else if(durProp){durationMin=rmv2ParseDurationMinutes(durProp.value)||60;}
    const rrule=(rmv2GetProp(rawBlock,'RRULE')||{}).value||'';
    const uid=(rmv2GetProp(rawBlock,'UID')||{}).value||'';
    const summary=rmv2EventSummary(rawBlock);
    const exSet=new Set();
    rmv2GetProps(rawBlock,'EXDATE').forEach(p=>{p.value.split(',').forEach(v=>{const d=rmv2ParseICSValue({value:v.trim(),tzid:p.tzid,params:p.params,allDay:false});if(d)exSet.add(rmv2DateKey(d)+'@'+rmv2Pad(d.getHours())+':'+rmv2Pad(d.getMinutes()));});});
    const startMin=dtStart.getHours()*60+dtStart.getMinutes();
    if(/FREQ=WEEKLY/i.test(rrule)){
      const byM=rrule.match(/BYDAY=([^;]+)/i);
      const byDays=(byM?byM[1].split(','):[]).map(v=>v.trim().replace(/^[-+]?\d+/,'')).map(v=>RMV2_RRULE_DAY[v]).filter(v=>v!==undefined);
      if(!byDays.length)byDays.push(dtStart.getDay());
      const interval=Math.max(1,parseInt((rrule.match(/INTERVAL=(\d+)/i)||[])[1]||'1',10));
      const countRaw=parseInt((rrule.match(/COUNT=(\d+)/i)||[])[1]||'0',10);
      const untilRaw=(rrule.match(/UNTIL=([^;]+)/i)||[])[1]||'';
      const until=untilRaw?rmv2ParseICSValue({value:untilRaw,tzid:'',params:'',allDay:false}):null;
      const iterStart=new Date(dtStart.getFullYear(),dtStart.getMonth(),dtStart.getDate(),0,0,0,0);
      const iterEnd=until&&until<rangeEnd?until:rangeEnd;
      let occurrenceCount=0;
      for(let d=new Date(iterStart);d<=iterEnd;d.setDate(d.getDate()+1)){
        if(!byDays.includes(d.getDay()))continue;
        const week0=new Date(iterStart);week0.setDate(week0.getDate()-week0.getDay());
        const weekN=new Date(d);weekN.setDate(weekN.getDate()-weekN.getDay());
        const weekDiff=Math.floor((weekN-week0)/(7*86400000));
        if(weekDiff<0||weekDiff%interval!==0)continue;
        const candidate=new Date(d.getFullYear(),d.getMonth(),d.getDate(),dtStart.getHours(),dtStart.getMinutes(),0,0);
        if(candidate<dtStart)continue;
        occurrenceCount++;
        if(countRaw&&occurrenceCount>countRaw)break;
        if(candidate<rangeStart||candidate>rangeEnd)continue;
        const exKey=rmv2DateKey(candidate)+'@'+rmv2Pad(candidate.getHours())+':'+rmv2Pad(candidate.getMinutes());
        if(exSet.has(exKey))continue;
        rmv2AddOccurrence(out,{recurring:true,uid,summary},candidate,startMin,durationMin);
      }
    }else if(dtStart>=rangeStart&&dtStart<=rangeEnd){
      const exKey=rmv2DateKey(dtStart)+'@'+rmv2Pad(dtStart.getHours())+':'+rmv2Pad(dtStart.getMinutes());
      if(!exSet.has(exKey))rmv2AddOccurrence(out,{recurring:false,uid,summary},dtStart,startMin,durationMin);
    }
  }
  return out;
};

function rmv2SlotInterval(slot){const s=Number.isFinite(slot.startMin)?slot.startMin:(Number.isFinite(slot.hour)?slot.hour*60+(slot.minute||0):0);const e=Number.isFinite(slot.endMin)?slot.endMin:s+60;return [s,e];}
function rmv2PatternKey(slot){const [s,e]=rmv2SlotInterval(slot);return slot.dow+'|'+s+'|'+e;}
function rmv2IsPersistentSlot(slot,allSlots){if(slot.recurring)return true;const todayKey=rmv2DateKey(RMV2_TODAY());const same=(allSlots||[]).filter(x=>!x.recurring&&x.dateStr>=todayKey&&rmv2PatternKey(x)===rmv2PatternKey(slot));return new Set(same.map(x=>x.dateStr)).size>=2;}
function rmv2PersistentBusy(insId,day){const cache=icsCache[insId];if(!cache||!Array.isArray(cache.slots))return[];const dow=RMV2_DAY_INDEX[day];return cache.slots.filter(s=>s.dow===dow&&rmv2IsPersistentSlot(s,cache.slots));}
function rmv2ConflictsOnDate(insId,dateStr,time,durationMin){const cache=icsCache[insId];if(!cache||!Array.isArray(cache.slots))return[];const start=rmv2Minutes(time);if(start===null)return[];const end=start+(durationMin||rmv2LessonMinutes());return cache.slots.filter(s=>{if(s.dateStr!==dateStr)return false;const [a,b]=rmv2SlotInterval(s);return rmv2Overlap(start,end,a,b);});}
function rmv2UpcomingTemporaryConflicts(entry,weeks){const cache=entry&&entry.instructor&&icsCache[entry.instructor.id];if(!cache||!Array.isArray(cache.slots))return[];const start=rmv2Minutes(entry.time);if(start===null)return[];const end=start+rmv2LessonMinutes();const today=RMV2_TODAY(),until=new Date(today);until.setDate(until.getDate()+(weeks||4)*7);const t0=rmv2DateKey(today),t1=rmv2DateKey(until);return cache.slots.filter(s=>{if(s.recurring||s.dateStr<t0||s.dateStr>t1||s.dow!==RMV2_DAY_INDEX[entry.day])return false;const [a,b]=rmv2SlotInterval(s);return rmv2Overlap(start,end,a,b);});}

isConflictICS=function(insId,day,time){const start=rmv2Minutes(time);if(start===null)return false;const end=start+rmv2LessonMinutes();return rmv2PersistentBusy(insId,day).some(s=>{const [a,b]=rmv2SlotInterval(s);return rmv2Overlap(start,end,a,b);});};
isConflict=function(insId,day,time){return isConflictICS(insId,day,time);};

getConnectionFit=function(slot){
  let score=0,adjacentCount=0,sameDayBusyCount=0,maxRunExceeded=false;
  for(const entry of slot.entries||[]){
    const ins=entry.instructor;if(!ins)continue;
    const busy=rmv2PersistentBusy(ins.id,entry.day);
    if(!busy.length){score-=2;continue;}
    sameDayBusyCount++;score+=7;
    const ts=rmv2Minutes(entry.time),te=ts+rmv2LessonMinutes();
    let minGap=9999;
    const intervals=busy.map(s=>rmv2SlotInterval(s)).concat([[ts,te]]).sort((a,b)=>a[0]-b[0]);
    for(const [s,e] of busy.map(rmv2SlotInterval)){let gap=0;if(te<=s)gap=s-te;else if(e<=ts)gap=ts-e;else gap=-1;if(gap>=0)minGap=Math.min(minGap,gap);}
    if(minGap===0){adjacentCount++;score+=9;}else if(minGap<=60)score+=2;else if(minGap<9999)score-=4;
    let merged=[];
    for(const iv of intervals){if(!merged.length||iv[0]>merged[merged.length-1][1])merged.push(iv.slice());else merged[merged.length-1][1]=Math.max(merged[merged.length-1][1],iv[1]);}
    const chain=merged.find(iv=>iv[0]<=ts&&iv[1]>=te);
    const maxC=(ins.maxConsec||4)*60;
    if(chain&&chain[1]-chain[0]>maxC){maxRunExceeded=true;score-=200;}
  }
  return {score,adjacentCount,sameDayBusyCount,maxRunExceeded};
};

buildMultiSchedulesLimited=function(combo,daySlots,idx,current,out,limit){
  const ids=new Set(current.map(e=>e.instructor&&e.instructor.id).filter(Boolean));
  if(ids.size>2||out.length>=limit)return;
  if(idx===combo.length){if(ids.size===2)pushLimited(out,{entries:[...current],multiInstructor:true},limit);return;}
  const slots=daySlots[combo[idx]]||[];
  for(const s of slots){const nextIds=new Set(ids);if(s.instructor)nextIds.add(s.instructor.id);if(nextIds.size>2)continue;buildMultiSchedulesLimited(combo,daySlots,idx+1,[...current,s],out,limit);if(out.length>=limit)break;}
};
const rmv2OriginalComputeSlots=computeSlots;
computeSlots=function(level){return (rmv2OriginalComputeSlots(level)||[]).filter(s=>new Set((s.entries||[]).map(e=>e.instructor&&e.instructor.id).filter(Boolean)).size<=2);};

function rmv2NextOccurrence(entry,fromDate,allowSameDay){const target=RMV2_DAY_INDEX[entry.day];if(target===undefined)return null;const d=new Date(fromDate);d.setHours(0,0,0,0);if(!allowSameDay)d.setDate(d.getDate()+1);for(let i=0;i<35;i++){if(d.getDay()===target){const key=rmv2DateKey(d);if(!rmv2ConflictsOnDate(entry.instructor.id,key,entry.time,rmv2LessonMinutes()).length)return new Date(d);}d.setDate(d.getDate()+1);}return null;}
getDefaultStartDateForEntries=function(entries){const list=(entries||[]).map(e=>rmv2NextOccurrence(e,RMV2_TODAY(),false)).filter(Boolean);if(!list.length){const d=new Date();d.setDate(d.getDate()+1);return rmv2DateKey(d);}list.sort((a,b)=>a-b);return rmv2DateKey(list[0]);};

function rmv2ScheduleStartMap(entries){const dates=(typeof getStartDates==='function'?getStartDates():[])||[];const map={};const allSame=new Set((entries||[]).map(e=>e.instructor&&e.instructor.id)).size===1;if(allSame&&entries[0]&&entries[0].instructor){map[entries[0].instructor.id]=dates[0]||'';}else if(typeof getInsGroups==='function'){const groups=getInsGroups(entries||[]);groups.forEach((g,i)=>{if(g.ins)map[g.ins.id]=dates[i]||dates[0]||'';});}return map;}
function rmv2FirstOccurrenceFromStart(entry,startKey){const d=rmv2DateFromKey(startKey);if(!d)return null;const target=RMV2_DAY_INDEX[entry.day];if(target===undefined)return null;for(let i=0;i<7;i++){if(d.getDay()===target)return new Date(d);d.setDate(d.getDate()+1);}return null;}
function rmv2ValidateSelectedSlot(includeStartDates){
  if(!selectedSlot||!Array.isArray(selectedSlot.entries))return {ok:false,errors:['일정을 먼저 선택하세요.'],warnings:[]};
  const errors=[],warnings=[];
  for(const e of selectedSlot.entries){if(!e.instructor)continue;if(isConflictICS(e.instructor.id,e.day,e.time))errors.push(e.instructor.name+' · '+e.day+'요일 '+e.time+'은 반복 일정과 충돌합니다.');const temp=rmv2UpcomingTemporaryConflicts(e,4);if(temp.length)warnings.push(e.instructor.name+' '+e.day+' '+e.time+' — 향후 4주 임시충돌 '+[...new Set(temp.map(x=>x.dateStr))].join(', '));}
  if(includeStartDates){const map=rmv2ScheduleStartMap(selectedSlot.entries);for(const e of selectedSlot.entries){if(!e.instructor)continue;const startKey=map[e.instructor.id]||Object.values(map)[0]||'';const first=rmv2FirstOccurrenceFromStart(e,startKey);if(first){const key=rmv2DateKey(first);const hits=rmv2ConflictsOnDate(e.instructor.id,key,e.time,rmv2LessonMinutes());if(hits.length)errors.push('첫 회차 충돌: '+e.instructor.name+' · '+key+' '+e.time+' ('+(hits[0].summary||'기존 일정')+')');}}}
  return {ok:errors.length===0,errors,warnings};
}

const rmv2OriginalGoStep3=goStep3;
goStep3=function(){const v=rmv2ValidateSelectedSlot(false);if(!v.ok)return alert('일정 충돌 때문에 확정할 수 없습니다.\n\n'+v.errors.join('\n'));rmv2OriginalGoStep3();const v2=rmv2ValidateSelectedSlot(true);if(v2.warnings.length){const el=document.getElementById('startdate-wrap');if(el&&!document.getElementById('rmv2-temp-warning')){const w=document.createElement('div');w.id='rmv2-temp-warning';w.className='notice';w.style.marginTop='10px';w.innerHTML='<b>임시 일정 확인</b><br>'+v2.warnings.map(x=>'• '+x).join('<br>')+'<br><span style="font-size:11px">반복수업 자체는 가능하지만 해당 날짜는 보강/시작일 조정이 필요할 수 있습니다.</span>';el.appendChild(w);}}};

if(typeof renderSlotCard==='function'){
  const rmv2OriginalRenderSlotCard=renderSlotCard;
  renderSlotCard=function(slot,subjects,freq){const div=rmv2OriginalRenderSlotCard(slot,subjects,freq);const temps=(slot.entries||[]).flatMap(e=>rmv2UpcomingTemporaryConflicts(e,4));if(temps.length){const sm=div.querySelector('.sm');if(sm){const b=document.createElement('span');b.style.cssText='background:#fff3cd;color:#7a5200;padding:2px 8px;border-radius:10px;font-size:11px';b.textContent='⚠ 임시충돌 '+new Set(temps.map(x=>x.dateStr)).size+'일';b.title=[...new Set(temps.map(x=>x.dateStr+' '+(x.summary||'기존 일정')))].join('\n');sm.appendChild(b);}}return div;};
}

const rmv2OriginalSaveStudent=saveStudentToDb;
saveStudentToDb=async function(){const v=rmv2ValidateSelectedSlot(true);if(!v.ok){setStudentDbSaveStatus('저장 중단: '+v.errors.join(' / '),'error');return alert('학생DB 저장 전 일정 충돌을 해결해주세요.\n\n'+v.errors.join('\n'));}await rmv2OriginalSaveStudent();if(!studentDbSaveInFlight){const el=document.getElementById('student-db-save-status');if(el&&el.classList.contains('success'))el.textContent='저장 요청 전송 완료. 현재 Apps Script가 no-cors 방식이라 서버 성공 응답은 브라우저에서 검증할 수 없습니다. 학생DB_저장로그를 최종 확인하세요.';}};

window.__RMV2_CORE__={version:RMV2_VERSION,validate:rmv2ValidateSelectedSlot,conflictsOnDate:rmv2ConflictsOnDate,overlap:rmv2Overlap,dateKey:rmv2DateKey,dateFromKey:rmv2DateFromKey};
})();
