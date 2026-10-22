/* ==========================================================================
- app.js (v3.6): 메타 창 분류1 변경 시 분류2 동적 종속 필터링 연동 및 최신 BOM 동기화
[BOM] index(v5.3) / core.js(v1.2) / sheet.js(v3.3) / api.js(v1.1) / app.js(v3.6) / core.css(v1.2) / style.css(v3.6)
========================================================================== */

window._V_APP = "v3.6";

const STORAGE_KEY = "WRITER_STUDIO_DATA_V10";
let isDirty = false;
let currentPostId = null;
let currentPostOrder = "";
let currentPostStatus = "구상중";
let currentPostImportant = "N";
let currentPostHidden = "N";
let isNewPostMode = false;
let previousPostBackup = null;

let currentFocusedKey = null;

// 작성 글 정보 창 전용 취소/복원 히스토리 스택
let metaHistory = [];
let metaSavedSnapshot = null;

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
SECTION_CONFIGS.forEach(function(c) {
  fieldMap[c.key] = c.id;
});

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

// 0-1. Mac 스타일 범용 커스텀 모달 엔진 (규칙 10 표준 준수)
function showMacAlert(title, message, callback) {
  const modal = $('unsaved-modal');
  if (!modal) return;

  $('modalTitle').innerText = title || "⚠️ 알림";
  $('modalDesc').innerText = message || "";

  const actions = $('modalActions');
  actions.innerHTML = '<button type="button" id="mac-modal-ok" class="btn btn-primary">확인</button>';

  modal.classList.remove('hidden');

  $('mac-modal-ok').onclick = function() {
    modal.classList.add('hidden');
    if (callback) callback();
  };
}

function showMacConfirm(title, message, onConfirm, onCancel, confirmText, isDanger) {
  const modal = $('unsaved-modal');
  if (!modal) return;

  $('modalTitle').innerText = title || "⚠️ 확인";
  $('modalDesc').innerText = message || "진행하시겠습니까?";

  const confirmBtnClass = isDanger ? "btn btn-danger" : "btn btn-primary";
  const btnLabel = confirmText || "확인";

  const actions = $('modalActions');
  actions.innerHTML = '<button type="button" id="mac-modal-cancel" class="btn btn-default">취소</button>' +
                      '<button type="button" id="mac-modal-confirm" class="' + confirmBtnClass + '">' + btnLabel + '</button>';

  modal.classList.remove('hidden');

  $('mac-modal-cancel').onclick = function() {
    modal.classList.add('hidden');
    if (onCancel) onCancel();
  };

  $('mac-modal-confirm').onclick = function() {
    modal.classList.add('hidden');
    if (onConfirm) onConfirm();
  };
}

function showUnsavedModal(onSaveAndExit, onDiscardAndExit) {
  const modal = $('unsaved-modal');
  if (!modal) return;

  $('modalTitle').innerText = "⚠️ 저장 확인";
  $('modalDesc').innerText = "저장되지 않은 변경사항이 있습니다. 어떻게 처리할까요?";

  const actions = $('modalActions');
  actions.innerHTML = '<button type="button" id="modal-btn-cancel" class="btn btn-default">계속 편집</button>' +
                      '<button type="button" id="modal-btn-discard" class="btn btn-danger">저장 안 함</button>' +
                      '<button type="button" id="modal-btn-save" class="btn btn-primary">저장하고 진행</button>';

  modal.classList.remove('hidden');

  $('modal-btn-cancel').onclick = function() {
    modal.classList.add('hidden');
  };

  $('modal-btn-discard').onclick = function() {
    modal.classList.add('hidden');
    if (onDiscardAndExit) onDiscardAndExit();
  };

  $('modal-btn-save').onclick = function() {
    modal.classList.add('hidden');
    if (onSaveAndExit) onSaveAndExit();
  };
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
      '<button type="button" id="btn-undo-' + cfg.key + '" class="btn-restore-icon" onclick="undoField(\'' + cfg.key + '\')" disabled>↺ 취소</button>' +
      '<button type="button" id="btn-restore-' + cfg.key + '" class="btn-restore-icon" onclick="restoreSaved(\'' + cfg.key + '\')" disabled>⟲ 최근 저장 상태로</button>' +
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
    key,
    ALL_SECTION_KEYS,
    SECTION_CONFIGS,
    currentFocusedKey,
    manageHistory,
    function() { resizeAllTextareas(); },
    null
  );
}

