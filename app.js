/* ==========================================================================
   [BOM] index(v3.2) / core.js(v1.0) / sheet.js(v1.0) / api.js(v1.0) / app.js(v1.1) / core.css(v1.0) / style.css(v1.1)
   - app.js: 10개 전체 창 일괄 열기/닫기 마스터 토글 함수(toggleAllSections) 및 #btn-toggle-all 연동 (v1.0 -> v1.1)
   ========================================================================== */

const STORAGE_KEY = "WRITER_STUDIO_DATA_V10";

let isDirty = false;
let currentPostId = null;
let currentPostStatus = "작성";
let currentFocusedKey = null;
let pendingModalAction = null;

const SECTION_CONFIGS = [
  { key: 'outline',   id: 'essayOutline',   title: '글의 구성',      minH: 70,  stat: false, readTime: false, bullet: true },
  { key: 'completed', id: 'completedText',  title: '완성 글',        minH: 120, stat: true,  readTime: true,  bullet: false },
  { key: 'newDraft',  id: 'newDraftText',   title: '신규 글',        minH: 80,  stat: true,  readTime: true,  bullet: false },
  { key: 'intent',    id: 'draftIntent',    title: '글의 의도',      minH: 50,  stat: true,  readTime: false, bullet: false },
  { key: 'promptReq', id: 'promptReqText',  title: '요청 내용 (to AI)', minH: 50, stat: true,  readTime: false, bullet: false },
  { key: 'aiRefined', id: 'aiRefinedText',  title: 'AI 수정 글',     minH: 90,  stat: true,  readTime: true,  bullet: false, isAi: true },
  { key: 'snippets',  id: 'savedSnippets',  title: '보관 글',        minH: 60,  stat: true,  readTime: false, bullet: true }
];

const ALL_SECTION_KEYS = ['postList', 'meta', 'outline', 'completed', 'newDraft', 'intent', 'api', 'promptReq', 'aiRefined', 'snippets'];
const fieldMap = {};
const fieldState = {};
SECTION_CONFIGS.forEach(function(c) { fieldMap[c.key] = c.id; });

// 1. 집필 섹션 동적 DOM 생성
function buildEditorSections() {
  const container = $('editor-container');
  const apiBox = $('sec_api');
  if (!container) return;
  container.innerHTML = '';

  SECTION_CONFIGS.forEach(function(cfg) {
    const sec = document.createElement('div');
    sec.id = 'sec_' + cfg.key;
    sec.className = 'editor-section';

    const hdr = document.createElement('div');
    hdr.id = 'hdr_' + cfg.key;
    hdr.className = 'section-header-line';

    let extraAiButtons = '';
    if (cfg.isAi) {
      extraAiButtons = '<button type="button" class="btn-ai-req" onclick="requestAiRefine()">✨ AI 수정 요청</button>' +
        '<button type="button" class="btn-append-header" onclick="appendDraftToCompleted()">본문에 추가</button>';
    }

    hdr.innerHTML = '<div class="section-header-left">' +
      '<button type="button" id="arrow_' + cfg.key + '" class="btn-section-toggle" onclick="toggleSection(\'' + cfg.key + '\')" title="열림/숨김">−</button>' +
      '<span class="section-title" id="title_' + cfg.key + '" onclick="toggleFocusView(\'' + cfg.key + '\')" title="클릭 시 단독 집중 모드">' + cfg.title + '</span>' +
      '<span id="badge_' + cfg.key + '" class="badge-collapsed">숨김</span>' +
      '</div>' +
      '<div style="display:flex; align-items:center; gap:4px;">' +
      '<button type="button" id="copyBtn_' + cfg.key + '" class="btn-copy" onclick="copyContent(\'' + cfg.id + '\', this)">📋 복사</button>' +
      extraAiButtons +
      '</div>';

    const body = document.createElement('div');
    body.id = 'body_' + cfg.key;
    body.className = 'editor-content-wrap';

    const bgStyle = cfg.isAi ? 'background-color: #f8fafc;' : '';
    const bulletAttr = cfg.bullet ? 'onkeydown="handleBulletEnter(event, this)"' : '';
    const statHtml = cfg.stat ? '<span class="stat-info" id="stat_' + cfg.key + '">0자</span>' : '<span></span>';

    body.innerHTML = '<textarea id="' + cfg.id + '" class="flat-textarea" style="min-height:' + cfg.minH + 'px; ' + bgStyle + '" ' + bulletAttr + ' oninput="handleFieldInput(\'' + cfg.key + '\')"></textarea>' +
      '<div class="editor-bottom-toolbar">' +
      statHtml +
      '<div class="restore-group">' +
      '<button type="button" class="btn-restore-icon" onclick="undoField(\'' + cfg.key + '\')">↺ 취소</button>' +
      '<button type="button" class="btn-restore-icon" onclick="restoreSaved(\'' + cfg.key + '\')">⟲ 최근 저장 상태로</button>' +
      '</div>' +
      '</div>';

    sec.appendChild(hdr);
    sec.appendChild(body);
    container.appendChild(sec);

    if (cfg.key === 'intent' && apiBox) {
      container.appendChild(apiBox);
    }
  });
}

