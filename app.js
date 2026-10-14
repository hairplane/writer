/* app.js v0.2: 시스템 뒤로가기(popstate) 연동 포커스뷰 복구, API 키 함수 누락 복원, 커스텀 모달 및 Google Sheets 통신 완비 */
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzFdIdTROi1QhNrIj6bpoiT6vLdkhD2jWoCiDyUSg5Zyj8uGGHVZqjUlbbqz-tmH37rjg/exec";
const PUBLIC_SHARED_KEY = "__GEMINI_API_KEY__";
const STORAGE_KEY = "WRITER_STUDIO_DATA_V10";
const POSTS_CACHE_KEY = "WRITER_POSTS_CACHE_V03";

const $ = function(id) { return document.getElementById(id); };

let isDirty = false;
let isPersonalWaitState = false;
let currentPostId = null;
let currentPostStatus = "작성";
let postListCache = [];
let currentFocusedKey = null;
let pendingModalAction = null;

/* ==========================================================================
   1. 뷰포트 높이 실시간 보정 및 브라우저 뒤로가기(popstate) 제어
   ========================================================================== */
function updateAppHeight() {
  if (window.visualViewport) {
    document.documentElement.style.setProperty('--app-height', `${window.visualViewport.height}px`);
  } else {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  }
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateAppHeight);
  window.visualViewport.addEventListener('scroll', updateAppHeight);
} else {
  window.addEventListener('resize', updateAppHeight);
}
updateAppHeight();

// 스마트폰 하단 시스템 뒤로가기(<) 버튼 연동 포커스 뷰 해제
window.addEventListener('popstate', function(e) {
  if (currentFocusedKey) {
    toggleFocusView(currentFocusedKey, false);
  }
});

/* ==========================================================================
   2. 데이터 주도 7개 집필 창 정의
   ========================================================================== */
const SECTION_CONFIGS = [
  { key: 'outline',   id: 'essayOutline',   title: '글의 구성',      minH: 70,  stat: false, readTime: false, bullet: true },
  { key: 'completed', id: 'completedText',  title: '완성 글',        minH: 120, stat: true,  readTime: true,  bullet: false },
  { key: 'newDraft',  id: 'newDraftText',   title: '신규 글',        minH: 80,  stat: true,  readTime: true,  bullet: false },
  { key: 'intent',    id: 'draftIntent',    title: '글의 의도',      minH: 50,  stat: true,  readTime: false, bullet: false },
  { key: 'promptReq', id: 'promptReqText',  title: '요청 내용 (to AI)', minH: 50,  stat: true,  readTime: false, bullet: false },
  { key: 'aiRefined', id: 'aiRefinedText',  title: 'AI 수정 글',     minH: 90,  stat: true,  readTime: true,  bullet: false, isAi: true },
  { key: 'snippets',  id: 'savedSnippets',  title: '보관 글',        minH: 60,  stat: true,  readTime: false, bullet: true }
];

const ALL_SECTION_KEYS = ['postList', 'meta', 'outline', 'completed', 'newDraft', 'intent', 'api', 'promptReq', 'aiRefined', 'snippets'];
const fieldMap = {};
const fieldState = {};

SECTION_CONFIGS.forEach(function(c) { fieldMap[c.key] = c.id; });

// 7개 집필 창 동적 생성 (컴포넌트 빌더 루프)
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

/* ==========================================================================
   3. 단독 집중 모드 (Focus View) 및 뒤로가기 가로채기 엔진
   ========================================================================== */
function toggleFocusView(key, manageHistory = true) {
  if (currentFocusedKey === key) {
    // 포커스 해제
    document.body.classList.remove('mode-focus');
    ALL_SECTION_KEYS.forEach(function(k) {
      const sec = $('sec_' + k);
      if (sec) {
        sec.style.display = 'flex';
        sec.classList.remove('is-focused-section');
      }
      const titleEl = $('title_' + k);
      if (titleEl) titleEl.classList.remove('is-focused');
    });

    const actionToolbar = $('mainActionToolbar');
    if (actionToolbar) actionToolbar.style.display = 'flex';

    currentFocusedKey = null;
    resizeAllTextareas();

    if (manageHistory && history.state && history.state.focusView) {
      history.back();
    }
  } else {
    // 포커스 진입
    document.body.classList.add('mode-focus');
    ALL_SECTION_KEYS.forEach(function(k) {
      const sec = $('sec_' + k);
      if (sec) {
        if (k === key) {
          sec.style.display = 'flex';
          sec.classList.add('is-focused-section');
        } else {
          sec.style.display = 'none';
          sec.classList.remove('is-focused-section');
        }
      }
      const titleEl = $('title_' + k);
      if (titleEl) {
        if (k === key) titleEl.classList.add('is-focused');
        else titleEl.classList.remove('is-focused');
      }
    });

    currentFocusedKey = key;

    const bodyEl = $('body_' + key);
    if (bodyEl && bodyEl.style.display === 'none') {
      toggleSection(key);
    }

    const cfg = SECTION_CONFIGS.find(function(c) { return c.key === key; });
    if (cfg) {
      const targetArea = $(cfg.id);
      if (targetArea) {
        targetArea.style.height = '';
        targetArea.focus();
      }
    }

    if (manageHistory) {
      history.pushState({ focusView: key }, '');
    }
  }
}