window.addEventListener('popstate', function() {
  if (currentFocusedKey) toggleFocusView(currentFocusedKey, false);
});

function markDirty() {
  isDirty = true;
}

function resizeAllTextareas() {
  if (document.body.classList.contains('mode-focus')) return;
  SECTION_CONFIGS.forEach(function(cfg) {
    const el = $(cfg.id);
    if (el) autoResizeTextarea(el, cfg.minH);
  });
}

function updateFieldToolbarButtons(key) {
  const undoBtn = $('btn-undo-' + key);
  const restoreBtn = $('btn-restore-' + key);
  if (!undoBtn || !restoreBtn || !fieldState[key]) return;

  const cfg = SECTION_CONFIGS.find(function(c) { return c.key === key; });
  const el = $(cfg.id);
  const currentVal = el ? el.value : '';

  const canUndo = fieldState[key].history.length > 1;
  const canRestore = currentVal !== fieldState[key].currentSaved;

  undoBtn.disabled = !canUndo;
  restoreBtn.disabled = !canRestore;
}

function updateAllFieldToolbarButtons() {
  SECTION_CONFIGS.forEach(function(cfg) {
    updateFieldToolbarButtons(cfg.key);
  });
}

function initFieldStates() {
  SECTION_CONFIGS.forEach(function(cfg) {
    const el = $(cfg.id);
    const val = el ? el.value : '';
    fieldState[cfg.key] = {
      currentSaved: val,
      history: [val]
    };
  });
  updateAllFieldToolbarButtons();
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
  updateFieldToolbarButtons(key);
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
    updateFieldToolbarButtons(key);
  } else {
    showMacAlert('안내', '되돌릴 이전 입력 내용이 없습니다.');
  }
}

