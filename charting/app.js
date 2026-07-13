const BACKEND_URL='https://script.google.com/macros/s/AKfycbx-5XshUD_hLa4nMh7vJR2iom_yYUiTalz4mxmAh5npEmtmOZ-Sq9gg906xqy6ovp75nQ/exec';
const FORM_VERSION='0.5.3-MVP';
const LEVEL_TEMPLATES={"LV1_BASE": {"level": "LV1", "label": "LV1 기본 — Word Order", "text": "lv1\nword order(필요시 한국어로 어순훈련시켜주세요. 교재 앞쪽에 있음), small talk paragraph, message house (앞에서부터 우선순위로 교육해주세요. 문법설명보다는 스몰톡 답변을 만들어내고 월간테스트에 대비하는 것이 가장 중요합니다^^)"}, "LV2_BASE": {"level": "LV2", "label": "LV2 기본", "text": "lv2\nsmall talk paragraph, message house, verb tense (앞에서부터 우선순위로 교육해주세요. 문법설명보다는 스몰톡 답변을 만들어내고 월간테스트에 대비하는 것이 가장 중요합니다^^)"}, "LV2_COMPLETE_SENTENCE": {"level": "LV2", "label": "LV2 Complete Sentences 보완", "text": "lv2\n종종 올바른 어순의 complete sentences 표준문장을 교육해주세요. + small talk paragraph, message house, verb tense (앞에서부터 우선순위로 교육해주세요. 문법설명보다는 스몰톡 답변을 만들어내고 월간테스트에 대비하는 것이 가장 중요합니다^^)"}, "LV2_COMPLEX_SENTENCE": {"level": "LV2", "label": "LV2 4·5형식·관계대명사 확장", "text": "lv2\n(4,5형식의 긴 문장 & 관계대명사를 사용한 확장문장을 시도하도록 독려 encouraging to challenge 해주세요. 예를 들어, I went swimming. Swimming is my favorite. => I went swimming, which is my favorite.으로) small talk paragraph, message house, verb tense (앞에서부터 우선순위로 교육해주세요. 문법설명보다는 스몰톡 답변을 만들어내고 월간테스트에 대비하는 것이 가장 중요합니다^^)"}, "LV2_INTERVIEW_FIRST": {"level": "LV2", "label": "LV2 영어면접 우선", "text": "lv2\n영어면접준비 + small talk paragraph, message house, verb tense (앞에서부터 우선순위로 교육해주세요. 문법설명보다는 스몰톡 답변을 만들어내고 월간테스트에 대비하는 것이 가장 중요합니다^^)"}, "LV2_INTERVIEW_AFTER_CORE": {"level": "LV2", "label": "LV2 기본수업 후 영어면접", "text": "lv2\nsmall talk paragraph, message house, verb tense + 영어면접준비 (앞에서부터 우선순위로 교육해주세요. 문법설명보다는 스몰톡 답변을 만들어내고 월간테스트에 대비하는 것이 가장 중요합니다^^)"}, "LV3_ACCURACY_SOUND": {"level": "LV3", "label": "LV3 정확도·소리교육·토론", "text": "lv3\n높은 수준이지만 small talk paragraph에서 오류들을 모두 찾아내주는 것 + 소리교육(발음 & 듣기)이 중요합니다. 영어토론교재를 병행해도 좋습니다. 1-2회의 스몰톡 수업 후 또는 선생님이 직접 겪어보고 바로 주1회는 토론수업을 하는 등의 조정을 하셔도 좋습니다. verb tense, formal verb phrase & words"}, "LV3_INTERVIEW_DISCUSSION": {"level": "LV3", "label": "LV3 인터뷰·전공설명·토론", "text": "lv3\n스몰톡 스피킹은 매우 좋으나 전공 설명하기 등 영어면접에 준비된 수준은 아니므로 영어면접을 하거나, 학생 개인에 대해 마치 할리우드 스타 인터뷰를 하듯 상세한 답변을 준비하는 것으로 스몰톡을 학습하게 해주세요. 빠르게 토론교재로 넘어가주세요. 토론교재에서도, 개인과제에서도 별점을 계속 매겨 피드백을 주세요."}};
const CHIP_OPTIONS={
 conversation_tags:['말수가 적음','미소·리액션 좋음','적극적','집중력 좋음','빠른 대화 속도','유머·농담 선호','신뢰 형성에 시간 필요','차분함','정중함','표정 변화 적음','질문이 많음','실수에 민감함','자신감 낮음','설명을 많이 원함','직접 참여 시 만족도 높음'],
 past_learning_tags:['학교 문법교육','독해 중심','시험영어','그룹회화','원어민 1:1','온라인 수업','독학','영어유치원','해외 거주','장기간 공백','별도 학습경험 없음'],
 goal_tags:['자기계발','해외여행','일상회화','업무영어','외국인 고객 응대','해외출장','해외취업','유학','이민','자녀교육','발음교정','영어면접','OPIc','IELTS','TOEFL','프레젠테이션','아카데믹 토론'],
 class_tags:['Small Talk','Message House','Word Order','Verb Tense','Pronunciation','Listening','TED','VOA','Discussion','Debating','Business English','Medical English','Travel English','OPIc','IELTS','English Interview','Academic Writing','TOEFL','토익스피킹','토익','맞춤형 시험준비','교수임용','키즈 스몰톡','키즈 토론','주니어 토플','유학준비'],
 method_tags:['한국어로 힌트를 주는 설명하며 영어단어로 말하게 유도','틀린 것 즉시 교정','끝까지 들어주며 기다려드리는 것 선호','정답 잘 알려주지 않고 힌트로 유도해서 맞추는 즐거움','선생님 말 따라 말하기(modeling)','낭독훈련','틀린 발음 집중교정','단어로만 말하는 것들 완성형 문장으로','한 문장이 아닌 문단으로 답변','편한 수업분위기지만 철저한 월간테스트와 피드백 중심','혼자 집중할 수 있는 과제 선호','단순시제 습관을 완료형 사용으로 확장','4,5형식 사용유도','관계대명사 that, which, who 사용유도','분사구문 -ing(하면서), -ed(되어서) 사용유도','어순만 집중훈련(누가, 한다, 무엇을, 어디서, 언제)','AAA구조(3문장 Answer, Add, Ask)','에피소딕 메세지하우스(육하원칙)','논리적 메세지하우스(주장-이유-근거/예시-마무리)']
};
let password='', selectedLevel='', selectedTemplate='', correctedDirty=false, proofreadSourceText='', proofreadStale=false, submitCompleted=false, lastRecordId='', autosaveTimer=null;

