/* ==========================================================================
   - app.js (v2.1): 상황 기본값 4단계(구상중/대기중/작성중/완료) 지원 및 최신 BOM 동기화
   [BOM] index(v4.1) / core.js(v1.2) / sheet.js(v2.1) / api.js(v1.1) / app.js(v2.1) / core.css(v1.2) / style.css(v2.1)
   ========================================================================== */

window._V_APP = "v2.1";

const STORAGE_KEY = "WRITER_STUDIO_DATA_V10";

let isDirty = false;
let currentPostId = null;
let currentPostStatus = "작성중";
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

// 0. 실시간 7개 모듈 버전 감지 (호버 툴팁 + 클릭 팝오버)
function initBOMVersionDisplay() {
  const versionTag = document.querySelector('.version-tag');
  const popover = $('versionPopover');
  if (!versionTag) return;

  const htmlVer = versionTag.innerText.trim();
  const coreJsVer = window._V_CORE || '미적용';
  const sheetJsVer = window._V_SHEET || '미적용';
  const apiJsVer = window._V_API || '미적용';
  const appJsVer = window._V_APP || '미적용';

  const rootStyle = getComputedStyle(document.documentElement);
  const coreCssVer = (rootStyle.getPropertyValue('--v-core-css') || '').replace(/['"]/g, '').trim() || '미적용';
  const styleCssVer = (rootStyle.getPropertyValue('--v-style-css') || '').replace(/['"]/g, '').trim() || '미적용';

  const tooltipText = "[실시간 로드 BOM]\n" +
    "• HTML: " + htmlVer + "\n" +
    "• core.js: " + coreJsVer + " | sheet.js: " + sheetJsVer + "\n" +
    "• api.js: " + apiJsVer + " | app.js: " + appJsVer + "\n" +
    "• core.css: " + coreCssVer + " | style.css: " + styleCssVer;
  versionTag.title = tooltipText;

  if (popover) {
    popover.innerHTML = '<div class="version-popover-title">' +
      '<span>📦 모듈 버전 명세서 (BOM)</span>' +
      '</div>' +
      '<ul>' +
      '<li><span class="bom-name">index.html</span><span class="bom-val">' + htmlVer + '</span></li>' +
      '<li><span class="bom-name">core.js</span><span class="bom-val">' + coreJsVer + '</span></li>' +
      '<li><span class="bom-name">sheet.js</span><span class="bom-val">' + sheetJsVer + '</span></li>' +
      '<li><span class="bom-name">api.js</span><span class="bom-val">' + apiJsVer + '</span></li>' +
      '<li><span class="bom-name">app.js</span><span class="bom-val">' + appJsVer + '</span></li>' +
      '<li><span class="bom-name">core.css</span><span class="bom-val">' + coreCssVer + '</span></li>' +
      '<li><span class="bom-name">style.css</span><span class="bom-val">' + styleCssVer + '</span></li>' +
      '</ul>';

    versionTag.onclick = function(e) {
      e.stopPropagation();
      popover.classList.toggle('show');
    };
  }
}

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
      executeToggleSection(k);
    } else if (!anyOpen && isCurrentlyClosed) {
      executeToggleSection(k);
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

function selectPost(post) {
  currentPostId = post.ID || post.id || '';
  currentPostStatus = (post.상황 || post.status || '작성중').trim();

  $('essayTitleInput').value = post.제목 || post.title || '';
  $('postStartDate').value = post.작성시작일 || post['작성 시작일'] || post.startDate || '';
  $('postEndDate').value = post.작성완료일 || post['작성 완료일'] || post.endDate || '';
  $('postSummary').value = post.요약 || post.summary || '';

  const cat1Input = $('postCategory1');
  if (cat1Input) cat1Input.value = post.분류1 || post.category1 || post.분류 || post.category || '';
  const cat2Input = $('postCategory2');
  if (cat2Input) cat2Input.value = post.분류2 || post.category2 || '';

  const importantCheck = $('postImportant');
  if (importantCheck) importantCheck.checked = String(post.중요 || post.important || 'N').trim().toUpperCase() === 'Y';
  const hiddenCheck = $('postHidden');
  if (hiddenCheck) hiddenCheck.checked = String(post.숨김 || post.hidden || 'N').trim().toUpperCase() === 'Y';

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

function saveWork(mode) {
  const titleVal = $('essayTitleInput').value.trim();
  if (!titleVal) return alert('제목을 입력해주세요.');

  if (!currentPostId) currentPostId = "ID_" + new Date().getTime();

  const c1Val = $('postCategory1') ? $('postCategory1').value.trim() : '';
  const c2Val = $('postCategory2') ? $('postCategory2').value.trim() : '';
  const isImp = ($('postImportant') && $('postImportant').checked) ? 'Y' : 'N';
  const isHid = ($('postHidden') && $('postHidden').checked) ? 'Y' : 'N';

  const payload = {
    ID: currentPostId,
    id: currentPostId,
    status: currentPostStatus || "작성중",
    important: isImp,
    hidden: isHid,
    category1: c1Val,
    category2: c2Val,
    category: c1Val,
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

    if ($('postCategory1') && (data.category1 || data.category)) {
      $('postCategory1').value = data.category1 || data.category;
    }
    if ($('postCategory2') && data.category2) {
      $('postCategory2').value = data.category2;
    }
    if ($('postImportant') && data.important) {
      $('postImportant').checked = String(data.important).toUpperCase() === 'Y';
    }
    if ($('postHidden') && data.hidden) {
      $('postHidden').checked = String(data.hidden).toUpperCase() === 'Y';
    }

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

window.addEventListener('DOMContentLoaded', function() {
  buildEditorSections();
  initFieldStates();
  loadSavedData();
  checkApiKeyStatus();
  updateAllStats();
  loadCachedPosts();
  fetchSheetPosts();
  initModalHandlers();
  initBOMVersionDisplay();

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

  const cat1Filter = $('category1Filter');
  if (cat1Filter) {
    cat1Filter.onchange = function() {
      if (typeof updateCategory2Options === 'function') updateCategory2Options('전체');
      renderPostList();
    };
  }

  const cat2Filter = $('category2Filter');
  if (cat2Filter) cat2Filter.onchange = renderPostList;

  const btnFilterImportant = $('btnFilterImportant');
  if (btnFilterImportant) {
    btnFilterImportant.onclick = function() {
      filterOnlyImportant = !filterOnlyImportant;
      btnFilterImportant.classList.toggle('active-star', filterOnlyImportant);
      renderPostList();
    };
  }

  const btnFilterHidden = $('btnFilterHidden');
  if (btnFilterHidden) {
    btnFilterHidden.onclick = function() {
      filterIncludeHidden = !filterIncludeHidden;
      btnFilterHidden.classList.toggle('active-hidden', filterIncludeHidden);
      renderPostList();
    };
  }

  ['essayTitleInput', 'postCategory1', 'postCategory2', 'postStartDate', 'postEndDate', 'postSummary'].forEach(function(id) {
    const el = $(id);
    if (el) el.oninput = markDirty;
  });
  ['postImportant', 'postHidden'].forEach(function(id) {
    const el = $(id);
    if (el) el.onchange = markDirty;
  });

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

  window.addEventListener('click', function(e) {
    if (!e.target.closest('.api-save-btn') && !e.target.closest('.dropdown-content')) {
      document.querySelectorAll(".dropdown-content.show").forEach(function(el) {
        el.classList.remove('show');
      });
    }
    if (!e.target.closest('.version-tag') && !e.target.closest('.version-popover')) {
      const pop = $('versionPopover');
      if (pop && pop.classList.contains('show')) {
        pop.classList.remove('show');
      }
    }
  });
});