function restoreSaved(key) {
  const cfg = SECTION_CONFIGS.find(function(c) { return c.key === key; });
  const el = $(cfg.id);
  if (!el || !fieldState[key]) return;

  const targetVal = fieldState[key].currentSaved;
  if (el.value === targetVal) {
    return showMacAlert('안내', '이미 최근 저장된 상태와 동일합니다.');
  }

  fieldState[key].history.push(targetVal);
  el.value = targetVal;
  autoResizeTextarea(el, cfg.minH);
  updateStat(key, targetVal);
  markDirty();
  updateFieldToolbarButtons(key);
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
  if (!textToAppend) return showMacAlert('안내', '이어 붙일 내용이 없습니다.');

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

// 2. '경과' 일수 자동 계산 헬퍼
function parseCustomDate(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[^0-9]/g, '');
  if (cleaned.length === 8) {
    const y = parseInt(cleaned.substring(0, 4), 10);
    const m = parseInt(cleaned.substring(4, 6), 10) - 1;
    const d = parseInt(cleaned.substring(6, 8), 10);
    const dateObj = new Date(y, m, d);
    if (!isNaN(dateObj.getTime())) return dateObj;
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function updateElapsedDays() {
  const elapsedEl = $('postElapsedDays');
  if (!elapsedEl) return;

  const sVal = $('postStartDate') ? $('postStartDate').value.trim() : '';
  const eVal = $('postEndDate') ? $('postEndDate').value.trim() : '';
  const status = $('postStatusSelect') ? $('postStatusSelect').value.trim() : '구상중';

  const sDate = parseCustomDate(sVal);
  if (!sDate) {
    elapsedEl.value = '-';
    return;
  }

  let targetDate;
  if (status === '완료') {
    const eDate = parseCustomDate(eVal);
    targetDate = eDate || new Date();
  } else {
    targetDate = new Date();
  }

  // 자정 기준 날짜 차이 계산
  const dStart = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
  const dTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const diffMs = dTarget - dStart;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  elapsedEl.value = diffDays + '일';
}

// 2-1. '작성 글 정보' 창의 분류1 및 분류2 드롭다운 옵션 동적 구성 (분류1 종속 필터링 연동)
function updateMetaCategory2Options(preferredVal) {
  const c1Select = $('postCategory1Select');
  const c2Select = $('postCategory2Select');
  if (!c2Select) return;

  const selectedC1 = c1Select ? c1Select.value : '미분류';
  const targetVal = preferredVal || c2Select.value || '미분류';
  const c2Set = new Set();

  if (Array.isArray(postListCache)) {
    postListCache.forEach(function(item) {
      const c1 = (item.분류1 || item.category1 || item.분류 || item.category || '').trim();
      const c2 = (item.분류2 || item.category2 || '').trim();
      if (!c2 || c2 === '미분류') return;

      if (!selectedC1 || selectedC1 === '미분류' || c1 === selectedC1) {
        c2Set.add(c2);
      }
    });
  }

  c2Select.innerHTML = '<option value="미분류">미분류</option>';
  Array.from(c2Set).sort().forEach(function(val) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.innerText = val;
    c2Select.appendChild(opt);
  });

  if (targetVal && targetVal !== '미분류' && !c2Set.has(targetVal)) {
    const opt = document.createElement('option');
    opt.value = targetVal;
    opt.innerText = targetVal;
    c2Select.appendChild(opt);
  }

  c2Select.value = targetVal;
}

function populateMetaCategoryDropdowns(selectedCat1, selectedCat2) {
  const c1Select = $('postCategory1Select');
  if (!c1Select) return;

  const curC1 = selectedCat1 || c1Select.value || '미분류';
  const curC2 = selectedCat2 || ($('postCategory2Select') ? $('postCategory2Select').value : '미분류');

  const c1Set = new Set();
  if (Array.isArray(postListCache)) {
    postListCache.forEach(function(item) {
      const c1 = (item.분류1 || item.category1 || item.분류 || item.category || '').trim();
      if (c1 && c1 !== '미분류') c1Set.add(c1);
    });
  }

  // 분류1 옵션 구축
  c1Select.innerHTML = '<option value="미분류">미분류</option>';
  Array.from(c1Set).sort().forEach(function(val) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.innerText = val;
    c1Select.appendChild(opt);
  });

  if (curC1 && curC1 !== '미분류' && !c1Set.has(curC1)) {
    const opt = document.createElement('option');
    opt.value = curC1;
    opt.innerText = curC1;
    c1Select.appendChild(opt);
  }
  c1Select.value = curC1;

  // 분류1에 종속된 분류2 옵션 구축
  updateMetaCategory2Options(curC2);
}

// 2-2. '작성 글 정보' 창 전용 히스토리 및 UI 동기화
function getMetaSnapshot() {
  return JSON.stringify({
    title: $('essayTitleInput') ? $('essayTitleInput').value : '',
    status: $('postStatusSelect') ? $('postStatusSelect').value : '구상중',
    cat1: $('postCategory1Select') ? $('postCategory1Select').value : '미분류',
    cat2: $('postCategory2Select') ? $('postCategory2Select').value : '미분류',
    startDate: $('postStartDate') ? $('postStartDate').value : '',
    endDate: $('postEndDate') ? $('postEndDate').value : '',
    summary: $('postSummary') ? $('postSummary').value : '',
    important: currentPostImportant,
    hidden: currentPostHidden
  });
}

function applyMetaSnapshot(snapStr) {
  try {
    const data = JSON.parse(snapStr);
    if ($('essayTitleInput')) $('essayTitleInput').value = data.title;
    if ($('postStatusSelect')) $('postStatusSelect').value = data.status;
    populateMetaCategoryDropdowns(data.cat1, data.cat2);
    if ($('postStartDate')) $('postStartDate').value = data.startDate;
    if ($('postEndDate')) $('postEndDate').value = data.endDate;
    if ($('postSummary')) $('postSummary').value = data.summary;
    currentPostStatus = data.status;
    currentPostImportant = data.important;
    currentPostHidden = data.hidden;
    updateMetaIcons();
    updateElapsedDays();
  } catch (e) {
    console.error("[app.js] 메타 스냅샷 복원 실패:", e);
  }
}