const $=id=>document.getElementById(id);
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function val(id){return ($(id)?.value||'').trim()}
function joinParts(parts){return parts.filter(Boolean).join(' / ')}
function chipValues(id){return [...document.querySelectorAll('#'+id+' .chip.on')].map(x=>x.dataset.value)}

function renderChips(){
 Object.entries(CHIP_OPTIONS).forEach(([id,items])=>{
   const el=$(id); el.innerHTML='';
   items.forEach(item=>{
     const b=document.createElement('button'); b.type='button'; b.className='chip'; b.dataset.value=item; b.textContent=item;
     b.onclick=()=>{b.classList.toggle('on'); onChange()};
     el.appendChild(b);
   });
 });
}
function renderLevels(){
 $('levelPills').innerHTML=['LV1','LV2','LV3'].map(l=>`<button type="button" class="level-pill" data-level="${l}">${l}</button>`).join('');
 document.querySelectorAll('.level-pill').forEach(b=>b.onclick=()=>selectLevel(b.dataset.level));
}
function selectLevel(level){
 selectedLevel=level;
 document.querySelectorAll('.level-pill').forEach(b=>b.classList.toggle('on',b.dataset.level===level));
 const templates=Object.entries(LEVEL_TEMPLATES).filter(([,v])=>v.level===level);
 $('templateList').innerHTML=templates.map(([code,v])=>`<button type="button" class="template ${selectedTemplate===code?'on':''}" data-code="${code}"><strong>${esc(v.label)}</strong></button>`).join('');
 document.querySelectorAll('.template').forEach(b=>b.onclick=()=>selectTemplate(b.dataset.code));
 if(!templates.some(([code])=>code===selectedTemplate)){selectedTemplate=''; $('level_final_text').value='';}
 onChange();
}
function selectTemplate(code){
 selectedTemplate=code;
 document.querySelectorAll('.template').forEach(b=>b.classList.toggle('on',b.dataset.code===code));
 $('level_final_text').value=LEVEL_TEMPLATES[code].text;
 onChange();
}