function toggleSection(key) {
  executeToggleSection(key);
}

// 전체 창 마스터 토글 (하나라도 열려있으면 모두 닫고, 모두 닫혀있으면 모두 열기)
function toggleAllSections() {
  if (document.body.classList.contains('mode-focus')) {
    if (currentFocusedKey) toggleFocusView(currentFocusedKey);
  }

  const anyOpen = ALL_SECTION_KEYS.some(function(k) {
    const el = $('body_' + k);
    return el && el.style.display !== 'none';
  });

  ALL_SECTION_KEYS.forEach(function(k) {
    const el = $('body_' + k);
    if (!el) return;
    const isCurrentlyClosed = el.style.display === 'none';
    if (anyOpen && !isCurrentlyClosed) {
      executeToggleSection(k); // 열린 것을 닫음
    } else if (!anyOpen && isCurrentlyClosed) {
      executeToggleSection(k); // 닫힌 것을 엶
    }
  });

  if (!anyOpen) {
    resizeAllTextareas();
  }
}

function toggleFocusView(key, manageHistory = true) {
  currentFocusedKey = executeToggleFocusView(
    key, ALL_SECTION_KEYS, SECTION_CONFIGS, currentFocusedKey, manageHistory,
    function() { resizeAllTextareas(); },
    null
  );
}

window.addEventListener('popstate', function() {
  if (currentFocusedKey) toggleFocusView(currentFocusedKey, false);
});

function markDirty() { isDirty = true; }

function resizeAllTextareas() {
  if (document.body.classList.contains('mode-focus')) return;
  SECTION_CONFIGS.forEach(function(cfg) {
    const el = $(cfg.id);
    if (el) autoResizeTextarea(el, cfg.minH);
  });
}

// 2. Undo/Redo & 글자 수 통계
function initFieldStates() {
  SECTION_CONFIGS.forEach(function(cfg) {
    const el = $(cfg.id);
    const val = el ? el.value : '';
    fieldState[cfg.key] = { currentSaved: val, history: [val] };
  });
}

function handleFieldInput(key) {
  markDirty();
  const cfg = SECTION_CONFIGS.find(function(c) { return c.key === key; });
  const el = $(cfg.id);
  if (!el) return;
  const val = el.value;
  const stack = fieldState[key].history;
  if (stack[stack.length - 1] !== val) {
    stack.push(val);
    if (stack.length > 50) stack.shift();
  }
  autoResizeTextarea(el, cfg.minH);
  updateStat(key, val);
}