function initMetaHistory() {
  const snap = getMetaSnapshot();
  metaSavedSnapshot = snap;
  metaHistory = [snap];
  updateMetaToolbarButtons();
}

function pushMetaHistory() {
  markDirty();
  updateElapsedDays();
  const snap = getMetaSnapshot();
  if (metaHistory[metaHistory.length - 1] !== snap) {
    metaHistory.push(snap);
    if (metaHistory.length > 50) metaHistory.shift();
  }
  updateMetaToolbarButtons();
}

function updateMetaToolbarButtons() {
  const undoBtn = $('btn-undo-meta');
  const restoreBtn = $('btn-restore-meta');
  if (!undoBtn || !restoreBtn) return;

  const canUndo = metaHistory.length > 1;
  const currentSnap = getMetaSnapshot();
  const canRestore = metaSavedSnapshot && (currentSnap !== metaSavedSnapshot);

  undoBtn.disabled = !canUndo;
  restoreBtn.disabled = !canRestore;
}

function undoMeta() {
  if (metaHistory.length > 1) {
    metaHistory.pop();
    const prevSnap = metaHistory[metaHistory.length - 1];
    applyMetaSnapshot(prevSnap);
    markDirty();
    updateMetaToolbarButtons();
  } else {
    if (isNewPostMode && previousPostBackup) {
      selectPost(previousPostBackup);
    } else {
      showMacAlert('안내', '되돌릴 이전 정보 입력 내역이 없습니다.');
    }
  }
}

function restoreSavedMeta() {
  if (!metaSavedSnapshot) return;
  const currentSnap = getMetaSnapshot();
  if (currentSnap === metaSavedSnapshot) {
    return showMacAlert('안내', '이미 최근 저장된 상태와 동일합니다.');
  }

  metaHistory.push(metaSavedSnapshot);
  applyMetaSnapshot(metaSavedSnapshot);
  markDirty();
  updateMetaToolbarButtons();
}

function updateMetaIcons() {
  const starBtn = $('btnMetaStar');
  const hiddenBtn = $('btnMetaHidden');

  if (starBtn) {
    const isImp = currentPostImportant === 'Y';
    starBtn.innerText = isImp ? '⭐' : '☆';
    starBtn.className = 'btn-filter-icon' + (isImp ? ' active-star is-important' : '');
  }

  if (hiddenBtn) {
    const isHid = currentPostHidden === 'Y';
    hiddenBtn.innerText = isHid ? '🕶️' : '👓';
    hiddenBtn.className = 'btn-filter-icon' + (isHid ? ' active-hidden is-hidden' : '');
  }
}

function toggleMetaImportant() {
  currentPostImportant = currentPostImportant === 'Y' ? 'N' : 'Y';
  updateMetaIcons();
  pushMetaHistory();
}

function toggleMetaHidden() {
  currentPostHidden = currentPostHidden === 'Y' ? 'N' : 'Y';
  updateMetaIcons();
  pushMetaHistory();
}

