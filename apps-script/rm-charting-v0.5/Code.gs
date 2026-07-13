/**
 * RM 잔디 → 학생정보 → 개인 카카오톡 발송대기
 * v0.5 TEST + RM 상담차팅
 *
 * 대상 스프레드시트:
 * RM_잔디→개인카톡 자동화_테스트_v0.4
 *
 * 보안 원칙:
 * - API 키와 토큰은 시트가 아니라 Apps Script의 Script Properties에 저장합니다.
 * - 설정!SYSTEM_ENABLED가 FALSE이면 원문만 접수하고 AI 분석은 실행하지 않습니다.
 * - 설정!AUTO_SEND가 FALSE이면 AHK가 실제 발송 건을 claim할 수 없습니다.
 */

const APP_VERSION = '0.5';
const SPREADSHEET_ID = '1Z5I2mDgQvrV0-g_iKbVP6emkDgp57hKFaOdRc57FozM';

const SHEETS = Object.freeze({
  SETTINGS: '설정',
  RAW: '잔디원문',
  STUDENTS: '학생정보',
  QUEUE: '카카오발송대기',
  INSTRUCTORS: '강사매핑',
  ERRORS: '오류로그',
  CHARTING: '상담차팅',
  CHARTING_LOG: '차팅전송로그',
});

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = String(params.action || 'health');

    if (action === 'health') {
      return jsonOutput_({
        ok: true,
        service: 'RM_JANDI_KAKAO',
        version: getSetting_('VERSION', APP_VERSION),
        system_enabled: getBooleanSetting_('SYSTEM_ENABLED', false),
        auto_send: getBooleanSetting_('AUTO_SEND', false),
        time: nowIso_(),
      });
    }

    verifyWorkerToken_(params.worker_token);

    if (action === 'preview_text') {
      return textOutput_(getQueueJobText_(false));
    }

    if (action === 'claim_text') {
      if (!getBooleanSetting_('SYSTEM_ENABLED', false)) return textOutput_('DISABLED');
      if (!getBooleanSetting_('AUTO_SEND', false)) return textOutput_('AUTO_SEND_OFF');
      return textOutput_(getQueueJobText_(true));
    }

    return jsonOutput_({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (error) {
    logError_('', 'doGet', 'ERROR', 'GET_FAILED', error);
    return jsonOutput_({ ok: false, error: String(error.message || error) });
  }
}

function doPost(e) {
  let payload = {};
  let isCharting = false;

  try {
    payload = parsePostBody_(e);
    isCharting = String(payload.action || '').indexOf('charting_') === 0;

    if (isCharting) {
      return handleChartingPost_(payload);
    }

    if (payload.action && payload.worker_token) {
      return handleWorkerPost_(payload);
    }

    return handleJandiWebhook_(payload);
  } catch (error) {
    const sourceId = payload && payload.source_id ? String(payload.source_id) : '';
    logError_(sourceId, 'doPost', 'ERROR', 'POST_FAILED', error, safeJson_(payload));

    if (isCharting) {
      return jsonOutput_({
        ok: false,
        error: normalizeErrorCode_(error),
      });
    }

    return jandiOutput_(
      '⚠️ 자동화 접수 중 오류가 발생했습니다. 운영팀 오류로그를 확인해 주세요.',
      '#D9534F'
    );
  }
}

function handleJandiWebhook_(payload) {
  verifyJandiPayload_(payload);

  const rawText = String(payload.data || payload.text || '').trim();
  const sourceId = makeSourceId_(payload, rawText);
  const systemEnabled = getBooleanSetting_('SYSTEM_ENABLED', false);

  let rawRow = 0;
  const intakeLock = LockService.getScriptLock();
  intakeLock.waitLock(15000);

  try {
    if (sourceExists_(sourceId)) {
      return jandiOutput_('이미 접수된 학생정보입니다. 중복 저장하지 않았습니다.', '#BBCBCD');
    }

    rawRow = appendRaw_(
      sourceId,
      payload,
      rawText,
      systemEnabled ? 'RECEIVED' : 'RECEIVED_ONLY',
      ''
    );
  } finally {
    intakeLock.releaseLock();
  }

  if (!systemEnabled) {
    return jandiOutput_(
      '학생정보 원문을 테스트 시트에 접수했습니다. 현재 AI 분석과 카카오 발송은 꺼져 있습니다.',
      '#BBCBCD'
    );
  }

  try {
    const parsed = extractStudentInfo_(rawText);
    const instructorMap = findInstructor_(parsed.instructor);

    const missingCore = [];
    if (!parsed.student_name) missingCore.push('학생명 없음');
    if (!parsed.instructor) missingCore.push('담당강사 없음');
    if (!instructorMap) missingCore.push('강사매핑 없음');
    if (instructorMap && !instructorMap.active) missingCore.push('강사 비활성');
    if (instructorMap && !instructorMap.kakao_chat_key) {
      missingCore.push('카카오 채팅방 검색명 없음');
    }

    const reviewReasons = Array.from(
      new Set((parsed.review_reasons || []).concat(missingCore))
    );

    const reviewRequired =
      Boolean(parsed.review_required) ||
      Number(parsed.ai_confidence || 0) < 0.78 ||
      reviewReasons.length > 0;

    const studentId = 'STU-' + Utilities.getUuid();
    appendStudent_(studentId, sourceId, parsed, reviewRequired, rawText);

    let queueCreated = false;
    if (!reviewRequired) {
      const queueId = 'Q-' + Utilities.getUuid();
      const message = buildInstructorMessage_(parsed);

      appendQueue_(
        queueId,
        sourceId,
        studentId,
        parsed.instructor,
        instructorMap.kakao_chat_key,
        message
      );
      queueCreated = true;
    }

    updateRawStatusByRow_(
      rawRow,
      reviewRequired ? 'REVIEW_REQUIRED' : 'PARSED',
      new Date(),
      reviewReasons.join(' / ')
    );

    if (reviewRequired) {
      return jandiOutput_(
        '학생정보는 저장했지만 자동발송하지 않았습니다. 운영팀 검토 사유: ' +
          reviewReasons.join(', '),
        '#FAC11B'
      );
    }

    return jandiOutput_(
      queueCreated
        ? '학생정보 저장 및 강사 카카오 발송대기 등록을 완료했습니다.'
        : '학생정보 저장을 완료했습니다.',
      '#BBCBCD'
    );
  } catch (error) {
    updateRawStatusByRow_(
      rawRow,
      'ERROR',
      new Date(),
      normalizeErrorCode_(error)
    );
    throw error;
  }
}

function handleWorkerPost_(payload) {
  verifyWorkerToken_(payload.worker_token);

  const action = String(payload.action || '');
  const queueId = String(payload.queue_id || '');
  if (!queueId) throw new Error('QUEUE_ID_REQUIRED');

  const row = findRowByValue_(SHEETS.QUEUE, 1, queueId);
  if (!row) throw new Error('QUEUE_NOT_FOUND');

  const sheet = getSheet_(SHEETS.QUEUE);
  const attemptCell = sheet.getRange(row, 12);
  const currentAttempts = Number(attemptCell.getValue() || 0);

  if (action === 'complete') {
    sheet.getRange(row, 7).setValue('SENT');
    sheet.getRange(row, 11).setValue(new Date());
    sheet.getRange(row, 13).setValue('');
    return jsonOutput_({ ok: true, queue_id: queueId, status: 'SENT' });
  }

  if (action === 'fail') {
    const attempts = currentAttempts + 1;
    const maxRetry = Number(getSetting_('MAX_RETRY', 3));
    const nextStatus = attempts >= maxRetry ? 'FAILED' : 'WAITING';

    sheet.getRange(row, 7).setValue(nextStatus);
    sheet.getRange(row, 10).setValue('');
    sheet.getRange(row, 12).setValue(attempts);
    sheet.getRange(row, 13).setValue(String(payload.error || 'UNKNOWN_AHK_ERROR'));

    return jsonOutput_({
      ok: true,
      queue_id: queueId,
      status: nextStatus,
      attempt_count: attempts,
    });
  }

  throw new Error('UNKNOWN_WORKER_ACTION');
}

function getQueueJobText_(claim) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    requeueStaleLocks_();

    const sheet = getSheet_(SHEETS.QUEUE);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return 'EMPTY';

    const values = sheet.getRange(2, 1, lastRow - 1, 14).getValues();

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const status = String(row[6] || '');
      if (status !== 'WAITING') continue;

      const queueId = String(row[0] || '');
      const instructor = String(row[3] || '');
      const chatKey = String(row[4] || '');
      const message = String(row[5] || '');

      if (!queueId || !chatKey || !message) continue;

      if (claim) {
        const sheetRow = i + 2;
        sheet.getRange(sheetRow, 7).setValue('LOCKED');
        sheet.getRange(sheetRow, 10).setValue(new Date());
      }

      return [
        'READY',
        queueId,
        chatKey,
        instructor,
        '---MESSAGE---',
        message,
      ].join('\n');
    }

    return 'EMPTY';
  } finally {
    lock.releaseLock();
  }
}