function undoField(key) {
  const cfg = SECTION_CONFIGS.find(function(c) { return c.key === key; });
  const el = $(cfg.id);
  if (!el || !fieldState[key]) return;
  const stack = fieldState[key].history;
  if (stack.length > 1) {
    stack.pop();
    el.value = stack[stack.length - 1];
    autoResizeTextarea(el, cfg.minH);
    updateStat(key, el.value);
    markDirty();
  } else {
    alert('되돌릴 이전 입력 내용이 없습니다.');
  }
}

function restoreSaved(key) {
  const cfg = SECTION_CONFIGS.find(function(c) { return c.key === key; });
  const el = $(cfg.id);
  if (!el || !fieldState[key]) return;
  const targetVal = fieldState[key].currentSaved;
  if (el.value === targetVal) return alert('이미 최근 저장된 상태와 동일합니다.');
  fieldState[key].history.push(targetVal);
  el.value = targetVal;
  autoResizeTextarea(el, cfg.minH);
  updateStat(key, targetVal);
  markDirty();
}

function updateStat(key, text) {
  const cfg = SECTION_CONFIGS.find(function(c) { return c.key === key; });
  if (!cfg || !cfg.stat) return;
  const statEl = $('stat_' + key);
  if (!statEl) return;
  const len = text.length;
  if (cfg.readTime) {
    const readingTime = Math.ceil(len / 400);
    statEl.innerText = len.toLocaleString() + '자 (약 ' + readingTime + '분)';
  } else {
    statEl.innerText = len.toLocaleString() + '자';
  }
}

function updateAllStats() {
  SECTION_CONFIGS.forEach(function(cfg) {
    const el = $(cfg.id);
    if (el) updateStat(cfg.key, el.value);
  });
}

function appendDraftToCompleted() {
  const textToAppend = $('aiRefinedText').value.trim() || $('newDraftText').value.trim();
  if (!textToAppend) return alert('이어 붙일 내용이 없습니다.');
  const completedEl = $('completedText');
  completedEl.value = completedEl.value.trim() ? completedEl.value.trim() + "\n\n" + textToAppend : textToAppend;
  handleFieldInput('completed');
  ['newDraft', 'intent', 'promptReq', 'aiRefined'].forEach(function(k) {
    const el = $(fieldMap[k]);
    if (el) {
      el.value = '';
      handleFieldInput(k);
    }
  });
}

// 3. 작업 선택 및 저장 루틴
function selectPost(post) {
  currentPostId = post.ID || post.id || '';
  currentPostStatus = (post.상황 || post.status || '작성').trim();
  $('essayTitleInput').value = post.제목 || post.title || '';
  $('postStartDate').value = post.작성시작일 || post['작성 시작일'] || post.startDate || '';
  $('postEndDate').value = post.작성완료일 || post['작성 완료일'] || post.endDate || '';
  $('postSummary').value = post.요약 || post.summary || '';
  $('essayOutline').value  = post.글의구성 || post['글의 구성'] || post['글의\n구성'] || post.outline || '';
  $('completedText').value = post.완성글 || post['완성 글'] || post['완성\n글'] || post.completed || '';
  $('newDraftText').value  = post.신규글 || post['신규 글'] || post['신규\n글'] || post.newDraft || '';
  $('draftIntent').value   = post.글의의도 || post['글의 의도'] || post['글의\n의도'] || post.intent || '';
  $('promptReqText').value = post.요청내용 || post['요청 내용'] || post['요청\n내용'] || post.promptReq || '';
  $('aiRefinedText').value = post.AI수정글 || post['AI 수정 글'] || post['AI수정 글'] || post.aiRefined || '';
  $('savedSnippets').value = post.보관글 || post['보관 글'] || post['보관\n글'] || post.snippets || '';

  initFieldStates();
  updateAllStats();
  resizeAllTextareas();
  renderPostList();
  isDirty = false;
}

