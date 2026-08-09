(function(){
'use strict';

const RMV2_WORKLOAD_VERSION='2026.08.10.1';

// RM 운영 원칙: 가능하면 최대 4시간 연속 수업 후 1시간 휴식.
// 절대 금지 조건은 아니므로 5시간 이상 연강 후보를 삭제하지 않고
// 강하게 감점한 뒤 운영팀 확인 경고를 표시한다.
if(typeof getConnectionFit==='function'){
  const previousGetConnectionFit=getConnectionFit;
  getConnectionFit=function(slot){
    const fit=previousGetConnectionFit(slot)||{};
    if(fit.maxRunExceeded){
      if(slot) slot.rmv2ConsecutiveWarning=true;
      fit.actualMaxRunExceeded=true;
      fit.workloadWarning='연강 5시간 이상 · 강사 확인 권장';
      // 기존 computeSlots가 maxRunExceeded=true 후보를 삭제하므로,
      // 경고형 후보로 전환한다. 기존 -200 감점은 그대로 유지된다.
      fit.maxRunExceeded=false;
    }
    return fit;
  };
}

if(typeof computeSlots==='function'){
  const previousComputeSlots=computeSlots;
  computeSlots=function(level){
    const slots=previousComputeSlots(level)||[];
    return slots.map(function(slot){
      const conn=slot&&slot.fit&&slot.fit.connection;
      const warned=!!(slot&&slot.rmv2ConsecutiveWarning) || !!(conn&&conn.actualMaxRunExceeded);
      if(warned){
        slot.workloadWarning='연강 5시간 이상 · 강사 확인 권장';
        if(slot.label && !slot.label.includes('⚠ 강사 확인')) slot.label += ' · ⚠ 강사 확인';
        if(slot.fit&&slot.fit.connection){
          slot.fit.connection.workloadWarning=slot.workloadWarning;
          slot.fit.connection.actualMaxRunExceeded=true;
        }
      }
      return slot;
    });
  };
}

window.__RMV2_WORKLOAD__={
  version:RMV2_WORKLOAD_VERSION,
  policy:'prefer-break-after-4-hours',
  hardBlock:false,
  warning:'연강 5시간 이상 · 강사 확인 권장'
};

try{
  parent.postMessage({type:'rmv2-workload-ready',workload:window.__RMV2_WORKLOAD__},location.origin);
}catch(_){ }
})();