function requeueStaleLocks_() {
  const sheet = getSheet_(SHEETS.QUEUE);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const values = sheet.getRange(2, 7, lastRow - 1, 4).getValues();
  const staleMs = 5 * 60 * 1000;
  const now = Date.now();

  values.forEach((row, index) => {
    const status = String(row[0] || '');
    const lockedAt = row[3];
    if (status !== 'LOCKED' || !(lockedAt instanceof Date)) return;
    if (now - lockedAt.getTime() > staleMs) {
      sheet.getRange(index + 2, 7).setValue('WAITING');
      sheet.getRange(index + 2, 10).setValue('');
    }
  });
}

function extractStudentInfo_(rawText) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('OPENAI_API_KEY');
  const model = props.getProperty('OPENAI_MODEL');

  if (!apiKey) throw new Error('CONFIG_OPENAI_API_KEY');
  if (!model) throw new Error('CONFIG_OPENAI_MODEL');

  const schema = {
    type: 'object',
    properties: {
      student_name: { type: 'string' },
      phone: { type: 'string' },
      instructor: { type: 'string' },
      subject: { type: 'string' },
      level: { type: 'string' },
      schedule_text: { type: 'string' },
      first_class_date: { type: 'string' },
      registration_count: { type: 'string' },
      goal: { type: 'string' },
      background: { type: 'string' },
      teaching_note: { type: 'string' },
      ai_confidence: { type: 'number' },
      review_required: { type: 'boolean' },
      review_reasons: { type: 'array', items: { type: 'string' } },
    },
    required: ['student_name','phone','instructor','subject','level','schedule_text','first_class_date','registration_count','goal','background','teaching_note','ai_confidence','review_required','review_reasons'],
    additionalProperties: false,
  };

  const systemPrompt = [
    '당신은 라이언멤버스 신규 학생 상담문에서 사실만 추출하는 데이터 정규화 엔진이다.',
    '원문에 없는 사실은 절대 만들지 않는다.',
    '강사가 둘 이상 언급되거나 "가능", "확인 중", "후보", "일단"처럼 미확정 표현이 있으면 review_required=true로 한다.',
    '담당강사는 최종 확정 표현이 있을 때만 instructor에 넣는다.',
    '날짜가 명확하면 first_class_date를 YYYY-MM-DD로 반환하고 불명확하면 빈 문자열로 둔다.',
    '전화번호, 레벨, 과목, 등록회차가 없으면 빈 문자열로 둔다.',
    'goal은 학습 목적, background는 직업·경력·성향·관심사, teaching_note는 강사가 수업에 활용할 핵심 지침만 요약한다.',
    'ai_confidence는 전체 추출 신뢰도를 0~1로 반환한다.',
    '학생명 또는 담당강사가 불명확하면 review_required=true로 한다.',
    '오늘 날짜(Asia/Seoul): ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
  ].join('\n');

  const requestBody = {
    model: model,
    store: false,
    max_output_tokens: 2000,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawText },
    ],
    text: { format: { type: 'json_schema', name: 'rm_student_intake', schema: schema, strict: true } },
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) throw new Error('OPENAI_HTTP_' + status + ': ' + body.slice(0, 500));
  const parsedResponse = JSON.parse(body);
  const outputText = extractResponseOutputText_(parsedResponse);
  if (!outputText) throw new Error('OPENAI_EMPTY_OUTPUT');
  return JSON.parse(outputText);
}