// 3. '적용' 버튼: 작성 글 정보 내용을 목록 및 구글 시트에 즉시 반영
function applyMetaChanges() {
  const titleVal = $('essayTitleInput').value.trim();
  if (!titleVal) return showMacAlert('확인 필요', '글 제목을 입력해주세요.');

  const statusVal = $('postStatusSelect').value;
  const c1Val = $('postCategory1Select') ? $('postCategory1Select').value : '미분류';
  const c2Val = $('postCategory2Select') ? $('postCategory2Select').value : '미분류';
  const sDate = $('postStartDate').value.trim();
  const eDate = $('postEndDate').value.trim();
  const summaryVal = $('postSummary').value.trim();

  // 신규 글 작성 모드일 경우: ID 생성 및 목록 맨 상단 슬롯에 삽입
  if (isNewPostMode || !currentPostId) {
    currentPostId = "ID_" + new Date().getTime();
    currentPostOrder = 1;

    postListCache.forEach(function(p) {
      if (p.순서 !== undefined && p.순서 !== "") {
        p.순서 = Number(p.순서) + 1;
      }
    });

    const newPostObj = {
      ID: currentPostId,
      id: currentPostId,
      순서: 1,
      상황: statusVal,
      status: statusVal,
      중요: currentPostImportant,
      important: currentPostImportant,
      숨김: currentPostHidden,
      hidden: currentPostHidden,
      분류1: c1Val,
      category1: c1Val,
      분류2: c2Val,
      category2: c2Val,
      제목: titleVal,
      title: titleVal,
      작성시작일: sDate,
      startDate: sDate,
      작성완료일: eDate,
      endDate: eDate,
      요약: summaryVal,
      summary: summaryVal,
      글의구성: $('essayOutline').value,
      완성글: $('completedText').value,
      신규글: $('newDraftText').value,
      글의의도: $('draftIntent').value,
      요청내용: $('promptReqText').value,
      AI수정글: $('aiRefinedText').value,
      보관글: $('savedSnippets').value
    };

    postListCache.unshift(newPostObj);
    exitNewPostMode();
  } else {
    // 기존 글 업데이트
    const targetPost = postListCache.find(function(p) {
      return (p.ID || p.id) === currentPostId;
    });

    if (targetPost) {
      targetPost.제목 = titleVal;
      targetPost.title = titleVal;
      targetPost.상황 = statusVal;
      targetPost.status = statusVal;
      targetPost.분류1 = c1Val;
      targetPost.category1 = c1Val;
      targetPost.분류2 = c2Val;
      targetPost.category2 = c2Val;
      targetPost.중요 = currentPostImportant;
      targetPost.important = currentPostImportant;
      targetPost.숨김 = currentPostHidden;
      targetPost.hidden = currentPostHidden;
      targetPost.작성시작일 = sDate;
      targetPost.startDate = sDate;
      targetPost.작성완료일 = eDate;
      targetPost.endDate = eDate;
      targetPost.요약 = summaryVal;
      targetPost.summary = summaryVal;
    }
  }

  currentPostStatus = statusVal;
  localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
  if (typeof pushPostListHistory === 'function') pushPostListHistory();
  if (typeof populateCategoryFilters === 'function') populateCategoryFilters();
  populateMetaCategoryDropdowns(c1Val, c2Val);
  renderPostList();

  // 구글 시트 백그라운드 전송
  const currentPost = postListCache.find(function(p) { return (p.ID || p.id) === currentPostId; });
  if (currentPost && typeof sendPostMetaUpdate === 'function') {
    sendPostMetaUpdate(currentPost);
  }

  metaSavedSnapshot = getMetaSnapshot();
  updateMetaToolbarButtons();
  updateElapsedDays();
  showMacAlert('반영 완료', '작성 글 정보가 목록 및 구글 시트에 성공적으로 적용되었습니다.');
}

// 3-1. '삭제' 버튼: 현재 글 영구 삭제 처리
function deleteCurrentPost() {
  if (isNewPostMode || !currentPostId) {
    return showMacAlert('안내', '새 글 작성 중에는 삭제할 기존 글이 없습니다.');
  }

  const postTitle = $('essayTitleInput').value.trim() || "현재 글";
  const confirmMsg = "'" + postTitle + "'을(를) 정말로 영구 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.";

  showMacConfirm(
    "🗑️ 글 영구 삭제",
    confirmMsg,
    function() {
      const deletedId = currentPostId;
      const targetIdx = postListCache.findIndex(function(p) { return (p.ID || p.id) === deletedId; });

      if (targetIdx !== -1) {
        postListCache.splice(targetIdx, 1);
        localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
        if (typeof pushPostListHistory === 'function') pushPostListHistory();
        if (typeof populateCategoryFilters === 'function') populateCategoryFilters();
        renderPostList();

        // 구글 시트 영구 삭제 통신 호출
        if (typeof deletePostFromSheet === 'function') {
          deletePostFromSheet(deletedId);
        }

        // 남은 목록 중 첫 번째 글을 자동 로드하거나 초기화
        if (postListCache.length > 0) {
          selectPost(postListCache[0]);
        } else {
          startNewPostSetup();
        }

        showMacAlert('삭제 완료', '글이 성공적으로 영구 삭제되었습니다.');
      }
    },
    null,
    "삭제",
    true
  );
}

