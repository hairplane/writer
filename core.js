/* ==========================================================================
   core.js v1.0: 시스템 불변 프레임워크 엔진
   - 뷰포트 높이 실시간 보정 & 브라우저 뒤로가기 가로채기
   - 단독 집중 모드(Focus View) 상태 머신
   - 글자 수 통계, 불릿 들여쓰기, Undo/Redo 버퍼 엔진
   ========================================================================== */

// 1. DOM 셀렉터 단축키
const $ = function(id) {
  return document.getElementById(id);
};

// 2. 동적 뷰포트 높이 계산 (--app-height)
function initAppHeightEngine() {
  function updateHeight() {
    if (window.visualViewport) {
      document.documentElement.style.setProperty('--app-height', `${window.visualViewport.height}px`);
    } else {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    }
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateHeight);
    window.visualViewport.addEventListener('scroll', updateHeight);
  } else {
    window.addEventListener('resize', updateHeight);
  }
  updateHeight();
}

// 3. 텍스트에어리어 동적 높이 조절
function autoResizeTextarea(textarea, minH) {
  if (!textarea || document.body.classList.contains('mode-focus')) return;
  const baseH = minH || 50;
  textarea.style.height = 'auto';
  textarea.style.height = Math.max(textarea.scrollHeight, baseH) + 'px';
}

// 4. 클립보드 원클릭 복사 엔진
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

// 5. 엔터 입력 시 불릿(●) 자동 들여쓰기
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

// 6. 단독 집중 모드 (Focus View) 전환 상태 머신
function executeToggleFocusView(key, allKeys, configs, currentFocusedKey, manageHistory, onFocusExit, onFocusEnter) {
  if (currentFocusedKey === key) {
    document.body.classList.remove('mode-focus');
    allKeys.forEach(function(k) {
      const sec = $('sec_' + k);
      if (sec) {
        sec.style.display = (k === 'meta') ? 'block' : 'flex';
        sec.classList.remove('is-focused-section');
      }
      const titleEl = $('title_' + k);
      if (titleEl) titleEl.classList.remove('is-focused');
    });
    const actionToolbar = $('mainActionToolbar');
    if (actionToolbar) actionToolbar.style.display = 'flex';
    
    if (manageHistory && history.state && history.state.focusView) {
      history.back();
    }
    if (onFocusExit) onFocusExit();
    return null;
  } else {
    document.body.classList.add('mode-focus');
    allKeys.forEach(function(k) {
      const sec = $('sec_' + k);
      if (sec) {
        if (k === key) {
          sec.style.display = (k === 'meta') ? 'block' : 'flex';
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

    const bodyEl = $('body_' + key);
    if (bodyEl && bodyEl.style.display === 'none') {
      if (typeof toggleSection === 'function') toggleSection(key);
    }
    const cfg = configs.find(function(c) { return c.key === key; });
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
    if (onFocusEnter) onFocusEnter(key);
    return key;
  }
}

// 7. 섹션 접기/펼치기 엔진
function executeToggleSection(key) {
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

// 초기 높이 보정 실행
initAppHeightEngine();
