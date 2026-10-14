// app.js v0.1
/**
 * ============================================================================
 * 프로젝트: 글쓰기 스튜디오 (Writer Studio) v1.3
 * 모듈 구조: Fortran의 Main-Subroutine 분리 철학을 차용한 단일 책임 서브루틴 집합
 * ============================================================================
 */

// ============================================================================
// 1. 전역 상태 저장소 (Global State / Fortran COMMON Block 대응)
// ============================================================================
const STATE = {
  activeRowIndex: null,      // 현재 선택된 구글 시트 행 번호
  isDirty: false,            // 입력 변경 여부 플래그
  focusedSectionId: null,    // 현재 단독 집중 모드(Focus View) 상태인 섹션 ID
  articles: [],              // 글 목록 원본 데이터
  categories: new Set(),     // 추출된 분류 목록
  gasEndpoint: 'https://script.google.com/macros/s/AKfycbx_placeholder_endpoint/exec', // GAS URL
  geminiApiKey: localStorage.getItem('GEMINI_API_KEY') || ''
};

// 7대 집필 창 정의 데이터 주도 스펙
const SECTION_CONFIGS = [
  { id: 'sec-outline', key: 'outline', title: '글의 구성', aiSupport: false },
  { id: 'sec-complete', key: 'complete', title: '완성 글', aiSupport: false },
  { id: 'sec-draft', key: 'draft', title: '신규 글', aiSupport: false },
  { id: 'sec-intent', key: 'intent', title: '글의 의도', aiSupport: false },
  { id: 'sec-request', key: 'request', title: '요청 내용', aiSupport: false },
  { id: 'sec-ai-edit', key: 'aiEdit', title: 'AI 수정 글', aiSupport: true },
  { id: 'sec-archive', key: 'archive', title: '보관 글', aiSupport: false }
];

// 상황 순환 토글 정의
const STATUS_CYCLE = ['작성', '완료', '예정'];

// ============================================================================
// 2. 메인 진입점 (Main Routine)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initWorkspace();
  initEventListeners();
  initHistoryAndVisualViewport();
  loadInitialDataMock(); // 실제 환경에서는 fetchSheetData() 연동
});

// ============================================================================
// 3. 서브루틴: UI 초기화 및 컴포넌트 동적 빌드 (Subroutine: UI Renderer)
// ============================================================================
function initWorkspace() {
  const container = document.getElementById('dynamic-sections-container');
  container.innerHTML = '';

  SECTION_CONFIGS.forEach(cfg => {
    const card = document.createElement('div');
    card.id = cfg.id;
    card.className = 'section-card';
    card.dataset.sectionKey = cfg.key;

    card.innerHTML = `
      <div class="section-card-header">
        <div class="header-meta-left" title="클릭 시 단독 집중 모드 전환">
          <button type="button" class="btn-collapse-toggle">−</button>
          <span class="section-title">${cfg.title}</span>
        </div>
        <div class="header-meta-right">
          <span class="word-count-badge">0자 | 예상 0분</span>
          ${cfg.aiSupport ? '<button type="button" class="btn btn-sm btn-outline-primary btn-ai-action">AI 수정 실행</button>' : ''}
          <button type="button" class="btn btn-sm btn-secondary btn-copy">복사</button>
        </div>
      </div>
      <div class="section-card-body">
        <textarea class="section-textarea" placeholder="${cfg.title} 내용을 입력하세요..."></textarea>
      </div>
    `;

    container.appendChild(card);
  });
}

// ============================================================================
// 4. 서브루틴: 단독 집중 모드 및 뒤로가기 제어 (Subroutine: Focus & History)
// ============================================================================
function initHistoryAndVisualViewport() {
  // 브라우저 뒤로가기(스마트폰 하단 '<' 버튼) 이벤트 감지
  window.addEventListener('popstate', (e) => {
    if (STATE.focusedSectionId) {
      // 페이지를 이탈하지 않고 단독 집중 모드만 안전하게 해제
      exitFocusMode(false);
    }
  });

  // 모바일 가상 키보드 발생 시 visualViewport 연동 크기 보정
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (STATE.focusedSectionId) {
        const card = document.getElementById(STATE.focusedSectionId);
        if (card) {
          card.style.height = `${window.visualViewport.height}px`;
        }
      }
    });
  }
}