// 4. 새 글 작성 모드 활성화 및 해제
function enterNewPostMode() {
  if (isDirty) {
    showUnsavedModal(
      function() { saveWork('stay'); startNewPostSetup(); },
      function() { startNewPostSetup(); }
    );
  } else {
    startNewPostSetup();
  }
}

function startNewPostSetup() {
  if (currentPostId) {
    previousPostBackup = postListCache.find(function(p) { return (p.ID || p.id) === currentPostId; }) || null;
  }

  isNewPostMode = true;
  currentPostId = null;
  currentPostOrder = "";
  currentPostStatus = "구상중";
  currentPostImportant = "N";
  currentPostHidden = "N";

  const metaBox = $('sec_meta');
  if (metaBox) metaBox.classList.add('is-new-mode');

  // 삭제 버튼 비활성화/숨김
  const btnMetaDel = $('btn-meta-delete');
  if (btnMetaDel) btnMetaDel.style.display = 'none';

  // 메타 정보 폼 기본값 초기화
  if ($('essayTitleInput')) $('essayTitleInput').value = '';
  if ($('postStatusSelect')) $('postStatusSelect').value = '구상중';
  populateMetaCategoryDropdowns('미분류', '미분류');
  if ($('postStartDate')) $('postStartDate').value = '';
  if ($('postEndDate')) $('postEndDate').value = '';
  if ($('postSummary')) $('postSummary').value = '';

  updateMetaIcons();
  updateElapsedDays();

  // 7개 집필 영역 비우기
  SECTION_CONFIGS.forEach(function(cfg) {
    const el = $(cfg.id);
    if (el) el.value = '';
  });

  initFieldStates();
  initMetaHistory();
  updateAllStats();
  resizeAllTextareas();
  renderPostList();
  isDirty = false;
}

function exitNewPostMode() {
  isNewPostMode = false;
  const metaBox = $('sec_meta');
  if (metaBox) metaBox.classList.remove('is-new-mode');

  const btnMetaDel = $('btn-meta-delete');
  if (btnMetaDel) btnMetaDel.style.display = 'inline-flex';
}

