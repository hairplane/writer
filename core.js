/* ==========================================================================
   - core.js: 리마크 순서 규약 적용 및 최신 BOM 동기화 (v1.1 -> v1.2)
   [BOM] index(v3.5) / core.js(v1.2) / sheet.js(v1.1) / api.js(v1.1) / app.js(v1.4) / core.css(v1.2) / style.css(v1.7)
   ========================================================================== */

window._V_CORE = "v1.2";

// 1. 단축 선택자 유틸리티
function $(id) {
  return document.getElementById(id);
}

// 2. 모바일 브라우저 뷰포트 높이 100dvh 동적 계산
function setAppHeight() {
  const vh = window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${vh}px`);
}
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', setAppHeight);
setAppHeight();

// 3. 텍스트에어리어 자동 높이 조절
function autoResizeTextarea(el, minHeight) {
  if (!el || document.body.classList.contains('mode-focus')) return;
  el.style.height = 'auto';
  const newHeight = Math.max(el.scrollHeight, minHeight || 0);
  el.style.height = `${newHeight}px`;
}

// 4. 개별 섹션 열기/닫기 토글
function executeToggleSection(key) {
  const body = $('body_' + key);
  const arrow = $('arrow_' + key);
  const dot = $('dot_' + key);
  const badge = $('badge_' + key);
  const hdr = $('hdr_' + key);

  if (!body) return;

  const isHidden = body.style.display === 'none';

  if (isHidden) {
    body.style.display = '';
    if (arrow) {
      arrow.innerText = '−';
      arrow.classList.remove('is-closed');
    }
    if (dot) dot.classList.remove('is-closed');
    if (badge) badge.classList.remove('show');
    if (hdr) hdr.classList.remove('header-collapsed-line');
  } else {
    body.style.display = 'none';
    if (arrow) {
      arrow.innerText = '+';
      arrow.classList.add('is-closed');
    }
    if (dot) dot.classList.add('is-closed');
    if (badge) badge.classList.add('show');
    if (hdr) hdr.classList.add('header-collapsed-line');
  }
}

// 5. 단독 집중 모드(Focus View) 토글 엔진
function executeToggleFocusView(key, allKeys, sectionConfigs, currentFocusedKey, manageHistory, onExitFocus, onEnterFocus) {
  const isExiting = (currentFocusedKey === key);

  if (isExiting) {
    document.body.classList.remove('mode-focus');
    allKeys.forEach(k => {
      const sec = $('sec_' + k);
      const title = $('title_' + k);
      if (sec) {
        sec.classList.remove('is-focused-section');
        sec.style.display = '';
      }
      if (title) title.classList.remove('is-focused');
    });
    if (onExitFocus) onExitFocus();
    if (manageHistory && window.history.state && window.history.state.focused) {
      window.history.back();
    }
    return null;
  } else {
    document.body.classList.add('mode-focus');
    allKeys.forEach(k => {
      const sec = $('sec_' + k);
      const title = $('title_' + k);
      if (k === key) {
        if (sec) {
          sec.classList.add('is-focused-section');
          sec.style.display = 'flex';
          const body = $('body_' + k);
          if (body && body.style.display === 'none') executeToggleSection(k);
        }
        if (title) title.classList.add('is-focused');
      } else {
        if (sec) {
          sec.classList.remove('is-focused-section');
          sec.style.display = 'none';
        }
        if (title) title.classList.remove('is-focused');
      }
    });
    if (onEnterFocus) onEnterFocus(key);
    if (manageHistory) {
      window.history.pushState({ focused: key }, '');
    }
    return key;
  }
}

// 6. 글머리 기호(불릿) 자동 완성 핸들러
function handleBulletEnter(e, textarea) {
  if (e.key === 'Enter') {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const lines = text.substring(0, start).split('\n');
    const currentLine = lines[lines.length - 1];

    if (currentLine.trim().startsWith('- ')) {
      e.preventDefault();
      if (currentLine.trim() === '- ') {
        const lineStart = start - currentLine.length;
        textarea.value = text.substring(0, lineStart) + text.substring(end);
        textarea.selectionStart = textarea.selectionEnd = lineStart;
      } else {
        const insertText = '\n- ';
        textarea.value = text.substring(0, start) + insertText + text.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
      }
      textarea.dispatchEvent(new Event('input'));
    }
  }
}

// 7. 클립보드 복사 유틸리티
function copyContent(elemId, btnElem) {
  const target = $(elemId);
  if (!target) return;
  const originalText = btnElem.innerText;

  navigator.clipboard.writeText(target.value || target.innerText || '')
    .then(() => {
      btnElem.innerText = '✓ 복사완료';
      btnElem.style.color = '#16a34a';
      setTimeout(() => {
        btnElem.innerText = originalText;
        btnElem.style.color = '';
      }, 1500);
    })
    .catch(err => {
      console.error('복사 실패:', err);
      alert('클립보드 복사에 실패했습니다.');
    });
}
