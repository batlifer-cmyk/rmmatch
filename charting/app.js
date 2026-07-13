(() => {
  const LEGACY_APP_URL = 'https://cdn.jsdelivr.net/gh/batlifer-cmyk/rmmatch@e40139ed5cf717a2c3c9d244c6bcb023f4fbd287/charting/app.js';
  const LONG_FORM_VERSION = '0.6.0-MVP';
  let rmMode = 'long';

  function injectLongModeUi() {
    const formPane = document.getElementById('formPane');
    if (!formPane || document.getElementById('longMode')) return;

    const structured = document.createElement('div');
    structured.id = 'structuredMode';
    structured.className = 'hidden';
    [...formPane.children].forEach(child => structured.appendChild(child));

    const modeCard = document.createElement('div');
    modeCard.className = 'mode-card';
    modeCard.innerHTML = `
      <div>
        <div class="mode-title">기록 방식</div>
        <div class="mode-desc">매튜는 긴 글을 그대로 쓰거나, 필요한 날에는 선택형 상세입력을 사용할 수 있습니다.</div>
      </div>
      <div class="mode-switch">
        <button type="button" class="mode-btn on" data-mode="long">긴 글 빠른입력</button>
        <button type="button" class="mode-btn" data-mode="structured">선택형 상세입력</button>
      </div>`;

    const longMode = document.createElement('div');
    longMode.id = 'longMode';
    longMode.innerHTML = `
      <div class="card">
        <div class="card-title">긴 글 빠른입력</div>
        <div class="card-desc">예전처럼 상담기록 한 편을 그대로 입력합니다. 화면에는 맞춤법 교정본만 보여주고, 최종 전송 시 AI가 내용을 구글시트 각 열로 자동 분류합니다. 잔디에는 교정된 긴 글 전체가 그대로 전송됩니다.</div>
        <div class="grid2">
          <div class="field"><label>상담일 *</label><input id="long_consultation_date" data-long-field type="date"></div>
          <div class="field"><label>기록 구분</label><select id="long_chart_type" data-long-field><option>신규</option><option>재등록</option><option>재상담</option><option>기타</option></select></div>
        </div>
        <div class="field">
          <label>매튜 상담기록 원문 *</label>
          <textarea id="long_text_input" class="long-textarea" data-long-field placeholder="학생명 -&#10;<profile>&#10;1. 대화성향/특징 : ...&#10;... 또는 매튜가 평소 쓰던 긴 상담기록을 그대로 입력하세요."></textarea>
          <small>첫 줄의 학생명과 기존 섹션 표제가 있으면 분류 정확도가 높아집니다. 원문에 없는 정보는 추정하지 않고 비워둡니다.</small>
        </div>
        <div class="long-flow-note">맞춤법 교정본 생성 → 매튜 최종 확인·수정 → 전송 → 잔디에는 한 편의 글, 구글시트에는 분석 가능한 분류 데이터</div>
      </div>`;

    formPane.append(modeCard, longMode, structured);

    const style = document.createElement('style');
    style.textContent = `
      .mode-card{background:#fff;border-radius:7px;box-shadow:var(--shadow);padding:16px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:16px}
      .mode-title{font-size:14px;font-weight:700}.mode-desc{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.5}
      .mode-switch{display:flex;gap:7px;flex-shrink:0}.mode-btn{border:1.5px solid #ccc;background:#fff;color:var(--text);border-radius:5px;padding:9px 14px;font-size:12px;font-weight:700}.mode-btn.on{background:var(--border);border-color:var(--border);color:#fff}
      .long-textarea{min-height:60vh!important;font-size:14px;line-height:1.8!important}
      .long-flow-note{padding:12px 14px;border-radius:5px;background:#edf4f5;color:#496369;font-size:12px;line-height:1.65}
      @media(max-width:640px){.mode-card{align-items:flex-start;flex-direction:column}.mode-switch{width:100%}.mode-btn{flex:1}}`;
    document.head.appendChild(style);
  }

  function loadLegacyApp() {
    const script = document.createElement('script');
    script.src = LEGACY_APP_URL;
    script.onload = installAndStart;
    script.onerror = () => {
      const error = document.getElementById('loginError');
      if (error) error.textContent = '상담차팅 기본 모듈을 불러오지 못했습니다. 새로고침해 주세요.';
    };
    document.head.appendChild(script);
  }

  function installAndStart() {
    const legacyBuildRecord = buildRecord;
    const legacyBuildPreview = buildPreview;

    function today() { return new Date().toISOString().slice(0, 10); }
    function getOriginalText() {
      return rmMode === 'long'
        ? String(document.getElementById('long_text_input').value || '').trim()
        : legacyBuildPreview(buildRecord());
    }
    function getProtectedSegments() {
      return rmMode === 'long'
        ? []
        : [val('student_response'), val('vocab_words'), val('level_final_text')].filter(Boolean);
    }

    buildRecord = function () {
      const record = legacyBuildRecord();
      record.form_version = LONG_FORM_VERSION;
      record.input_mode = 'STRUCTURED_FORM';
      record.extraction_status = 'NOT_APPLICABLE';
      record.extraction_confidence = '';
      record.extraction_reasons = '';
      return record;
    };

    window.setChartingMode = function (mode, preserveProofread) {
      rmMode = mode === 'structured' ? 'structured' : 'long';
      document.getElementById('longMode').classList.toggle('hidden', rmMode !== 'long');
      document.getElementById('structuredMode').classList.toggle('hidden', rmMode !== 'structured');
      document.querySelectorAll('.mode-btn').forEach(button => {
        button.classList.toggle('on', button.dataset.mode === rmMode);
      });
      if (!preserveProofread) {
        correctedDirty = false;
        proofreadSourceText = '';
        proofreadStale = false;
        document.getElementById('correctedPreview').value = '';
      }
      onChange();
    };

    updateSubmitState = function () {
      const button = document.getElementById('submitBtn');
      if (!button) return;
      button.disabled = proofreadStale || submitCompleted;
      button.textContent = submitCompleted
        ? '전송 완료'
        : proofreadStale
          ? '교정본 다시 생성 필요'
          : '구글시트 저장 + 잔디 전송';
    };

    setFormLocked = function (locked) {
      document.querySelectorAll('#formPane input,#formPane select,#formPane textarea,#formPane button').forEach(element => {
        element.disabled = locked;
      });
      document.getElementById('proofreadBtn').disabled = locked;
      document.getElementById('resetProofreadBtn').disabled = locked;
    };

    onChange = function () {
      const original = getOriginalText();
      document.getElementById('originalPreview').value = original;
      if (!correctedDirty) {
        document.getElementById('correctedPreview').value = original;
        proofreadSourceText = original;
        proofreadStale = false;
      } else {
        proofreadStale = Boolean(proofreadSourceText && proofreadSourceText !== original);
      }
      updateDiff();
      if (proofreadStale) {
        document.getElementById('previewStatus').textContent = '교정본 다시 생성 필요';
        showNotice('교정본 생성 후 입력 내용이 바뀌었습니다. 맞춤법 교정본을 다시 생성하거나 교정본을 원문으로 초기화하세요.', 'error');
      } else if (rmMode === 'long') {
        document.getElementById('previewStatus').textContent = original ? '긴 글 입력 중' : '긴 글 원문 미입력';
      } else {
        document.getElementById('previewStatus').textContent = val('student_name')
          ? selectedLevel ? '필수값 확인 중' : '레벨 미선택'
          : '학생명 미입력';
      }
      updateSubmitState();
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(saveDraft, 450);
    };

    saveDraft = function () {
      const draft = {
        mode: rmMode,
        structured: buildRecord(),
        long_text: val('long_text_input'),
        long_consultation_date: val('long_consultation_date'),
        long_chart_type: val('long_chart_type'),
        corrected: document.getElementById('correctedPreview').value,
        correctedDirty,
        proofreadSourceText,
        proofreadStale,
        selectedLevel,
        selectedTemplate,
        lastRecordId,
      };
      localStorage.setItem('rm_charting_draft', JSON.stringify(draft));
      document.getElementById('saveState').textContent = '임시저장 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    loadDraft = function () {
      const raw = localStorage.getItem('rm_charting_draft');
      if (!raw) return;
      try {
        const draft = JSON.parse(raw);
        const record = draft.structured || draft.record || {};
        document.querySelectorAll('[data-field]').forEach(element => {
          if (record[element.id] !== undefined) element.value = record[element.id] || '';
        });
        Object.keys(CHIP_OPTIONS).forEach(id => {
          const selected = String(record[id] || '').split(',').map(value => value.trim()).filter(Boolean);
          document.querySelectorAll('#' + id + ' .chip').forEach(button => {
            button.classList.toggle('on', selected.includes(button.dataset.value));
          });
        });
        document.getElementById('long_text_input').value = draft.long_text || '';
        document.getElementById('long_consultation_date').value = draft.long_consultation_date || today();
        document.getElementById('long_chart_type').value = draft.long_chart_type || '신규';
        selectedLevel = draft.selectedLevel || record.level_code || '';
        selectedTemplate = draft.selectedTemplate || record.level_template_code || '';
        if (selectedLevel) selectLevel(selectedLevel);
        if (selectedTemplate && LEVEL_TEMPLATES[selectedTemplate]) {
          document.querySelectorAll('.template').forEach(button => button.classList.toggle('on', button.dataset.code === selectedTemplate));
        }
        correctedDirty = Boolean(draft.correctedDirty);
        proofreadSourceText = draft.proofreadSourceText || '';
        proofreadStale = Boolean(draft.proofreadStale);
        lastRecordId = draft.lastRecordId || '';
        setChartingMode(draft.mode || 'long', true);
        onChange();
        if (draft.corrected) {
          document.getElementById('correctedPreview').value = draft.corrected;
          correctedDirty = true;
          proofreadStale = Boolean(proofreadSourceText && proofreadSourceText !== document.getElementById('originalPreview').value);
          updateDiff();
          updateSubmitState();
        }
      } catch (error) {
        console.warn(error);
      }
    };

    clearForm = function () {
      if (!confirm('현재 임시기록을 지우고 새 기록을 시작할까요?')) return;
      localStorage.removeItem('rm_charting_draft');
      lastRecordId = '';
      correctedDirty = false;
      proofreadSourceText = '';
      proofreadStale = false;
      submitCompleted = false;
      selectedLevel = '';
      selectedTemplate = '';
      document.querySelectorAll('[data-field],[data-long-field]').forEach(element => { element.value = ''; });
      document.querySelectorAll('.chip.on').forEach(element => element.classList.remove('on'));
      setFormLocked(false);
      document.getElementById('consultation_date').value = today();
      document.getElementById('chart_type').value = '신규';
      document.getElementById('long_consultation_date').value = today();
      document.getElementById('long_chart_type').value = '신규';
      renderLevels();
      setChartingMode('long');
      document.getElementById('retryBtn').classList.add('hidden');
      showNotice('새 기록을 시작했습니다. 긴 글 빠른입력 모드입니다.', '');
    };

    proofread = async function () {
      const original = getOriginalText();
      if (!original) {
        showNotice(rmMode === 'long' ? '긴 상담기록 원문을 먼저 입력하세요.' : '학생정보를 먼저 입력하세요.', 'error');
        return;
      }
      document.getElementById('proofreadBtn').disabled = true;
      showNotice('내용은 바꾸지 않고 맞춤법·띄어쓰기만 교정 중입니다. 학생 실제 영어 응답과 레벨지침은 보호됩니다.', '');
      try {
        const data = await api('charting_proofread', { text: original, protected_segments: getProtectedSegments() });
        document.getElementById('correctedPreview').value = data.corrected_text;
        correctedDirty = true;
        proofreadSourceText = original;
        proofreadStale = false;
        updateDiff();
        updateSubmitState();
        switchTab('corrected');
        showNotice('교정본 생성 완료. 내용을 확인한 뒤 전송하세요.', 'success');
        saveDraft();
      } catch (error) {
        showNotice('교정 실패: ' + error.message, 'error');
      } finally {
        document.getElementById('proofreadBtn').disabled = false;
      }
    };

    submitRecord = async function () {
      if (proofreadStale) {
        showNotice('현재 교정본은 이전 입력 내용 기준입니다. 교정본을 다시 생성하거나 원문으로 초기화하세요.', 'error');
        return;
      }
      if (submitCompleted) {
        showNotice('이미 전송된 기록입니다. 새 기록 버튼을 눌러 다음 학생을 작성하세요.', 'error');
        return;
      }
      const original = document.getElementById('originalPreview').value.trim();
      const finalText = (correctedDirty ? document.getElementById('correctedPreview').value : original).trim();
      if (!original || !finalText) {
        showNotice('상담기록 원문을 입력하세요.', 'error');
        return;
      }

      let action;
      let payload;
      let confirmTitle;
      if (rmMode === 'long') {
        if (!val('long_consultation_date')) {
          showNotice('상담일을 입력하세요.', 'error');
          return;
        }
        action = 'charting_submit_long';
        confirmTitle = (original.split('\n')[0] || '긴 글 상담기록').slice(0, 60);
        payload = {
          record_id: lastRecordId,
          consultation_date: val('long_consultation_date'),
          chart_type: val('long_chart_type'),
          original_text: original,
          final_text: finalText,
          proofread_status: correctedDirty ? 'PROOFREAD_REVIEWED' : 'ORIGINAL_USED',
          proofread_source_text: correctedDirty ? proofreadSourceText : original,
          form_version: LONG_FORM_VERSION,
        };
      } else {
        const record = buildRecord();
        const missing = [];
        if (!record.student_name) missing.push('학생명');
        if (!record.consultation_date) missing.push('상담일');
        if (!record.occupation_raw) missing.push('구체적 직업');
        if (!record.level_code) missing.push('공식 레벨');
        if (missing.length) {
          showNotice('필수값을 확인하세요: ' + missing.join(', '), 'error');
          return;
        }
        action = 'charting_submit';
        confirmTitle = record.student_name + ' / ' + record.level_code;
        payload = {
          record_id: lastRecordId,
          record,
          original_text: original,
          final_text: finalText,
          proofread_status: correctedDirty ? 'PROOFREAD_REVIEWED' : 'ORIGINAL_USED',
          proofread_source_text: correctedDirty ? proofreadSourceText : original,
        };
      }

      if (!confirm(confirmTitle + '\n구글시트에 분류 저장하고 잔디에 긴 글을 전송할까요?')) return;
      document.getElementById('submitBtn').disabled = true;
      showNotice(rmMode === 'long' ? 'AI가 긴 글을 분류해 시트 저장 후 잔디로 전송 중입니다...' : '시트 저장 및 잔디 전송 중...', '');
      try {
        const data = await api(action, payload);
        lastRecordId = data.record_id;
        if (data.jandi_sent) {
          const classification = data.extraction_status && data.extraction_status !== 'NOT_APPLICABLE'
            ? ' · AI분류 ' + data.extraction_status
            : '';
          showNotice('완료: 시트 저장 + 잔디 전송 성공' + classification + ' (' + data.record_id + ')', 'success');
          localStorage.removeItem('rm_charting_draft');
          document.getElementById('retryBtn').classList.add('hidden');
          submitCompleted = true;
          setFormLocked(true);
          updateSubmitState();
        } else {
          showNotice('시트 저장은 완료됐지만 잔디 전송은 실패했습니다: ' + data.jandi_error, 'error');
          document.getElementById('retryBtn').classList.remove('hidden');
          saveDraft();
        }
      } catch (error) {
        showNotice('저장 실패: ' + error.message, 'error');
      } finally {
        if (submitCompleted) updateSubmitState();
        else document.getElementById('submitBtn').disabled = false;
      }
    };

    init = function () {
      renderChips();
      renderLevels();
      document.querySelectorAll('[data-field],[data-long-field]').forEach(element => element.addEventListener('input', onChange));
      document.querySelectorAll('.mode-btn').forEach(button => button.onclick = () => setChartingMode(button.dataset.mode));
      document.querySelectorAll('.tab').forEach(button => button.onclick = () => switchTab(button.dataset.tab));
      document.getElementById('correctedPreview').addEventListener('input', () => {
        correctedDirty = true;
        proofreadSourceText = document.getElementById('originalPreview').value;
        proofreadStale = false;
        updateDiff();
        updateSubmitState();
        saveDraft();
      });
      document.getElementById('proofreadBtn').onclick = proofread;
      document.getElementById('resetProofreadBtn').onclick = () => {
        document.getElementById('correctedPreview').value = document.getElementById('originalPreview').value;
        correctedDirty = false;
        proofreadSourceText = document.getElementById('originalPreview').value;
        proofreadStale = false;
        updateDiff();
        updateSubmitState();
        switchTab('original');
        showNotice('교정본을 작성 원문으로 되돌렸습니다.', '');
      };
      document.getElementById('submitBtn').onclick = submitRecord;
      document.getElementById('retryBtn').onclick = retryJandi;
      document.getElementById('clearBtn').onclick = clearForm;
      document.getElementById('logoutBtn').onclick = () => {
        sessionStorage.removeItem('rm_charting_password');
        localStorage.removeItem('rm_charting_password');
        location.reload();
      };
      document.getElementById('loginBtn').onclick = login;
      document.getElementById('loginPassword').addEventListener('keydown', event => { if (event.key === 'Enter') login(); });
      document.getElementById('consultation_date').value = today();
      document.getElementById('chart_type').value = '신규';
      document.getElementById('long_consultation_date').value = today();
      document.getElementById('long_chart_type').value = '신규';
      setChartingMode('long', true);
      loadDraft();
      onChange();
      localStorage.removeItem('rm_charting_password');
      const saved = sessionStorage.getItem('rm_charting_password');
      if (saved) {
        document.getElementById('loginPassword').value = saved;
        setTimeout(login, 50);
      }
    };

    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectLongModeUi();
      loadLegacyApp();
    });
  } else {
    injectLongModeUi();
    loadLegacyApp();
  }
})();