function enterFocusMode(sectionId) {
  const card = document.getElementById(sectionId);
  if (!card) return;

  STATE.focusedSectionId = sectionId;
  card.classList.remove('collapsed');
  card.querySelector('.btn-collapse-toggle').textContent = '−';
  card.classList.add('focus-mode');

  // 히스토리 pushState 기록 (뒤로가기 가로채기 활성화)
  history.pushState({ view: 'focus', sectionId: sectionId }, '', '');

  const textarea = card.querySelector('.section-textarea');
  if (textarea) textarea.focus();
}

function exitFocusMode(triggerHistoryBack = true) {
  if (!STATE.focusedSectionId) return;

  const card = document.getElementById(STATE.focusedSectionId);
  if (card) {
    card.classList.remove('focus-mode');
    card.style.height = '';
  }

  STATE.focusedSectionId = null;

  // JS 코드로 직접 닫았고 히스토리가 남아있는 경우 동기화
  if (triggerHistoryBack && history.state && history.state.view === 'focus') {
    history.back();
  }
}

// ============================================================================
// 5. 서브루틴: 커스텀 저장 확인 모달 (Subroutine: Custom Modal Controller)
// ============================================================================
let pendingExitCallback = null;

function showUnsavedModal(onConfirmDiscard) {
  const modal = document.getElementById('unsaved-modal');
  pendingExitCallback = onConfirmDiscard;
  modal.classList.remove('hidden');
}

function hideUnsavedModal() {
  const modal = document.getElementById('unsaved-modal');
  modal.classList.add('hidden');
  pendingExitCallback = null;
}

// ============================================================================
// 6. 서브루틴: 이벤트 리스너 통합 등록 (Subroutine: Event Dispatcher)
// ============================================================================
function initEventListeners() {
  const container = document.getElementById('dynamic-sections-container');

  // 집필 창 내부 클릭 이벤트 위임
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.section-card');
    if (!card) return;

    // 1. 접기/펼치기 토글
    if (e.target.classList.contains('btn-collapse-toggle')) {
      e.stopPropagation();
      const isCollapsed = card.classList.toggle('collapsed');
      e.target.textContent = isCollapsed ? '+' : '−';
      return;
    }

    // 2. 단독 집중 모드 진입 (소제목 또는 헤더 메타 클릭 시)
    if (e.target.closest('.header-meta-left')) {
      if (card.classList.contains('focus-mode')) {
        exitFocusMode(true);
      } else {
        enterFocusMode(card.id);
      }
      return;
    }

    // 3. 복사 버튼
    if (e.target.classList.contains('btn-copy')) {
      const textarea = card.querySelector('.section-textarea');
      navigator.clipboard.writeText(textarea.value).then(() => {
        const origText = e.target.textContent;
        e.target.textContent = '완료!';
        setTimeout(() => e.target.textContent = origText, 1200);
      });
      return;
    }

    // 4. AI 수정 버튼
    if (e.target.classList.contains('btn-ai-action')) {
      executeAiEditPipeline();
      return;
    }
  });

  // 텍스트 입력 시 글자 수 계산 및 불릿 자동완성
  container.addEventListener('input', (e) => {
    if (e.target.classList.contains('section-textarea')) {
      STATE.isDirty = true;
      updateWordCount(e.target);
      autoResizeTextarea(e.target);
    }
  });

  // 엔터 키 입력 시 '● ' 자동 이어쓰기
  container.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('section-textarea') && e.key === 'Enter') {
      handleBulletAutoContinue(e, e.target);
    }
  });

  // 메타 정보 수정 시 Dirty 마킹
  document.getElementById('article-title-input').addEventListener('input', () => { STATE.isDirty = true; });
  document.getElementById('article-category-input').addEventListener('input', () => { STATE.isDirty = true; });

  // 상황 토글 버튼 클릭 (작성 -> 완료 -> 예정)
  document.getElementById('btn-status-toggle').addEventListener('click', (e) => {
    const current = e.target.dataset.status;
    const nextIdx = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
    const nextStatus = STATUS_CYCLE[nextIdx];
    e.target.dataset.status = nextStatus;
    e.target.textContent = nextStatus;
    STATE.isDirty = true;
  });

  // 상단 헤더 저장 버튼
  document.getElementById('btn-save').addEventListener('click', () => {
    saveCurrentArticle();
  });

  // 상단 닫기(✕) 버튼 클릭 시
  document.getElementById('btn-close-app').addEventListener('click', () => {
    requestSafeExit(() => {
      window.location.href = 'about:blank';
    });
  });

  // 모달 버튼 핸들러
  document.getElementById('modal-btn-cancel').addEventListener('click', () => {
    hideUnsavedModal();
  });

  document.getElementById('modal-btn-discard').addEventListener('click', () => {
    STATE.isDirty = false;
    const callback = pendingExitCallback;
    hideUnsavedModal();
    if (callback) callback();
  });

  document.getElementById('modal-btn-save').addEventListener('click', () => {
    saveCurrentArticle();
    const callback = pendingExitCallback;
    hideUnsavedModal();
    if (callback) callback();
  });

  // 브라우저 탭 닫기/새로고침 방어
  window.addEventListener('beforeunload', (e) => {
    if (STATE.isDirty) {
      e.preventDefault();
      e.returnValue = ''; // 표준 브라우저 이탈 방지 트리거
    }
  });

  // 분류 드롭다운 필터링
  document.getElementById('category-filter').addEventListener('change', (e) => {
    renderArticleList(e.target.value);
  });

  // 새 글 작성 버튼
  document.getElementById('btn-new-article').addEventListener('click', () => {
    requestSafeExit(() => {
      resetEditorFields();
      STATE.activeRowIndex = null;
      STATE.isDirty = false;
    });
  });
}