/* ==========================================================================
   4. 커스텀 저장 확인 모달 서브루틴
   ========================================================================== */
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

  if (btnCancel) {
    btnCancel.onclick = function() {
      hideUnsavedModal();
    };
  }
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

/* ==========================================================================
   5. 초기화 및 전역 이벤트 등록
   ========================================================================== */
window.addEventListener('DOMContentLoaded', function() {
  buildEditorSections();
  initFieldStates();
  loadSavedData();
  checkApiKeyStatus();
  updateAllStats();
  loadCachedPosts();
  fetchSheetPosts();
  initModalHandlers();

  // 상단 헤더 및 툴바 액션 바인딩
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

  // 헤더 신호등 버튼 토글 클릭 바인딩
  ALL_SECTION_KEYS.forEach(function(k) {
    const dot = $('dot_' + k);
    if (dot) {
      dot.onclick = function() { toggleSection(k); };
    }
  });

  // 메타 테이블 토글 바인딩
  const arrowMeta = $('arrow_meta');
  if (arrowMeta) arrowMeta.onclick = function() { toggleSection('meta'); };
  const titleMeta = $('title_meta');
  if (titleMeta) titleMeta.onclick = function() { toggleFocusView('meta'); };

  // 작성글 목록 토글 바인딩
  const arrowPostList = $('arrow_postList');
  if (arrowPostList) arrowPostList.onclick = function() { toggleSection('postList'); };
  const titlePostList = $('title_postList');
  if (titlePostList) titlePostList.onclick = function() { toggleFocusView('postList'); };

  // API 박스 토글 바인딩
  const arrowApi = $('arrow_api');
  if (arrowApi) arrowApi.onclick = function() { toggleSection('api'); };
  const titleApi = $('title_api');
  if (titleApi) titleApi.onclick = function() { toggleFocusView('api'); };

  // API 버튼 바인딩
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
  if (apiKeyInput) {
    apiKeyInput.oninput = checkKeyInputState;
  }

  // 메타 인풋 수정 시 Dirty 플래그
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

function markDirty() {
  isDirty = true;
}

function autoResizeTextarea(textarea, minH) {
  if (!textarea) return;
  if (document.body.classList.contains('mode-focus')) return;
  const baseH = minH || 50;
  textarea.style.height = 'auto';
  textarea.style.height = Math.max(textarea.scrollHeight, baseH) + 'px';
}

function copyContent(elementId, btn) {
  const el = $(elementId);
  if (!el || !el.value.trim()) return alert('복사할 내용이 없습니다.');
  navigator.clipboard.writeText(el.value).then(function() {
    const originalText = btn.innerText;
    btn.innerText = '✓ 복사됨';
    btn.style.color = '#16a34a';
    setTimeout(function() {
      btn.innerText = originalText;
      btn.style.color = '';
    }, 1500);
  });
}

function toggleSection(key) {
  const bodyEl = $('body_' + key);
  const dot = $('dot_' + key);
  const arrow = $('arrow_' + key);
  const badge = $('badge_' + key);
  const hdr = $('hdr_' + key);
  const copyBtn = $('copyBtn_' + key);

  if (!bodyEl) return;
  const isClosed = bodyEl.style.display === 'none';

  if (isClosed) {
    bodyEl.style.display = (key === 'meta') ? 'block' : 'flex';
    if (dot) dot.classList.remove('is-closed');
    if (arrow) { arrow.innerText = '−'; arrow.classList.remove('is-closed'); }
    if (badge) badge.classList.remove('show');
    if (hdr) hdr.classList.remove('header-collapsed-line');
    if (copyBtn) copyBtn.style.display = 'inline-flex';
  } else {
    bodyEl.style.display = 'none';
    if (dot) dot.classList.add('is-closed');
    if (arrow) { arrow.innerText = '+'; arrow.classList.add('is-closed'); }
    if (badge) badge.classList.add('show');
    if (hdr) hdr.classList.add('header-collapsed-line');
    if (copyBtn) copyBtn.style.display = 'none';
  }
}

/* ==========================================================================
   6. 작성 글 목록 및 Google Sheets 연동
   ========================================================================== */
function loadCachedPosts() {
  const cached = localStorage.getItem(POSTS_CACHE_KEY);
  if (cached) {
    try {
      postListCache = JSON.parse(cached);
      populateCategoryFilter();
      renderPostList();
    } catch (e) {
      console.error(e);
    }
  }
}

function fetchSheetPosts() {
  const oldScript = document.getElementById('gas_jsonp_script');
  if (oldScript) oldScript.remove();

  window.handleGasResponse = function(response) {
    if (response && response.status === "success" && response.data) {
      postListCache = response.data;
      localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
      populateCategoryFilter();
      renderPostList();
    }
  };

  const script = document.createElement('script');
  script.id = 'gas_jsonp_script';
  script.src = GAS_ENDPOINT + '?callback=handleGasResponse&_t=' + new Date().getTime();
  document.body.appendChild(script);
}

function populateCategoryFilter() {
  const select = $('categoryFilter');
  if (!select) return;
  const currentVal = select.value;
  const categories = new Set();

  postListCache.forEach(function(item) {
    const cat = (item.분류 || item.category || '').trim();
    if (cat) categories.add(cat);
  });

  select.innerHTML = '<option value="전체">전체</option>';
  categories.forEach(function(cat) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.innerText = cat;
    select.appendChild(opt);
  });
  select.value = Array.from(categories).includes(currentVal) ? currentVal : '전체';
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

function renderPostList() {
  const grid = $('body_postList');
  if (!grid) return;
  const statusFilterEl = $('statusFilter');
  const catFilterEl = $('categoryFilter');
  const statusFilter = statusFilterEl ? statusFilterEl.value : '전체';
  const categoryFilter = catFilterEl ? catFilterEl.value : '전체';

  grid.innerHTML = '';

  const filtered = postListCache.filter(function(item) {
    const itemStatus = (item.상황 || item.status || '작성').trim();
    const itemCategory = (item.분류 || item.category || '').trim();
    const matchStatus = (statusFilter === '전체') || (itemStatus === statusFilter);
    const matchCategory = (categoryFilter === '전체') || (itemCategory === categoryFilter);
    return matchStatus && matchCategory;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<span style="font-size:0.78rem; color:#64748b; padding:4px 6px;">해당 조건의 글이 없습니다.</span>';
    return;
  }

  filtered.forEach(function(post) {
    const postId = post.ID || post.id || '';
    const postTitle = post.제목 || post.title || '(제목 없음)';
    const postStatus = (post.상황 || post.status || '작성').trim();
    const postCategory = (post.분류 || post.category || '').trim();

    const row = document.createElement('div');
    row.className = 'post-row-item' + (currentPostId === postId ? ' active' : '');

    const titleArea = document.createElement('div');
    titleArea.className = 'post-row-title-area';
    const categoryText = postCategory || '-';

    titleArea.innerHTML = '<span class="post-category-tag" title="' + categoryText + '">' + categoryText + '</span>' +
                          '<span class="post-row-title" title="' + postTitle + '">' + postTitle + '</span>';

    titleArea.onclick = function() {
      if (isDirty) {
        showUnsavedModal(
          function() { saveWork('stay'); selectPost(post); },
          function() { selectPost(post); }
        );
      } else {
        selectPost(post);
      }
    };

    let statusClass = 'status-writing';
    if (postStatus === '완료') statusClass = 'status-done';
    else if (postStatus === '예정') statusClass = 'status-plan';

    const statusBtn = document.createElement('button');
    statusBtn.type = 'button';
    statusBtn.className = 'btn-status-toggle ' + statusClass;
    statusBtn.innerText = postStatus;
    statusBtn.title = "클릭 시 상황 변경 (작성 -> 완료 -> 예정)";
    statusBtn.onclick = function(e) {
      e.stopPropagation();
      togglePostStatus(post);
    };

    row.appendChild(titleArea);
    row.appendChild(statusBtn);
    grid.appendChild(row);
  });
}

function togglePostStatus(post) {
  const current = (post.상황 || post.status || '작성').trim();
  let nextStatus = '작성';
  if (current === '작성') nextStatus = '완료';
  else if (current === '완료') nextStatus = '예정';
  else if (current === '예정') nextStatus = '작성';

  post.상황 = nextStatus;
  post.status = nextStatus;

  if (currentPostId === (post.ID || post.id)) {
    currentPostStatus = nextStatus;
  }

  localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
  renderPostList();

  fetch(GAS_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ID: post.ID || post.id,
      id: post.ID || post.id,
      status: nextStatus,
      category: post.분류 || post.category || '',
      title: post.제목 || post.title || '',
      outline: post.글의구성 || post['글의 구성'] || post.outline || ''
    })
  });
}

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

