(function(){
'use strict';

const VERSION='2026.08.10.1';
let lastSelectedSlot=null;

function markSelected(slot,card){
  lastSelectedSlot=slot||null;
  try{ if(slot) selectedSlot=slot; }catch(_){ }
  document.querySelectorAll('.slot-result').forEach(function(el){el.classList.remove('chosen');});
  if(card)card.classList.add('chosen');
  const next=document.querySelector('#step2 .btn-primary[onclick="goStep3()"]');
  if(next){
    next.disabled=!slot;
    next.style.opacity=slot?'1':'.55';
    next.textContent=slot?'선택 완료 · 메세지 생성 →':'일정을 선택해주세요';
  }
}

const previousRenderSlotCard=typeof renderSlotCard==='function'?renderSlotCard:null;
if(previousRenderSlotCard){
  renderSlotCard=function(slot,subjects,freq){
    const card=previousRenderSlotCard(slot,subjects,freq);
    if(card){
      card.addEventListener('click',function(){
        markSelected(slot,card);
      });
    }
    return card;
  };
}

const previousGoStep3=typeof goStep3==='function'?goStep3:null;
if(previousGoStep3){
  goStep3=function(){
    try{
      if(!selectedSlot&&lastSelectedSlot)selectedSlot=lastSelectedSlot;
    }catch(_){ }
    try{
      if(!selectedSlot){
        alert('추천 일정 카드를 먼저 선택해주세요.');
        return;
      }
    }catch(_){ }
    return previousGoStep3();
  };
}

const previousRenderResults=typeof renderSlotResults==='function'?renderSlotResults:null;
if(previousRenderResults){
  renderSlotResults=function(slots){
    lastSelectedSlot=null;
    const out=previousRenderResults(slots);
    setTimeout(function(){
      const chosen=document.querySelector('#slotResults .slot-result.chosen');
      if(chosen){
        const next=document.querySelector('#step2 .btn-primary[onclick="goStep3()"]');
        if(next){next.disabled=false;next.style.opacity='1';next.textContent='선택 완료 · 메세지 생성 →';}
      }
    },0);
    return out;
  };
}

window.__RMV2_STEP_FIX__={version:VERSION,lastSelected:function(){return lastSelectedSlot;}};
try{parent.postMessage({type:'rmv2-step-fix-ready',stepFix:{version:VERSION}},location.origin);}catch(_){ }
})();