// ============================================================================
// 7. 서브루틴: 비즈니스 로직 및 헬퍼 (Subroutine: Utilities & Pipeline)
// ============================================================================
function requestSafeExit(onSuccess) {
  if (STATE.isDirty) {
    showUnsavedModal(onSuccess);
  } else {
    onSuccess();
  }
}

function handleBulletAutoContinue(e, textarea) {
  const cursor = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, cursor);
  const currentLine = textBefore.split('\n').pop();

  if (currentLine.startsWith('● ')) {
    e.preventDefault();
    if (currentLine.trim() === '●') {
      // 내용 없는 불릿 줄에서 엔터 시 불릿 제거
      const lineStart = cursor - currentLine.length;
      textarea.value = textarea.value.substring(0, lineStart) + textarea.value.substring(cursor);
      textarea.selectionStart = textarea.selectionEnd = lineStart;
    } else {
      // 새로운 불릿 줄 삽입
      const textAfter = textarea.value.substring(cursor);
      textarea.value = textBefore + '\n● ' + textAfter;
      textarea.selectionStart = textarea.selectionEnd = cursor + 3;
    }
    updateWordCount(textarea);
  }
}

function updateWordCount(textarea) {
  const card = textarea.closest('.section-card');
  const badge = card.querySelector('.word-count-badge');
  const count = textarea.value.length;
  const readTime = Math.ceil(count / 400); // 400자/분 기준
  badge.textContent = `${count}자 | 예상 ${readTime}분`;
}

