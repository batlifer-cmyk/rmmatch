(function(){
'use strict';

const VERSION='2026.08.09.1';
const ENDPOINT='https://script.google.com/macros/s/AKfycbyX5Rm89c_lJOBt6L_aGlz0a87k6V7gqAS7bCP5WfrPE9Cv-SWLD2aDZSCJqMDUstxe6A/exec';
const CANONICAL_IDS=new Set(['matthew','david','paul','jenna','dean']);
const CACHE_MS=8000;
let batchCache=null;

function dateKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function range(){
  const from=new Date();from.setHours(0,0,0,0);from.setDate(from.getDate()-7);
  const to=new Date(from);to.setDate(to.getDate()+61);
  return {from:dateKey(from),to:dateKey(to)};
}
function jsonp(params){
  return new Promise((resolve,reject)=>{
    const cb='__rmCalendarCb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const timer=setTimeout(()=>finish(new Error('Apps Script Calendar 응답 시간 초과')),12000);
    const script=document.createElement('script');
    function finish(err,data){clearTimeout(timer);try{delete window[cb];}catch(_){window[cb]=undefined;}try{script.remove();}catch(_){ }err?reject(err):resolve(data);}
    window[cb]=(data)=>finish(null,data);
    const q=new URLSearchParams(Object.assign({},params,{callback:cb,_ts:String(Date.now())}));
    script.src=ENDPOINT+'?'+q.toString();script.async=true;script.onerror=()=>finish(new Error('Apps Script Calendar 호출 실패'));
    document.head.appendChild(script);
  });
}
async function fetchBatch(force){
  if(!force&&batchCache&&Date.now()-batchCache.fetched<CACHE_MS)return batchCache.data;
  const r=range();
  const data=await jsonp({action:'calendar.busy',from:r.from,to:r.to});
  if(!data||data.ok!==true||data.schema!=='rm-calendar-live-v1'||!data.instructors)throw new Error(data&&data.message||'Apps Script Calendar 응답 형식 오류');
  for(const id of CANONICAL_IDS){if(!Array.isArray(data.instructors[id]))throw new Error('Apps Script Calendar 누락: '+id);}
  batchCache={fetched:Date.now(),data};
  return data;
}
function rowToSlot(row){
  if(!row)return null;
  const s=new Date(row.start),e=new Date(row.end);
  if(!Number.isFinite(s.getTime())||!Number.isFinite(e.getTime())||e<=s)return null;
  const startMin=s.getHours()*60+s.getMinutes();
  return {dow:s.getDay(),hour:s.getHours(),minute:s.getMinutes(),startMin,endMin:Math.min(1440,e.getHours()*60+e.getMinutes()),dateStr:dateKey(s),startMs:s.getTime(),endMs:e.getTime(),recurring:false,uid:'',summary:'',transport:'apps-script-live'};
}
async function fetchInstructorCalendar(ins){
  if(!ins||!CANONICAL_IDS.has(ins.id))return null;
  const data=await fetchBatch(false);
  const slots=(data.instructors[ins.id]||[]).map(rowToSlot).filter(Boolean);
  if(typeof icsCache==='object')icsCache[ins.id]={fetched:Date.now(),slots,transport:'apps-script-live',ok:true,calendarId:ins.calendarId,generatedAt:data.generatedAt};
  return slots;
}
function reset(){batchCache=null;}

window.__RMV2_APPS_SCRIPT__={version:VERSION,endpoint:ENDPOINT,fetchBatch,fetchInstructorCalendar,reset};
try{parent.postMessage({type:'rmv2-apps-script-ready',appsScript:{version:VERSION,configured:true}},location.origin);}catch(_){ }
})();