function buildRecord(){
 return {
   consultation_date:val('consultation_date'), chart_type:val('chart_type'), student_name:val('student_name'),
   age_group:val('age_group'), age_raw:val('age_raw'), gender:val('gender'),
   residence_standard:val('residence_standard'), residence_raw:val('residence_raw'),
   conversation_tags:chipValues('conversation_tags').join(', '), conversation_notes:val('conversation_notes'),
   occupation_group:val('occupation_group'), occupation_raw:val('occupation_raw'), organization:val('organization'),
   past_learning_tags:chipValues('past_learning_tags').join(', '), past_learning_notes:val('past_learning_notes'),
   study_abroad_type:val('study_abroad_type'), study_abroad_notes:val('study_abroad_notes'),
   travel_frequency:val('travel_frequency'), goal_tags:chipValues('goal_tags').join(', '), goal_notes:val('goal_notes'),
   phonics_rating:val('phonics_rating'), phonics_notes:val('phonics_notes'),
   pronunciation_rating:val('pronunciation_rating'), pronunciation_notes:val('pronunciation_notes'),
   vocab_rating:val('vocab_rating'), vocab_words:val('vocab_words'), test_prompt:val('test_prompt'), student_response:val('student_response'),
   fluency_rating:val('fluency_rating'), fluency_notes:val('fluency_notes'),
   grammar_rating:val('grammar_rating'), grammar_notes:val('grammar_notes'),
   word_order_rating:val('word_order_rating'), word_order_notes:val('word_order_notes'),
   expansion_rating:val('expansion_rating'), expansion_notes:val('expansion_notes'),
   paragraph_rating:val('paragraph_rating'), paragraph_notes:val('paragraph_notes'),
   vocab_analysis_rating:val('vocab_analysis_rating'), vocab_analysis_notes:val('vocab_analysis_notes'),
   class_tags:chipValues('class_tags').join(', '), method_tags:chipValues('method_tags').join(', '),
   strategy_1:val('strategy_1'), strategy_2:val('strategy_2'), strategy_3:val('strategy_3'), strategy_4:val('strategy_4'), strategy_5:val('strategy_5'),
   level_code:selectedLevel, level_template_code:selectedTemplate, level_special_notes:val('level_special_notes'), level_final_text:val('level_final_text'),
   form_version:FORM_VERSION
 };
}
function buildPreview(r){
 const occupation=joinParts([r.occupation_raw,r.organization && !r.occupation_raw.includes(r.organization)?r.organization:'']);
 const profile1=joinParts([r.conversation_tags,r.conversation_notes]);
 const profile3=joinParts([r.past_learning_tags,r.past_learning_notes]);
 const profile4=joinParts([r.study_abroad_type,r.study_abroad_notes]);
 const profile6=joinParts([r.goal_tags,r.goal_notes]);
 const analysisLine=(label,rating,notes)=>`${label} : ${joinParts([rating,notes])},`;
 const strategies=[r.strategy_1,r.strategy_2,r.strategy_3,r.strategy_4,r.strategy_5].filter(Boolean);
 const strategyText=strategies.length?strategies.map((x,i)=>`${i+1}. ${x}`).join('\n'):'';
 const levelText=joinParts([r.level_final_text,r.level_special_notes]);
 return `${r.student_name || '000'} -
<profile>
1. 대화성향/특징 : ${profile1}
2. 직업 : ${occupation}
3. 과거학습이력 : ${profile3}
4. 어학연수/유학경험 : ${profile4}
5. 해외여행경험 : ${r.travel_frequency}
6. 개인적 학습목표 : ${profile6}
-
<레벨테스트 결과>
1. phonics 파닉스 기능 ${joinParts([r.phonics_rating,r.phonics_notes])}
2. syllables 음소발음 ${joinParts([r.pronunciation_rating,r.pronunciation_notes])}
3. vocab - ${joinParts([r.vocab_rating,r.vocab_words])}
4. (${r.test_prompt}) 그림묘사 테스트 결과 - ${r.student_response}
-
<분석>
${analysisLine('빠른 문장구성과 발화 (말거리 정리 및 발속도)',r.fluency_rating,r.fluency_notes)}
${analysisLine('문법적 정확도',r.grammar_rating,r.grammar_notes)}
${analysisLine('어순',r.word_order_rating,r.word_order_notes)}
${analysisLine('문장확장',r.expansion_rating,r.expansion_notes)}
${analysisLine('문단구성',r.paragraph_rating,r.paragraph_notes)}
${analysisLine('기초어휘',r.vocab_analysis_rating,r.vocab_analysis_notes)}
-
<수업전략>
${strategyText}
-
<레벨>
${levelText}`.trim();
}
function updateSubmitState(){
 const btn=$('submitBtn');
 if(!btn)return;
 btn.disabled=proofreadStale||submitCompleted;
 btn.textContent=submitCompleted?'전송 완료':(proofreadStale?'교정본 다시 생성 필요':'구글시트 저장 + 잔디 전송');
}
function setFormLocked(locked){
 document.querySelectorAll('#formPane input,#formPane select,#formPane textarea,#formPane button').forEach(el=>el.disabled=locked);
 $('proofreadBtn').disabled=locked;
 $('resetProofreadBtn').disabled=locked;
}
function onChange(){
 const original=buildPreview(buildRecord());
 $('originalPreview').value=original;
 if(!correctedDirty){
   $('correctedPreview').value=original;
   proofreadSourceText=original;
   proofreadStale=false;
 }else{
   proofreadStale=Boolean(proofreadSourceText&&proofreadSourceText!==original);
 }
 updateDiff();
 if(proofreadStale){
   $('previewStatus').textContent='교정본 다시 생성 필요';
   showNotice('교정본 생성 후 입력 내용이 바뀌었습니다. 맞춤법 교정본을 다시 생성하거나 교정본을 원문으로 초기화하세요.','error');
 }else{
   $('previewStatus').textContent=val('student_name')?(selectedLevel?'필수값 확인 중':'레벨 미선택'):'학생명 미입력';
 }
 updateSubmitState();
 clearTimeout(autosaveTimer); autosaveTimer=setTimeout(saveDraft,450);
}
function saveDraft(){
 const draft={record:buildRecord(),corrected:$('correctedPreview').value,correctedDirty,proofreadSourceText,proofreadStale,selectedLevel,selectedTemplate,lastRecordId};
 localStorage.setItem('rm_charting_draft',JSON.stringify(draft));
 $('saveState').textContent='임시저장 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
}
function loadDraft(){
 const raw=localStorage.getItem('rm_charting_draft'); if(!raw)return;
 try{
   const d=JSON.parse(raw); const r=d.record||{};
   document.querySelectorAll('[data-field]').forEach(el=>{if(r[el.id]!==undefined)el.value=r[el.id]||''});
   Object.keys(CHIP_OPTIONS).forEach(id=>{
     const selected=String(r[id]||'').split(',').map(x=>x.trim()).filter(Boolean);
     document.querySelectorAll('#'+id+' .chip').forEach(b=>b.classList.toggle('on',selected.includes(b.dataset.value)));
   });
   selectedLevel=d.selectedLevel||r.level_code||''; selectedTemplate=d.selectedTemplate||r.level_template_code||'';
   if(selectedLevel)selectLevel(selectedLevel);
   if(selectedTemplate && LEVEL_TEMPLATES[selectedTemplate]){selectedTemplate=d.selectedTemplate; document.querySelectorAll('.template').forEach(b=>b.classList.toggle('on',b.dataset.code===selectedTemplate));}
   correctedDirty=!!d.correctedDirty; proofreadSourceText=d.proofreadSourceText||''; proofreadStale=!!d.proofreadStale; lastRecordId=d.lastRecordId||'';
   onChange();
   if(d.corrected){$('correctedPreview').value=d.corrected; correctedDirty=true; proofreadStale=Boolean(proofreadSourceText&&proofreadSourceText!==$('originalPreview').value); updateDiff(); updateSubmitState()}
 }catch(e){console.warn(e)}
}
function clearForm(){
 if(!confirm('현재 임시기록을 지우고 새 기록을 시작할까요?'))return;
 localStorage.removeItem('rm_charting_draft'); lastRecordId=''; correctedDirty=false; proofreadSourceText=''; proofreadStale=false; submitCompleted=false; selectedLevel=''; selectedTemplate='';
 document.querySelectorAll('[data-field]').forEach(el=>el.value='');
 document.querySelectorAll('.chip.on').forEach(x=>x.classList.remove('on'));
 setFormLocked(false); $('consultation_date').value=new Date().toISOString().slice(0,10); $('chart_type').value='신규'; renderLevels(); onChange(); updateSubmitState();
 $('retryBtn').classList.add('hidden'); showNotice('새 기록을 시작했습니다.','');
}
function switchTab(name){
 document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===name));
 $('originalPreview').classList.toggle('hidden',name!=='original');
 $('correctedPreview').classList.toggle('hidden',name!=='corrected');
 $('diffPreview').classList.toggle('hidden',name!=='diff');
}
function updateDiff(){
 const a=$('originalPreview').value.split('\n'),b=$('correctedPreview').value.split('\n'),n=Math.max(a.length,b.length); let out=[];
 for(let i=0;i<n;i++){
   if((a[i]||'')===(b[i]||'')){out.push(esc(a[i]||''));continue}
   if(a[i]!==undefined)out.push(`<span class="diff-del">- ${esc(a[i])}</span>`);
   if(b[i]!==undefined)out.push(`<span class="diff-add">+ ${esc(b[i])}</span>`);
 }
 $('diffPreview').innerHTML=out.join('\n');
}
function showNotice(msg,type){
 const n=$('notice');n.textContent=msg;n.className='notice'+(type?' '+type:'');
}
async function api(action,payload={}){
 const res=await fetch(BACKEND_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,auth_password:password,...payload})});
 const text=await res.text(); let data;
 try{data=JSON.parse(text)}catch(e){throw new Error('서버 응답을 읽지 못했습니다: '+text.slice(0,180))}
 if(!data.ok)throw new Error(data.error||'UNKNOWN_SERVER_ERROR');
 return data;
}
async function login(){
 const p=$('loginPassword').value; if(!p)return;
 $('loginBtn').disabled=true;$('loginError').textContent='확인 중...';
 try{await apiWithPassword('charting_health',p);password=p;sessionStorage.setItem('rm_charting_password',p);localStorage.removeItem('rm_charting_password');$('login').classList.add('hidden');$('loginError').textContent=''}
 catch(e){$('loginError').textContent='접속 실패: '+e.message}
 finally{$('loginBtn').disabled=false}
}
async function apiWithPassword(action,p){
 const res=await fetch(BACKEND_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,auth_password:p})});
 const text=await res.text();let data;try{data=JSON.parse(text)}catch(e){throw new Error(text.slice(0,150))}
 if(!data.ok)throw new Error(data.error||'AUTH_FAILED');return data;
}
async function proofread(){
 const original=$('originalPreview').value;
 if(!val('student_name')){showNotice('학생명을 먼저 입력하세요.','error');return}
 $('proofreadBtn').disabled=true;showNotice('맞춤법·띄어쓰기만 교정 중입니다. 학생 영어 응답과 레벨지침은 보호됩니다.','');
 try{
   const protected_segments=[val('student_response'),val('vocab_words'),val('level_final_text')].filter(Boolean);
   const data=await api('charting_proofread',{text:original,protected_segments});
   $('correctedPreview').value=data.corrected_text;correctedDirty=true;proofreadSourceText=original;proofreadStale=false;updateDiff();updateSubmitState();switchTab('corrected');
   showNotice(`교정본 생성 완료 · 모델 ${data.model}`,'success');saveDraft();
 }catch(e){showNotice('교정 실패: '+e.message,'error')}
 finally{$('proofreadBtn').disabled=false}
}
async function submitRecord(){
 const r=buildRecord();
 if(proofreadStale){showNotice('현재 교정본은 이전 입력 내용 기준입니다. 교정본을 다시 생성하거나 원문으로 초기화하세요.','error');return}
 if(submitCompleted){showNotice('이미 전송된 기록입니다. 새 기록 버튼을 눌러 다음 학생을 작성하세요.','error');return}
 const finalText=(correctedDirty?$('correctedPreview').value:$('originalPreview').value).trim();
 const missing=[];if(!r.student_name)missing.push('학생명');if(!r.consultation_date)missing.push('상담일');if(!r.occupation_raw)missing.push('구체적 직업');if(!r.level_code)missing.push('공식 레벨');
 if(missing.length){showNotice('필수값을 확인하세요: '+missing.join(', '),'error');return}
 if(!confirm(`${r.student_name} / ${r.level_code}\n구글시트에 저장하고 잔디에 전송할까요?`))return;
 $('submitBtn').disabled=true;showNotice('시트 저장 및 잔디 전송 중...','');
 try{
   const data=await api('charting_submit',{record_id:lastRecordId,record:r,original_text:$('originalPreview').value,final_text:finalText,proofread_status:correctedDirty?'PROOFREAD_REVIEWED':'ORIGINAL_USED',proofread_source_text:correctedDirty?proofreadSourceText:$('originalPreview').value});
   lastRecordId=data.record_id;
   if(data.jandi_sent){
     showNotice(`완료: 시트 저장 + 잔디 전송 성공 (${data.record_id})`,'success');
     localStorage.removeItem('rm_charting_draft');$('retryBtn').classList.add('hidden');submitCompleted=true;setFormLocked(true);updateSubmitState();
   }else{
     showNotice(`시트 저장은 완료됐지만 잔디 전송은 실패했습니다: ${data.jandi_error}`,'error');
     $('retryBtn').classList.remove('hidden');saveDraft();
   }
 }catch(e){showNotice('저장 실패: '+e.message,'error')}
 finally{if(submitCompleted)updateSubmitState();else $('submitBtn').disabled=false}
}
async function retryJandi(){
 if(!lastRecordId){showNotice('재전송할 record_id가 없습니다.','error');return}
 $('retryBtn').disabled=true;
 try{const data=await api('charting_retry_jandi',{record_id:lastRecordId});showNotice(`잔디 재전송 성공 (${data.record_id})`,'success');$('retryBtn').classList.add('hidden');localStorage.removeItem('rm_charting_draft');submitCompleted=true;setFormLocked(true);updateSubmitState()}
 catch(e){showNotice('잔디 재전송 실패: '+e.message,'error')}
 finally{if(!submitCompleted)$('retryBtn').disabled=false}
}
function init(){
 renderChips();renderLevels();
 document.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('input',onChange));
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
 $('correctedPreview').addEventListener('input',()=>{correctedDirty=true;proofreadSourceText=$('originalPreview').value;proofreadStale=false;updateDiff();updateSubmitState();saveDraft()});
 $('proofreadBtn').onclick=proofread;$('resetProofreadBtn').onclick=()=>{$('correctedPreview').value=$('originalPreview').value;correctedDirty=false;proofreadSourceText=$('originalPreview').value;proofreadStale=false;updateDiff();updateSubmitState();switchTab('original');showNotice('교정본을 작성 원문으로 되돌렸습니다.','')};
 $('submitBtn').onclick=submitRecord;$('retryBtn').onclick=retryJandi;$('clearBtn').onclick=clearForm;
 $('logoutBtn').onclick=()=>{sessionStorage.removeItem('rm_charting_password');localStorage.removeItem('rm_charting_password');location.reload()};
 $('loginBtn').onclick=login;$('loginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
 $('consultation_date').value=new Date().toISOString().slice(0,10);
 loadDraft();onChange();
 localStorage.removeItem('rm_charting_password');const saved=sessionStorage.getItem('rm_charting_password');if(saved){$('loginPassword').value=saved;setTimeout(login,50)}
}
document.addEventListener('DOMContentLoaded',init);