function autoResizeTextarea(textarea) {
  if (textarea.closest('.focus-mode')) return; // 집중 모드에서는 내부 스크롤 유지
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(90, textarea.scrollHeight)}px`;
}

function resetEditorFields() {
  document.getElementById('article-category-input').value = '';
  document.getElementById('article-title-input').value = '';
  const statusBtn = document.getElementById('btn-status-toggle');
  statusBtn.dataset.status = '작성';
  statusBtn.textContent = '작성';

  document.querySelectorAll('.section-card').forEach(card => {
    const ta = card.querySelector('.section-textarea');
    ta.value = '';
    ta.style.height = '90px';
    card.querySelector('.word-count-badge').textContent = '0자 | 예상 0분';
  });
}

function saveCurrentArticle() {
  const title = document.getElementById('article-title-input').value.trim();
  if (!title) {
    alert('제목을 입력해 주세요.');
    return;
  }

  const indicator = document.getElementById('sync-status');
  indicator.textContent = '저장 중...';

  // 실제 연동 시: fetch(STATE.gasEndpoint, { method: 'POST', body: JSON.stringify(payload) })
  setTimeout(() => {
    STATE.isDirty = false;
    indicator.textContent = '저장 완료';
    indicator.classList.add('synced');
    setTimeout(() => indicator.textContent = '동기화 완료', 2000);
  }, 600);
}

function executeAiEditPipeline() {
  const draftCard = document.getElementById('sec-draft');
  const requestCard = document.getElementById('sec-request');
  const aiEditCard = document.getElementById('sec-ai-edit');

  const draftText = draftCard.querySelector('.section-textarea').value.trim();
  const requestText = requestCard.querySelector('.section-textarea').value.trim();
  const aiTextarea = aiEditCard.querySelector('.section-textarea');

  if (!draftText) {
    alert('AI 수정을 위해 [신규 글] 내용을 입력해 주세요.');
    return;
  }

  aiTextarea.value = 'Gemini API 호출 및 글 다듬기 진행 중...';
  // 실제 연동 시: fetch Google Gemini API Pipeline 호출
  setTimeout(() => {
    aiTextarea.value = `[AI 수정 완료]\n요청 사항(${requestText || '기본 다듬기'})을 반영하여 교정된 글입니다.\n\n` + draftText;
    updateWordCount(aiTextarea);
    autoResizeTextarea(aiTextarea);
    STATE.isDirty = true;
  }, 1000);
}

// ============================================================================
// 8. 서브루틴: 데이터 로드 및 렌더링 (Subroutine: Data Mapper)
// ============================================================================
function loadInitialDataMock() {
  STATE.articles = [
    { row: 2, category: '물리칼럼', title: '플라즈마 핵융합 시뮬레이션의 미래', status: '완료', outline: '● 서론: 플라즈마 상태의 이해\n● 본론: Fortran의 계산 효율\n● 결론: 에너지 실증', complete: '플라즈마 연구에 대한 최종 완성본입니다.', draft: '', intent: '연구의 대중화', request: '', aiEdit: '', archive: '' },
    { row: 3, category: '수치해석', title: 'Main-Subroutine 아키텍처 철학', status: '작성', outline: '● 모듈화 필요성', complete: '', draft: '웹 아키텍처에도 단일 책임 서브루틴 분리가 필요하다.', intent: '코드 신뢰성', request: '더 명확한 어조로 수정', aiEdit: '', archive: '' },
    { row: 4, category: '에세이', title: '연구자의 기록 보관소', status: '예정', outline: '', complete: '', draft: '', intent: '', request: '', aiEdit: '', archive: '' }
  ];

  updateCategoryFilterOptions();
  renderArticleList('ALL');
}

function updateCategoryFilterOptions() {
  const filter = document.getElementById('category-filter');
  STATE.categories.clear();
  STATE.articles.forEach(a => { if (a.category) STATE.categories.add(a.category); });

  filter.innerHTML = '<option value="ALL">전체 분류</option>';
  STATE.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    filter.appendChild(opt);
  });
}

function renderArticleList(filterCategory) {
  const container = document.getElementById('article-list-container');
  container.innerHTML = '';

  const filtered = filterCategory === 'ALL' 
    ? STATE.articles 
    : STATE.articles.filter(a => a.category === filterCategory);

  filtered.forEach(art => {
    const item = document.createElement('div');
    item.className = 'article-item';
    if (STATE.activeRowIndex === art.row) item.classList.add('active');

    item.innerHTML = `
      <span class="item-category-tag">${art.category || '미분류'}</span>
      <span class="item-title-text">${art.title}</span>
      <span class="item-status-dot ${art.status}"></span>
    `;

    item.addEventListener('click', () => {
      requestSafeExit(() => {
        selectArticle(art);
      });
    });

    container.appendChild(item);
  });
}

function selectArticle(article) {
  STATE.activeRowIndex = article.row;
  document.getElementById('article-category-input').value = article.category || '';
  document.getElementById('article-title-input').value = article.title || '';

  const statusBtn = document.getElementById('btn-status-toggle');
  statusBtn.dataset.status = article.status || '작성';
  statusBtn.textContent = article.status || '작성';

  SECTION_CONFIGS.forEach(cfg => {
    const card = document.getElementById(cfg.id);
    const ta = card.querySelector('.section-textarea');
    ta.value = article[cfg.key] || '';
    updateWordCount(ta);
    autoResizeTextarea(ta);
  });

  document.querySelectorAll('.article-item').forEach(el => el.classList.remove('active'));
  renderArticleList(document.getElementById('category-filter').value);
  STATE.isDirty = false;
}