// 5. 게시글 선택 및 로드 (시작일/요약 지능형 값 정규화 및 스왑 보정)
function selectPost(post) {
  exitNewPostMode();

  currentPostId = post.ID || post.id || '';
  currentPostOrder = post.순서 !== undefined ? post.순서 : '';
  currentPostStatus = (post.상황 || post.status || '구상중').trim();
  currentPostImportant = String(post.중요 || post.important || 'N').trim().toUpperCase() === 'Y' ? 'Y' : 'N';
  currentPostHidden = String(post.숨김 || post.hidden || 'N').trim().toUpperCase() === 'Y' ? 'Y' : 'N';

  if ($('essayTitleInput')) $('essayTitleInput').value = post.제목 || post.title || '';
  if ($('postStatusSelect')) $('postStatusSelect').value = currentPostStatus;

  const c1Val = post.분류1 || post.category1 || post.분류 || post.category || '미분류';
  const c2Val = post.분류2 || post.category2 || '미분류';
  populateMetaCategoryDropdowns(c1Val, c2Val);

  // 1단계: 원본 필드값 후보 추출
  let sDate = post.작성시작일 !== undefined ? post.작성시작일 : (post['작성 시작일'] || post['작성\n시작일'] || post.startDate || '');
  let eDate = post.작성완료일 !== undefined ? post.작성완료일 : (post['작성 완료일'] || post['작성\n완료일'] || post.endDate || '');
  let sumText = post.요약 !== undefined ? post.요약 : (post.summary || '');

  // 2단계: 키 역전 및 데이터 오염 자동 교정 가드 (sDate에 '요약'이 있거나, sumText에 8자리 숫자 날짜가 들어간 경우)
  const isSDateSummaryLike = String(sDate).trim().startsWith('요약');
  const sumDigits = String(sumText).replace(/[^0-9]/g, '');
  const sDigits = String(sDate).replace(/[^0-9]/g, '');

  if (isSDateSummaryLike || (sumDigits.length === 8 && sDigits.length !== 8)) {
    const temp = sDate;
    sDate = sumText;
    sumText = temp;
  }

  if ($('postStartDate')) $('postStartDate').value = sDate;
  if ($('postEndDate')) $('postEndDate').value = eDate;
  if ($('postSummary')) $('postSummary').value = sumText;

  updateMetaIcons();
  updateElapsedDays();

  $('essayOutline').value  = post.글의구성 || post['글의 구성'] || post['글의\n구성'] || post.outline || '';
  $('completedText').value = post.완성글 || post['완성 글'] || post['완성\n글'] || post.completed || '';
  $('newDraftText').value  = post.신규글 || post['신규 글'] || post['신규\n글'] || post.newDraft || '';
  $('draftIntent').value   = post.글의의도 || post['글의 의도'] || post['글의\n의도'] || post.intent || '';
  $('promptReqText').value = post.요청내용 || post['요청 내용'] || post['요청\n내용'] || post.promptReq || '';
  $('aiRefinedText').value = post.AI수정글 || post['AI 수정 글'] || post['AI수정 글'] || post.aiRefined || '';
  $('savedSnippets').value = post.보관글 || post['보관 글'] || post['보관\n글'] || post.snippets || '';

  initFieldStates();
  initMetaHistory();
  updateAllStats();
  resizeAllTextareas();
  renderPostList();
  isDirty = false;
}

// 6. 작업 저장 (전체 저장)
function saveWork(mode) {
  const titleVal = $('essayTitleInput').value.trim();
  if (!titleVal) return showMacAlert('확인 필요', '글 제목을 입력해주세요.');

  if (isNewPostMode || !currentPostId) {
    currentPostId = "ID_" + new Date().getTime();
    currentPostOrder = 1;
    postListCache.forEach(function(p) {
      if (p.순서 !== undefined && p.순서 !== "") p.순서 = Number(p.순서) + 1;
    });
    exitNewPostMode();
  }

  const c1Val = $('postCategory1Select') ? $('postCategory1Select').value : '미분류';
  const c2Val = $('postCategory2Select') ? $('postCategory2Select').value : '미분류';
  const statusVal = $('postStatusSelect') ? $('postStatusSelect').value : '구상중';

  const payload = {
    ID: currentPostId,
    id: currentPostId,
    순서: currentPostOrder !== undefined ? currentPostOrder : "",
    status: statusVal,
    important: currentPostImportant,
    hidden: currentPostHidden,
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

  metaSavedSnapshot = getMetaSnapshot();
  updateMetaToolbarButtons();
  isDirty = false;
  updateAllFieldToolbarButtons();

  syncPostToSheet(payload);

  if (mode === 'stay') showMacAlert('저장 완료', '구글 시트 및 로컬에 안전하게 저장되었습니다.');
  else if (mode === 'exit') window.close();
}

function loadSavedData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.ID || data.id) currentPostId = data.ID || data.id;
    if (data.순서 !== undefined) currentPostOrder = data.순서;
    if (data.status) {
      currentPostStatus = data.status;
      if ($('postStatusSelect')) $('postStatusSelect').value = data.status;
    }
    if (data.title && $('essayTitleInput')) $('essayTitleInput').value = data.title;

    let sDate = data.startDate || '';
    let eDate = data.endDate || '';
    let sumText = data.summary || '';

    // 로컬 스토리지에 저장되어 있던 구형 역전 데이터 보정
    const isSDateSummaryLike = String(sDate).trim().startsWith('요약');
    const sumDigits = String(sumText).replace(/[^0-9]/g, '');
    const sDigits = String(sDate).replace(/[^0-9]/g, '');
    if (isSDateSummaryLike || (sumDigits.length === 8 && sDigits.length !== 8)) {
      const temp = sDate;
      sDate = sumText;
      sumText = temp;
    }

    if ($('postStartDate')) $('postStartDate').value = sDate;
    if ($('postEndDate')) $('postEndDate').value = eDate;
    if ($('postSummary')) $('postSummary').value = sumText;

    populateMetaCategoryDropdowns(data.category1 || data.category || '미분류', data.category2 || '미분류');

    if (data.important) currentPostImportant = String(data.important).toUpperCase() === 'Y' ? 'Y' : 'N';
    if (data.hidden) currentPostHidden = String(data.hidden).toUpperCase() === 'Y' ? 'Y' : 'N';
    updateMetaIcons();
    updateElapsedDays();

    SECTION_CONFIGS.forEach(function(cfg) {
      if (data[cfg.key]) $(cfg.id).value = data[cfg.key];
    });

    initFieldStates();
    initMetaHistory();
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
    showMacAlert('안내', '변경된 내용이 없습니다.');
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