function handleFilterChange() {
  currentPostId = null;
  SECTION_CONFIGS.forEach(function(cfg) {
    const el = $(cfg.id);
    if (el) {
      el.value = '';
      fieldState[cfg.key] = { currentSaved: '', history: [''] };
      autoResizeTextarea(el, cfg.minH);
    }
  });
  updateAllStats();
  renderPostList();
}

function saveWork(mode) {
  const titleVal = $('essayTitleInput').value.trim();
  if (!titleVal) return alert('제목을 입력해주세요.');

  if (!currentPostId) currentPostId = "ID_" + new Date().getTime();
  const catFilterEl = $('categoryFilter');
  const currentCategory = (catFilterEl && catFilterEl.value !== '전체') ? catFilterEl.value : '';

  const payload = {
    ID: currentPostId,
    id: currentPostId,
    status: currentPostStatus || "작성",
    category: currentCategory,
    title: titleVal,
    startDate: $('postStartDate').value.trim(),
    endDate: $('postEndDate').value.trim(),
    summary: $('postSummary').value.trim(),
    outline: $('essayOutline').value,
    completed: $('completedText').value,
    newDraft: $('newDraftText').value,
    intent: $('draftIntent').value,
    promptReq: $('promptReqText').value,
    aiRefined: $('aiRefinedText').value,
    snippets: $('savedSnippets').value,
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  SECTION_CONFIGS.forEach(function(cfg) {
    const el = $(cfg.id);
    if (el && fieldState[cfg.key]) fieldState[cfg.key].currentSaved = el.value;
  });
  isDirty = false;

  syncPostToSheet(payload);

  if (mode === 'stay') alert('구글 시트 및 로컬에 안전하게 저장되었습니다.');
  else if (mode === 'exit') window.close();
}

function loadSavedData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.ID || data.id) currentPostId = data.ID || data.id;
    if (data.status) currentPostStatus = data.status;
    if (data.title) $('essayTitleInput').value = data.title;
    if (data.startDate) $('postStartDate').value = data.startDate;
    if (data.endDate) $('postEndDate').value = data.endDate;
    if (data.summary) $('postSummary').value = data.summary;
    SECTION_CONFIGS.forEach(function(cfg) {
      if (data[cfg.key]) $(cfg.id).value = data[cfg.key];
    });
    initFieldStates();
    resizeAllTextareas();
  } catch(e) {
    console.error("[app.js] 데이터 로드 실패:", e);
  }
}

function cancelWork() {
  if (isDirty) {
    showUnsavedModal(
      function() { saveWork('stay'); },
      function() { loadSavedData(); isDirty = false; }
    );
  } else {
    alert('변경된 내용이 없습니다.');
  }
}

function cancelAndClose() {
  if (isDirty) {
    showUnsavedModal(
      function() { saveWork('exit'); },
      function() { window.close(); }
    );
  } else {
    window.close();
  }
}

// 4. 저장 확인 모달
function showUnsavedModal(onSaveAndExit, onDiscardAndExit) {
  const modal = $('unsaved-modal');
  if (!modal) {
    if (confirm('저장되지 않은 변경사항이 있습니다. 저장하고 진행하시겠습니까?')) {
      if (onSaveAndExit) onSaveAndExit();
    } else {
      if (onDiscardAndExit) onDiscardAndExit();
    }
    return;
  }
  pendingModalAction = { save: onSaveAndExit, discard: onDiscardAndExit };
  modal.classList.remove('hidden');
}

function hideUnsavedModal() {
  const modal = $('unsaved-modal');
  if (modal) modal.classList.add('hidden');
  pendingModalAction = null;
}

function initModalHandlers() {
  const btnCancel = $('modal-btn-cancel');
  const btnDiscard = $('modal-btn-discard');
  const btnSave = $('modal-btn-save');
  if (btnCancel) btnCancel.onclick = hideUnsavedModal;
  if (btnDiscard) {
    btnDiscard.onclick = function() {
      const act = pendingModalAction;
      hideUnsavedModal();
      if (act && act.discard) act.discard();
    };
  }
  if (btnSave) {
    btnSave.onclick = function() {
      const act = pendingModalAction;
      hideUnsavedModal();
      if (act && act.save) act.save();
    };
  }
}

