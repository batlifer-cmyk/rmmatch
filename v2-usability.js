(function(){
'use strict';

const VERSION='2026.08.10.2';
const ACTIVE_CONTROL_ID='rmv2-modal-active';

function isInstructorActive(ins){
  return !ins || ins.active!==false;
}

function addStyles(){
  if(document.getElementById('rmv2UsabilityStyle'))return;
  const style=document.createElement('style');
  style.id='rmv2UsabilityStyle';
  style.textContent=[
    '.ins-card.rmv2-inactive{opacity:.58;background:#f3f3f3;border-style:dashed}',
    '.ins-card.rmv2-inactive .iname::after{content:"비활성";display:inline-block;margin-left:8px;padding:2px 7px;border-radius:999px;background:#777;color:#fff;font-size:10px;font-weight:700;vertical-align:middle}',
    '.rmv2-active-row{padding:10px 12px;border:1.5px solid #e0e0e0;border-radius:4px;background:#fafafa;margin-bottom:12px}',
    '.rmv2-active-row label{display:flex;gap:8px;align-items:center;font-weight:700}',
    '.rmv2-active-row .hint{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.45}',
    '.day-time-chips,.time-grid{touch-action:none}'
  ].join('\n');
  document.head.appendChild(style);
}

function ensureActiveControl(){
  if(document.getElementById(ACTIVE_CONTROL_ID))return;
  const max=document.getElementById('modal-maxconsec');
  const anchor=max&&max.closest('.form-group');
  if(!anchor)return;
  const row=document.createElement('div');
  row.className='rmv2-active-row';
  row.innerHTML='<label><input type="checkbox" id="'+ACTIVE_CONTROL_ID+'" checked> 추천/배정 활성화</label><div class="hint">해약, 장기휴직 등으로 끄면 신규 추천과 직접 강사 선택에서 제외됩니다. 기존 프로필/Calendar 정보는 삭제하지 않습니다.</div>';
  anchor.insertAdjacentElement('beforebegin',row);
}

function patchInstructorActive(){
  if(window.__RMV2_USABILITY_ACTIVE_PATCHED__)return;
  window.__RMV2_USABILITY_ACTIVE_PATCHED__=true;

  const originalRenderInsGrid=typeof renderInsGrid==='function'?renderInsGrid:null;
  if(originalRenderInsGrid)renderInsGrid=function(){
    originalRenderInsGrid.apply(this,arguments);
    const grid=document.getElementById('instructorGrid');
    if(!grid||!Array.isArray(instructors))return;
    const cards=Array.from(grid.querySelectorAll('.ins-card'));
    instructors.forEach((ins,index)=>{
      const card=cards[index];
      if(!card)return;
      card.classList.toggle('rmv2-inactive',!isInstructorActive(ins));
    });
  };

  const originalOpenModal=typeof openModal==='function'?openModal:null;
  if(originalOpenModal)openModal=function(id){
    const result=originalOpenModal.apply(this,arguments);
    ensureActiveControl();
    const ins=Array.isArray(instructors)?instructors.find(i=>i&&i.id===id):null;
    const active=document.getElementById(ACTIVE_CONTROL_ID);
    if(active)active.checked=isInstructorActive(ins);
    return result;
  };

  const originalSaveInstructor=typeof saveInstructor==='function'?saveInstructor:null;
  if(originalSaveInstructor)saveInstructor=function(){
    const id=document.getElementById('modal-id')&&document.getElementById('modal-id').value;
    const ins=Array.isArray(instructors)?instructors.find(i=>i&&i.id===id):null;
    const active=document.getElementById(ACTIVE_CONTROL_ID);
    if(ins&&active)ins.active=!!active.checked;
    const result=originalSaveInstructor.apply(this,arguments);
    if(typeof refreshInsSel==='function')refreshInsSel();
    if(typeof renderInsGrid==='function')renderInsGrid();
    return result;
  };

  const originalRefreshInsSel=typeof refreshInsSel==='function'?refreshInsSel:null;
  if(originalRefreshInsSel)refreshInsSel=function(){
    originalRefreshInsSel.apply(this,arguments);
    const el=document.getElementById('s-instructor-direct');
    if(!el||!Array.isArray(instructors))return;
    const inactive=new Set(instructors.filter(ins=>!isInstructorActive(ins)).map(ins=>ins.id));
    Array.from(el.querySelectorAll('input')).forEach(input=>{
      if(inactive.has(input.value)){
        const label=input.closest('label');
        if(label)label.remove();
      }
    });
  };

  const originalGetInstructorTimesForDay=typeof getInstructorTimesForDay==='function'?getInstructorTimesForDay:null;
  if(originalGetInstructorTimesForDay)getInstructorTimesForDay=function(ins,day){
    if(!isInstructorActive(ins))return[];
    return originalGetInstructorTimesForDay.apply(this,arguments);
  };

  const originalComputeSlots=typeof computeSlots==='function'?computeSlots:null;
  if(originalComputeSlots)computeSlots=function(){
    const slots=originalComputeSlots.apply(this,arguments)||[];
    return slots.filter(slot=>(slot.entries||[]).every(e=>isInstructorActive(e&&e.instructor)));
  };
}

function enhanceChipDrag(chips,itemSelector,onClass,valueGetter){
  if(!chips||chips.dataset.rmv2DragEnhanced==='1')return;
  chips.dataset.rmv2DragEnhanced='1';
  let active=false,mode=null,last=null;
  const itemAt=e=>{
    const node=document.elementFromPoint(e.clientX,e.clientY);
    return node&&node.closest?node.closest(itemSelector):null;
  };
  const apply=item=>{
    if(!item||!chips.contains(item)||item===last)return;
    item.classList.toggle(onClass,mode==='on');
    item.classList.add('selecting');
    last=item;
  };
  const done=()=>{
    if(!active)return;
    active=false;mode=null;last=null;
    document.body.classList.remove('drag-selecting');
    chips.querySelectorAll('.selecting').forEach(x=>x.classList.remove('selecting'));
    if(typeof updateStudentDbSaveButtonState==='function')updateStudentDbSaveButtonState();
  };
  chips.addEventListener('pointerdown',e=>{
    const item=e.target.closest(itemSelector);
    if(!item)return;
    e.preventDefault();
    active=true;
    mode=item.classList.contains(onClass)?'off':'on';
    document.body.classList.add('drag-selecting');
    apply(item);
  });
  chips.addEventListener('pointermove',e=>{
    if(active)apply(itemAt(e));
  });
  chips.addEventListener('pointerup',done);
  chips.addEventListener('pointercancel',done);
  chips.addEventListener('mouseleave',()=>{if(active)document.addEventListener('pointerup',done,{once:true});});
  chips.addEventListener('click',()=>{
    if(typeof valueGetter==='function')valueGetter();
    if(typeof updateStudentDbSaveButtonState==='function')updateStudentDbSaveButtonState();
  });
}

function patchTimeDrag(){
  enableTimeChipSelection=function(chips){
    enhanceChipDrag(chips,'.time-chip','on');
  };

  const originalRenderTimeSlots=typeof renderTimeSlots==='function'?renderTimeSlots:null;
  if(originalRenderTimeSlots)renderTimeSlots=function(cid,selected){
    originalRenderTimeSlots.apply(this,arguments);
    const el=document.getElementById(cid);
    if(el)el.querySelectorAll('.time-slot').forEach(slot=>{slot.onclick=null;});
    enhanceChipDrag(el,'.time-slot','selected');
  };

  document.querySelectorAll('.day-time-chips').forEach(chips=>enableTimeChipSelection(chips));
  document.querySelectorAll('.time-grid').forEach(grid=>{
    grid.querySelectorAll('.time-slot').forEach(slot=>{slot.onclick=null;});
    enhanceChipDrag(grid,'.time-slot','selected');
  });
}

function normalizePhone(text){
  const digits=String(text||'').replace(/\D/g,'');
  if(!digits)return'';
  let d=digits;
  if(d.startsWith('82'))d='0'+d.slice(2);
  if(d.length===11)return d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7);
  if(d.length===10)return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6);
  return String(text||'').trim();
}