// 6-1. 타 모듈(sheet.js) 상호 연동을 위한 전역 네임스페이스 등록
window.selectPost = selectPost;
window.showUnsavedModal = showUnsavedModal;
window.saveWork = saveWork;
window.showMacAlert = showMacAlert;
window.showMacConfirm = showMacConfirm;
window.populateMetaCategoryDropdowns = populateMetaCategoryDropdowns;
window.updateMetaCategory2Options = updateMetaCategory2Options;

// 7. 메인 초기화 진입점
window.addEventListener('DOMContentLoaded', function() {
  buildEditorSections();
  initFieldStates();
  initMetaHistory();
  loadSavedData();
  checkApiKeyStatus();
  updateAllStats();
  loadCachedPosts();
  fetchSheetPosts();
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

  // 작성 글 정보 창 전용 이벤트 리스너 바인딩
  const btnMetaApply = $('btn-meta-apply');
  if (btnMetaApply) btnMetaApply.onclick = applyMetaChanges;

  const btnMetaDelete = $('btn-meta-delete');
  if (btnMetaDelete) btnMetaDelete.onclick = deleteCurrentPost;

  const btnNewPost = $('btn-new-post');
  if (btnNewPost) btnNewPost.onclick = enterNewPostMode;

  const btnMetaStar = $('btnMetaStar');
  if (btnMetaStar) btnMetaStar.onclick = toggleMetaImportant;

  const btnMetaHidden = $('btnMetaHidden');
  if (btnMetaHidden) btnMetaHidden.onclick = toggleMetaHidden;

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
      filterOnlyHidden = !filterOnlyHidden;
      btnFilterHidden.classList.toggle('active-hidden', filterOnlyHidden);
      renderPostList();
    };
  }

  // 메타 인풋 필드 변경 감지 및 히스토리 스택/실시간 경과 연동
  ['essayTitleInput', 'postSummary'].forEach(function(id) {
    const el = $(id);
    if (el) el.oninput = pushMetaHistory;
  });

  const postStartEl = $('postStartDate');
  if (postStartEl) {
    postStartEl.oninput = function() {
      updateElapsedDays();
      pushMetaHistory();
    };
  }

  const postEndEl = $('postEndDate');
  if (postEndEl) {
    postEndEl.oninput = function() {
      updateElapsedDays();
      pushMetaHistory();
    };
  }

  const postStatusSelect = $('postStatusSelect');
  if (postStatusSelect) {
    postStatusSelect.onchange = function() {
      updateElapsedDays();
      pushMetaHistory();
    };
  }

  // 분류1 변경 시: 분류2 옵션 동적 재구성 및 히스토리 갱신
  const postCat1 = $('postCategory1Select');
  if (postCat1) {
    postCat1.onchange = function() {
      updateMetaCategory2Options('미분류');
      pushMetaHistory();
    };
  }

  const postCat2 = $('postCategory2Select');
  if (postCat2) postCat2.onchange = pushMetaHistory;

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