function extractResponseOutputText_(response) {
  if (response.output_text) return String(response.output_text);
  const chunks = [];
  (response.output || []).forEach(item => {
    (item.content || []).forEach(content => {
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
    });
  });
  return chunks.join('');
}

function buildInstructorMessage_(p) {
  return ['[라이언멤버스 신규학생 안내]','','학생명: ' + valueOrDash_(p.student_name),'과목/레벨: ' + joinNonEmpty_([p.subject, p.level], ' / '),'수업일정: ' + valueOrDash_(p.schedule_text),'첫 수업일: ' + valueOrDash_(p.first_class_date),'등록회차: ' + valueOrDash_(p.registration_count),'','[학습 목적]',valueOrDash_(p.goal),'','[학생 배경]',valueOrDash_(p.background),'','[수업 참고사항]',valueOrDash_(p.teaching_note)].join('\n');
}

function appendRaw_(sourceId, payload, rawText, status, errorCode) {
  const sheet = getSheet_(SHEETS.RAW);
  const row = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(row, 1, 1, 9).setValues([[sourceId,parseJandiDate_(payload.createdAt),getWriterName_(payload),String(payload.roomName || ''),rawText,true,status,'',errorCode || '']]);
  return row;
}
function appendStudent_(studentId, sourceId, p, reviewRequired, rawText) {getSheet_(SHEETS.STUDENTS).appendRow([studentId,sourceId,p.student_name || '',p.phone || '',p.instructor || '',p.subject || '',p.level || '',p.schedule_text || '',p.first_class_date || '',p.registration_count || '',p.goal || '',p.background || '',p.teaching_note || '',Number(p.ai_confidence || 0),Boolean(reviewRequired),new Date(),rawText]);}
function appendQueue_(queueId, sourceId, studentId, instructor, chatKey, message) {getSheet_(SHEETS.QUEUE).appendRow([queueId,sourceId,studentId,instructor,chatKey,message,'WAITING','NORMAL',new Date(),'','',0,'',makeChecksum_(chatKey + '\n' + message)]);}
function findInstructor_(name) {const needle=normalizeName_(name);if(!needle)return null;const sheet=getSheet_(SHEETS.INSTRUCTORS),lastRow=sheet.getLastRow();if(lastRow<2)return null;const rows=sheet.getRange(2,1,lastRow-1,5).getValues();for(const row of rows){if(normalizeName_(row[0])===needle)return{instructor:String(row[0]||''),kakao_chat_key:String(row[1]||''),phone:String(row[2]||''),active:row[3]===true||String(row[3]).toUpperCase()==='TRUE',notes:String(row[4]||'')}}return null;}
function updateRawStatusByRow_(row,status,processedAt,errorCode){if(!row||row<2)return;getSheet_(SHEETS.RAW).getRange(row,7,1,3).setValues([[status||'',processedAt||'',errorCode||'']]);}
function normalizeErrorCode_(error){const message=String(error&&error.message?error.message:error||'UNKNOWN_ERROR');return message.split('\n')[0].trim().slice(0,500);}
function sourceExists_(sourceId){return Boolean(findRowByValue_(SHEETS.RAW,1,sourceId));}
function findRowByValue_(sheetName,column,value){const sheet=getSheet_(sheetName),lastRow=sheet.getLastRow();if(lastRow<2)return 0;const finder=sheet.getRange(2,column,lastRow-1,1).createTextFinder(String(value)).matchEntireCell(true).findNext();return finder?finder.getRow():0;}
function getSetting_(key,defaultValue){const sheet=getSheet_(SHEETS.SETTINGS),lastRow=sheet.getLastRow();if(lastRow<2)return defaultValue;const rows=sheet.getRange(2,1,lastRow-1,2).getValues();for(const row of rows)if(String(row[0]||'')===String(key))return row[1];return defaultValue;}
function getBooleanSetting_(key,defaultValue){const value=getSetting_(key,defaultValue);return typeof value==='boolean'?value:String(value).toUpperCase()==='TRUE';}
function verifyJandiPayload_(payload){const props=PropertiesService.getScriptProperties(),expectedToken=props.getProperty('JANDI_TOKEN'),expectedRoom=props.getProperty('JANDI_ROOM_NAME');if(!expectedToken)throw new Error('CONFIG_JANDI_TOKEN');if(String(payload.token||'')!==expectedToken)throw new Error('INVALID_JANDI_TOKEN');if(expectedRoom&&String(payload.roomName||'')!==expectedRoom)throw new Error('INVALID_JANDI_ROOM');if(!payload.data&&!payload.text)throw new Error('EMPTY_JANDI_TEXT');}
function verifyWorkerToken_(token){const expected=PropertiesService.getScriptProperties().getProperty('WORKER_TOKEN');if(!expected)throw new Error('CONFIG_WORKER_TOKEN');if(String(token||'')!==expected)throw new Error('INVALID_WORKER_TOKEN');}
function parsePostBody_(e){if(!e||!e.postData||!e.postData.contents)return{};const type=String(e.postData.type||'').toLowerCase(),contents=String(e.postData.contents||'');if(type.includes('application/json')||type.includes('text/plain')){try{return JSON.parse(contents)}catch(_){}}const result={};contents.split('&').forEach(pair=>{const parts=pair.split('='),key=decodeURIComponent(parts.shift()||''),value=decodeURIComponent(parts.join('=')||'').replace(/\+/g,' ');result[key]=value});return result;}
function logError_(sourceId,stage,severity,code,error,payloadExcerpt){try{getSheet_(SHEETS.ERRORS).appendRow(['ERR-'+Utilities.getUuid(),new Date(),sourceId||'',stage||'',severity||'ERROR',code||'',String(error&&error.message?error.message:error),String(payloadExcerpt||'').slice(0,2000),false,''])}catch(_){console.error(error)}}
function getSheet_(name){const sheet=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);if(!sheet)throw new Error('SHEET_NOT_FOUND: '+name);return sheet;}
function makeSourceId_(payload,rawText){return'J-'+sha256Hex_([payload.teamName||'',payload.roomName||'',getWriterName_(payload),payload.createdAt||'',rawText].join('|')).slice(0,24)}
function makeChecksum_(text){return sha256Hex_(text).slice(0,24)}
function sha256Hex_(text){const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8);return digest.map(byte=>('0'+((byte+256)%256).toString(16)).slice(-2)).join('')}
function parseJandiDate_(value){const date=value?new Date(value):new Date();return isNaN(date.getTime())?new Date():date}
function getWriterName_(payload){if(payload.writer&&payload.writer.name)return String(payload.writer.name);return String(payload.writerName||'')}
function normalizeName_(value){return String(value||'').replace(/\s+/g,'').toLowerCase()}
function valueOrDash_(value){const text=String(value||'').trim();return text||'-'}
function joinNonEmpty_(values,separator){const result=values.map(v=>String(v||'').trim()).filter(Boolean).join(separator);return result||'-'}
function nowIso_(){return Utilities.formatDate(new Date(),'Asia/Seoul',"yyyy-MM-dd'T'HH:mm:ssXXX")}
function safeJson_(value){try{return JSON.stringify(value)}catch(_){return String(value)}}
function jsonOutput_(object){return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON)}
function textOutput_(text){return ContentService.createTextOutput(String(text)).setMimeType(ContentService.MimeType.TEXT)}
function jandiOutput_(body,color){return jsonOutput_({body:body,connectColor:color||'#BBCBCD'})}