function findPhoneMatch(raw,opts){
  opts=opts||{};
  const text=String(raw||'');
  const formatted=text.match(/(?:\+?82[-.\s]?)?0?1[016789][-\s.]?\d{3,4}[-.\s]?\d{4}/);
  if(formatted)return formatted;
  const compact=text.match(/\d{10,11}/);
  if(!compact)return null;
  const digits=compact[0];
  if(opts.live&&digits.length<11)return null;
  return compact;
}

function splitNamePhone(text,opts){
  const raw=String(text||'').trim();
  if(!raw)return null;
  const match=findPhoneMatch(raw,opts);
  if(!match)return null;
  const phone=normalizePhone(match[0]);
  const name=raw.slice(0,match.index).trim()+' '+raw.slice(match.index+match[0].length).trim();
  return {name:name.replace(/\s+/g,' ').trim(),phone};
}

function patchStudentIdentityParsing(){
  const nameEl=document.getElementById('s-name');
  const phoneEl=document.getElementById('s-phone');
  if(!nameEl||!phoneEl||nameEl.dataset.rmv2IdentityParser==='1')return;
  nameEl.dataset.rmv2IdentityParser='1';
  let busy=false;
  const applyFrom=(source,opts)=>{
    if(busy)return;
    const parsed=splitNamePhone(source.value,opts);
    if(!parsed)return;
    busy=true;
    if(parsed.name)nameEl.value=parsed.name;
    if(parsed.phone)phoneEl.value=parsed.phone;
    busy=false;
    if(typeof updateStudentDbSaveButtonState==='function')updateStudentDbSaveButtonState();
    if(typeof generateMessages==='function')try{generateMessages();}catch(_){ }
  };
  nameEl.addEventListener('input',()=>applyFrom(nameEl,{live:true}));
  nameEl.addEventListener('blur',()=>applyFrom(nameEl,{live:false}));
  phoneEl.addEventListener('input',()=>{
    if(/[^\d\s().+\-]/.test(phoneEl.value))applyFrom(phoneEl,{live:true});
  });
  phoneEl.addEventListener('blur',()=>{
    const parsed=splitNamePhone(phoneEl.value,{live:false});
    if(parsed)applyFrom(phoneEl,{live:false});
    else if(phoneEl.value.trim())phoneEl.value=normalizePhone(phoneEl.value);
  });
}

addStyles();
patchInstructorActive();
patchTimeDrag();
patchStudentIdentityParsing();
if(typeof renderInsGrid==='function')renderInsGrid();
if(typeof refreshInsSel==='function')refreshInsSel();

window.__RMV2_USABILITY__={version:VERSION,isInstructorActive,splitNamePhone,normalizePhone,findPhoneMatch};
try{parent.postMessage({type:'rmv2-usability-ready',usability:{version:VERSION}},location.origin);}catch(_){ }
})();