// 5. 초기 이벤트 연결
window.addEventListener('DOMContentLoaded', function() {
  buildEditorSections();
  initFieldStates();
  loadSavedData();
  checkApiKeyStatus();
  updateAllStats();
  loadCachedPosts();
  fetchSheetPosts();
  initModalHandlers();

  // ON/OFF 마스터 토글 버튼 이벤트 연동
  const btnToggleAll = $('btn-toggle-all');
  if (btnToggleAll) btnToggleAll.onclick = toggleAllSections;

  const btnHeaderClose = $('btn-header-close');
  if (btnHeaderClose) btnHeaderClose.onclick = cancelAndClose;
  const btnSaveStay = $('btn-save-stay');
  if (btnSaveStay) btnSaveStay.onclick = function() { saveWork('stay'); };
  const btnSaveExit = $('btn-save-exit');
  if (btnSaveExit) btnSaveExit.onclick = function() { saveWork('exit'); };
  const btnCancel = $('btn-cancel-work');
  if (btnCancel) btnCancel.onclick = cancelWork;

  const statusFilter = $('statusFilter');
  if (statusFilter) statusFilter.onchange = renderPostList;
  const catFilter = $('categoryFilter');
  if (catFilter) catFilter.onchange = handleFilterChange;

  ALL_SECTION_KEYS.forEach(function(k) {
    const dot = $('dot_' + k);
    if (dot) dot.onclick = function() { toggleSection(k); };
  });

  const arrowMeta = $('arrow_meta');
  if (arrowMeta) arrowMeta.onclick = function() { toggleSection('meta'); };
  const titleMeta = $('title_meta');
  if (titleMeta) titleMeta.onclick = function() { toggleFocusView('meta'); };

  const arrowPostList = $('arrow_postList');
  if (arrowPostList) arrowPostList.onclick = function() { toggleSection('postList'); };
  const titlePostList = $('title_postList');
  if (titlePostList) titlePostList.onclick = function() { toggleFocusView('postList'); };

  const arrowApi = $('arrow_api');
  if (arrowApi) arrowApi.onclick = function() { toggleSection('api'); };
  const titleApi = $('title_api');
  if (titleApi) titleApi.onclick = function() { toggleFocusView('api'); };

  const apiSaveBtn = $('apiSaveBtn');
  if (apiSaveBtn) apiSaveBtn.onclick = handleSaveButtonClick;
  const apiCancelBtn = $('apiCancelBtn');
  if (apiCancelBtn) apiCancelBtn.onclick = cancelKeyInput;
  const apiDelBtn = $('apiDelBtn');
  if (apiDelBtn) apiDelBtn.onclick = deleteApiKey;
  const btnApiShared = $('btn-api-shared');
  if (btnApiShared) btnApiShared.onclick = function() { selectKeyChoice('shared'); };
  const btnApiPersonal = $('btn-api-personal');
  if (btnApiPersonal) btnApiPersonal.onclick = function() { selectKeyChoice('personal'); };
  const apiKeyInput = $('apiKeyInput');
  if (apiKeyInput) apiKeyInput.oninput = checkKeyInputState;

  ['essayTitleInput', 'postStartDate', 'postEndDate', 'postSummary'].forEach(function(id) {
    const el = $(id);
    if (el) el.addEventListener('input', markDirty);
  });

  window.onclick = function(e) {
    if (!e.target.closest('.api-save-btn') && !e.target.closest('.dropdown-content')) {
      document.querySelectorAll(".dropdown-content.show").forEach(function(el) {
        el.classList.remove('show');
      });
    }
  };
});