function resizeAllTextareas() {
  if (document.body.classList.contains('mode-focus')) return;
  SECTION_CONFIGS.forEach(function(cfg) {
    const el = $(cfg.id);
    if (el) autoResizeTextarea(el, cfg.minH);
  });
}

/* ==========================================================================
   7. 복원(Undo) 스택 및 편집 제어
   ========================================================================== */
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

function handleBulletEnter(e, textarea) {
  if (e.key === 'Enter') {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const currentLine = value.substring(lineStart, start);

    if (currentLine.trim().startsWith('●')) {
      e.preventDefault();
      if (currentLine.trim() === '●') {
        const before = value.substring(0, lineStart);
        const after = value.substring(end);
        textarea.value = before + after;
        textarea.selectionStart = textarea.selectionEnd = lineStart;
        return;
      }
      const bullet = '\n● ';
      textarea.value = value.substring(0, start) + bullet + value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + bullet.length;
      textarea.dispatchEvent(new Event('input'));
    }
  }
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

/* ==========================================================================
   8. 저장 (로컬 스토리지 + 구글 시트 양방향 동기화)
   ========================================================================== */
async function saveWork(mode) {
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

  try {
    fetch(GAS_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function() {
      fetchSheetPosts();
    });
  } catch (err) {
    console.error("구글 시트 저장 통신 오류:", err);
  }

  if (mode === 'stay') {
    alert('구글 시트 및 로컬에 안전하게 저장되었습니다.');
  } else if (mode === 'exit') {
    window.close();
  }
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
    console.error("데이터 로드 실패", e);
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

/* ==========================================================================
   9. API Key 관리 및 복원 서브루틴
   ========================================================================== */
function checkApiKeyStatus() {
  const savedKey = localStorage.getItem("GEMINI_USER_API_KEY");
  const keyType = localStorage.getItem("GEMINI_KEY_TYPE");
  const badge = $("apiStatusBadge");
  if (!badge) return;

  if (savedKey) {
    isPersonalWaitState = false;
    $("apiKeyInput").value = savedKey;
    $("apiDelBtn").style.display = "inline-block";
    $("apiSaveBtn").classList.remove("api-wait-btn");
    $("apiCancelBtn").style.display = "none";
    $("dropdownArrow").style.display = "none";
    $("apiSaveBtn").disabled = true;

    if (keyType === "personal") {
      $("apiSaveBtnText").innerText = "개인 키 설치완료";
      badge.innerText = "🔒 개인 키 사용 중";
      Object.assign(badge.style, { color: "#16a34a", background: "#dcfce7", borderColor: "#86efac" });
    } else {
      $("apiSaveBtnText").innerText = "공용 키 설치완료";
      badge.innerText = "🟢 공용 키 사용 중";
      Object.assign(badge.style, { color: "#d97706", background: "#fef3c7", borderColor: "#fde68a" });
    }
  } else {
    $("apiKeyInput").value = "";
    $("apiDelBtn").style.display = "none";
    $("apiSaveBtn").disabled = false;
    $("apiSaveBtn").classList.remove("api-wait-btn");
    badge.innerText = "⚠️ 키 미설정 상태";
    Object.assign(badge.style, { color: "#dc2626", background: "#fee2e2", borderColor: "#fca5a5" });

    if (isPersonalWaitState) {
      $("apiSaveBtnText").innerText = "개인 키 설치대기";
      $("dropdownArrow").style.display = "none";
      $("apiSaveBtn").classList.add("api-wait-btn");
      $("apiCancelBtn").style.display = "inline-block";
    } else {
      checkKeyInputState();
    }
  }
}

function checkKeyInputState() {
  if (localStorage.getItem("GEMINI_USER_API_KEY") || isPersonalWaitState) return;
  const hasInput = $("apiKeyInput").value.trim().length > 0;
  $("apiSaveBtnText").innerText = hasInput ? "개인 키 설치하기" : "키 설치하기";
  $("dropdownArrow").style.display = hasInput ? "none" : "inline";
  $("apiCancelBtn").style.display = hasInput ? "inline-block" : "none";
}

function handleSaveButtonClick() {
  if (localStorage.getItem("GEMINI_USER_API_KEY")) return;
  const keyVal = $("apiKeyInput").value.trim();

  if (isPersonalWaitState || keyVal.length > 0) {
    if (keyVal.length === 0) {
      alert("API Key를 입력한 뒤 눌러주세요.");
      return $("apiKeyInput").focus();
    }
    localStorage.setItem("GEMINI_USER_API_KEY", keyVal);
    localStorage.setItem("GEMINI_KEY_TYPE", "personal");
    isPersonalWaitState = false;
    checkApiKeyStatus();
  } else {
    $("apiDropdownMenu").classList.toggle("show");
  }
}

function selectKeyChoice(type) {
  $("apiDropdownMenu").classList.remove('show');
  if (type === 'shared') {
    if (PUBLIC_SHARED_KEY && !PUBLIC_SHARED_KEY.startsWith("__")) {
      localStorage.setItem("GEMINI_USER_API_KEY", PUBLIC_SHARED_KEY);
      localStorage.setItem("GEMINI_KEY_TYPE", "shared");
      isPersonalWaitState = false;
      checkApiKeyStatus();
    } else {
      alert("공용 키가 설정되어 있지 않습니다.");
    }
  } else if (type === 'personal') {
    const keyVal = $("apiKeyInput").value.trim();
    if (keyVal.length > 0) {
      localStorage.setItem("GEMINI_USER_API_KEY", keyVal);
      localStorage.setItem("GEMINI_KEY_TYPE", "personal");
      isPersonalWaitState = false;
      checkApiKeyStatus();
    } else {
      isPersonalWaitState = true;
      checkApiKeyStatus();
      $("apiKeyInput").focus();
    }
  }
}

function cancelKeyInput() {
  isPersonalWaitState = false;
  $("apiKeyInput").value = "";
  checkApiKeyStatus();
}

function deleteApiKey() {
  if (confirm("저장된 API Key를 삭제하시겠습니까?")) {
    localStorage.removeItem("GEMINI_USER_API_KEY");
    localStorage.removeItem("GEMINI_KEY_TYPE");
    isPersonalWaitState = false;
    checkApiKeyStatus();
    $("apiKeyInput").focus();
  }
}

/* ==========================================================================
   10. Gemini API 연동 AI 수정 요청 파이프라인
   ========================================================================== */
async function requestAiRefine() {
  const apiKey = localStorage.getItem("GEMINI_USER_API_KEY");
  if (!apiKey) return alert('Gemini API Key를 먼저 설치해주세요.');

  const completed = $('completedText').value.trim();
  const newDraft = $('newDraftText').value.trim();
  const intent = $('draftIntent').value.trim();
  const promptReq = $('promptReqText').value.trim();

  if (!newDraft) return alert('신규 글을 먼저 작성해주세요.');

  const prompt = "당신은 유려한 감성과 논리적인 구조를 겸비한 전문 글쓰기 편집자이자 라이팅 코치입니다.\n" +
    "다음 정보들을 분석하여 신규 글을 검토하고 퇴고안을 작성해주세요.\n\n" +
    "[이제까지 작성 완료된 글]:\n" + (completed || "(첫 단락입니다)") + "\n\n" +
    "[신규 작성한 글]:\n" + newDraft + "\n\n" +
    "[글의 의도]:\n" + (intent || "(별도 의도 없음)") + "\n\n" +
    "[AI에게 바라는 구체적 요청 사항]:\n" + (promptReq || "(기본 자연스러운 흐름 퇴고 요망)") + "\n\n" +
    "[수정 가이드]:\n" +
    "1. 신규 글의 의도와 구체적인 요청 사항을 충실히 반영하여, 이제까지 작성 완료된 글의 흐름에 이 글이 자연스러운지 채택 여부를 먼저 판단하세요.\n" +
    "2. 사용하기로 했다면, 요청 사항에 맞춰 유려하고 정돈된 문체로 수정 완성 단락을 작성해 주세요.\n" +
    "3. 출력 형식:\n- 채택 판단 코멘트(1줄)\n- [수정 완성 단락]";

  const aiRefinedEl = $('aiRefinedText');
  aiRefinedEl.value = "AI 검토 및 퇴고 중입니다...";

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      aiRefinedEl.value = data.candidates[0].content.parts[0].text;
      handleFieldInput('aiRefined');
    } else {
      aiRefinedEl.value = "수정안 생성에 실패했습니다.";
    }
  } catch (err) {
    console.error(err);
    aiRefinedEl.value = "통신 중 오류가 발생했습니다.";
  }
}
