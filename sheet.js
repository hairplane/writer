/* ==========================================================================
- sheet.js (v3.0): 줄바꿈 가능 영역 테두리 하이라이트 및 실시간 플로팅 안정화
[BOM] index(v4.4) / core.js(v1.2) / sheet.js(v3.0) / api.js(v1.1) / app.js(v2.3) / core.css(v1.2) / style.css(v2.6)
========================================================================== */

window._V_SHEET = "v3.0";

const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzFdIdTROi1QhNrIj6bpoiT6vLdkhD2jWoCiDyUSg5Zyj8uGGHVZqjUlbbqz-tmH37rjg/exec";
const POSTS_CACHE_KEY = "WRITER_POSTS_CACHE_V03";

let postListCache = [];
let filterOnlyImportant = false;
let filterOnlyHidden = false; // 선글라스 버튼: 꺼짐(공개글만), 켜짐(숨김글도 포함하여 전체 표시)

// 작성 글 목록 취소/복원 히스토리 스택
let postListHistory = [];
let postListSavedSnapshot = null;

// 드래그 앤 드롭 상태 관리 변수
let draggedPostId = null;

// 터치 드래그용 상태 추적 변수
let touchActiveRow = null;
let touchStartY = 0;
let touchCurrentTargetRow = null;
let touchInsertBefore = false;

// 1. 로컬 캐시 불러오기
function loadCachedPosts() {
  const cached = localStorage.getItem(POSTS_CACHE_KEY);
  if (cached) {
    try {
      postListCache = JSON.parse(cached);
      sortPostsByOrder();
      initPostListHistory();
      populateCategoryFilters();
      renderPostList();
    } catch (e) {
      console.error("[sheet.js] 캐시 파싱 에러:", e);
    }
  }
}

// 2. 구글 시트 JSONP 데이터 요청
function fetchSheetPosts() {
  const oldScript = document.getElementById('gas_jsonp_script');
  if (oldScript) oldScript.remove();

  window.handleGasResponse = function(response) {
    if (response && response.status === "success" && response.data) {
      postListCache = response.data;
      sortPostsByOrder();
      localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
      initPostListHistory();
      populateCategoryFilters();
      renderPostList();
    }
  };

  const script = document.createElement('script');
  script.id = 'gas_jsonp_script';
  script.src = GAS_ENDPOINT + '?callback=handleGasResponse&_t=' + new Date().getTime();
  document.body.appendChild(script);
}

// 2-1. 순서 기준 정렬 헬퍼
function sortPostsByOrder() {
  postListCache.sort(function(a, b) {
    const orderA = a.순서 !== undefined && a.순서 !== "" ? Number(a.순서) : 999999;
    const orderB = b.순서 !== undefined && b.순서 !== "" ? Number(b.순서) : 999999;
    return orderA - orderB;
  });
}

// 2-2. 목록 히스토리 초기화 및 버튼 비활성화 상태 갱신
function initPostListHistory() {
  const snapshotStr = JSON.stringify(postListCache);
  postListSavedSnapshot = snapshotStr;
  postListHistory = [snapshotStr];
  updatePostListToolbarButtons();
}

function pushPostListHistory() {
  const currentSnap = JSON.stringify(postListCache);
  if (postListHistory[postListHistory.length - 1] !== currentSnap) {
    postListHistory.push(currentSnap);
    if (postListHistory.length > 50) postListHistory.shift();
  }
  updatePostListToolbarButtons();
}

function updatePostListToolbarButtons() {
  const undoBtn = $('btn-undo-postList');
  const restoreBtn = $('btn-restore-postList');
  if (!undoBtn || !restoreBtn) return;

  const canUndo = postListHistory.length > 1;
  const currentSnap = JSON.stringify(postListCache);
  const canRestore = postListSavedSnapshot && (currentSnap !== postListSavedSnapshot);

  undoBtn.disabled = !canUndo;
  restoreBtn.disabled = !canRestore;
}

// 2-3. 목록 창 취소(Undo) 및 최근 저장 상태로(Restore)
function undoPostList() {
  if (postListHistory.length > 1) {
    postListHistory.pop();
    const prevSnap = postListHistory[postListHistory.length - 1];
    postListCache = JSON.parse(prevSnap);
    sortPostsByOrder();
    localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
    renderPostList();
    updatePostListToolbarButtons();

    postListCache.forEach(function(post) {
      sendPostMetaUpdate(post);
    });
  } else {
    alert('되돌릴 이전 목록 변경 내역이 없습니다.');
  }
}

function restoreSavedPostList() {
  if (!postListSavedSnapshot) return;
  const currentSnap = JSON.stringify(postListCache);
  if (currentSnap === postListSavedSnapshot) {
    return alert('이미 최근 저장된 목록 상태와 동일합니다.');
  }

  postListHistory.push(postListSavedSnapshot);
  postListCache = JSON.parse(postListSavedSnapshot);
  sortPostsByOrder();
  localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
  renderPostList();
  updatePostListToolbarButtons();

  postListCache.forEach(function(post) {
    sendPostMetaUpdate(post);
  });
}

// 3. 분류1 및 분류2 드롭다운 동적 생성 및 연동
function populateCategoryFilters() {
  const cat1Select = $('category1Filter');
  const cat2Select = $('category2Filter');
  if (!cat1Select || !cat2Select) return;

  const currentCat1 = cat1Select.value || '전체';
  const currentCat2 = cat2Select.value || '전체';

  const cat1Set = new Set();
  postListCache.forEach(function(item) {
    const c1 = (item.분류1 || item.category1 || item.분류 || item.category || '').trim();
    if (c1) cat1Set.add(c1);
  });

  cat1Select.innerHTML = '<option value="전체">분류1:전체</option>';
  cat1Set.forEach(function(c1) {
    const opt = document.createElement('option');
    opt.value = c1;
    opt.innerText = c1;
    cat1Select.appendChild(opt);
  });
  cat1Select.value = cat1Set.has(currentCat1) ? currentCat1 : '전체';

  updateCategory2Options(currentCat2);
}

function updateCategory2Options(targetValue) {
  const cat1Select = $('category1Filter');
  const cat2Select = $('category2Filter');
  if (!cat1Select || !cat2Select) return;

  const selectedCat1 = cat1Select.value;
  const cat2Set = new Set();

  postListCache.forEach(function(item) {
    const c1 = (item.분류1 || item.category1 || item.분류 || item.category || '').trim();
    const c2 = (item.분류2 || item.category2 || '').trim();
    if (!c2) return;
    if (selectedCat1 === '전체' || c1 === selectedCat1) {
      cat2Set.add(c2);
    }
  });

  cat2Select.innerHTML = '<option value="전체">분류2:전체</option>';
  cat2Set.forEach(function(c2) {
    const opt = document.createElement('option');
    opt.value = c2;
    opt.innerText = c2;
    cat2Select.appendChild(opt);
  });

  const preferredVal = targetValue || cat2Select.value;
  cat2Select.value = cat2Set.has(preferredVal) ? preferredVal : '전체';
}

// 4. 드래그 중인 항목 주변 행들의 변위(translateY) 및 타깃 테두리 갱신 헬퍼
function updateDynamicRowDisplacements(targetRow, insertBefore) {
  const rows = Array.from(document.querySelectorAll('.post-row-item'));
  const activeIdx = rows.findIndex(function(r) { return r === touchActiveRow; });
  const targetIdx = rows.findIndex(function(r) { return r === targetRow; });

  // 1) 기존 상태 초기화
  rows.forEach(function(r) {
    if (r !== touchActiveRow) {
      r.classList.remove('shift-up', 'shift-down', 'drag-over-top', 'drag-over-bottom');
      r.style.borderColor = '';
      r.style.boxShadow = '';
    }
  });

  if (activeIdx === -1 || targetIdx === -1 || activeIdx === targetIdx) return;

  // 2) 줄바꿈 가능 타깃 행에 뚜렷한 파란색 강조 테두리 적용
  if (targetRow && targetRow !== touchActiveRow) {
    targetRow.style.borderColor = '#2563eb';
    targetRow.style.boxShadow = 'inset 0 0 0 1px #2563eb';
    if (insertBefore) {
      targetRow.classList.add('drag-over-top');
    } else {
      targetRow.classList.add('drag-over-bottom');
    }
  }

  // 3) 주변 행 위치 이동 애니메이션
  let destIdx = targetIdx;
  if (!insertBefore && destIdx < activeIdx) destIdx += 1;
  if (insertBefore && destIdx > activeIdx) destIdx -= 1;

  if (activeIdx < destIdx) {
    for (let i = activeIdx + 1; i <= destIdx; i++) {
      if (rows[i] && rows[i] !== touchActiveRow) rows[i].classList.add('shift-up');
    }
  } else if (activeIdx > destIdx) {
    for (let i = destIdx; i < activeIdx; i++) {
      if (rows[i] && rows[i] !== touchActiveRow) rows[i].classList.add('shift-down');
    }
  }
}

function clearDynamicRowDisplacements() {
  document.querySelectorAll('.post-row-item').forEach(function(el) {
    el.classList.remove('shift-up', 'shift-down', 'drag-over-top', 'drag-over-bottom');
    el.style.borderColor = '';
    el.style.boxShadow = '';
    if (el !== touchActiveRow) {
      el.style.transform = '';
    }
  });
}

// 5. 작성 글 목록 DOM 렌더링 (순서: [⭐/☆] [상황버튼] [제목] [🕶️/👓] [⠿])
function renderPostList() {
  const grid = $('list_postRows') || $('body_postList');
  if (!grid) return;

  const statusFilterEl = $('statusFilter');
  const cat1FilterEl = $('category1Filter');
  const cat2FilterEl = $('category2Filter');

  const statusFilter = statusFilterEl ? statusFilterEl.value : '전체';
  const cat1Filter = cat1FilterEl ? cat1FilterEl.value : '전체';
  const cat2Filter = cat2FilterEl ? cat2FilterEl.value : '전체';

  grid.innerHTML = '';

  const filtered = postListCache.filter(function(item) {
    const itemStatus = (item.상황 || item.status || '작성중').trim();
    const itemImportant = String(item.중요 || item.important || 'N').trim().toUpperCase() === 'Y';
    const itemHidden = String(item.숨김 || item.hidden || 'N').trim().toUpperCase() === 'Y';
    const itemCat1 = (item.분류1 || item.category1 || item.분류 || item.category || '').trim();
    const itemCat2 = (item.분류2 || item.category2 || '').trim();

    if (statusFilter !== '전체' && itemStatus !== statusFilter) return false;
    if (cat1Filter !== '전체' && itemCat1 !== cat1Filter) return false;
    if (cat2Filter !== '전체' && itemCat2 !== cat2Filter) return false;
    if (filterOnlyImportant && !itemImportant) return false;
    if (!filterOnlyHidden && itemHidden) return false;

    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<span style="font-size:0.78rem; color:#64748b; padding:8px 10px; display:block;">조건에 맞는 글이 없습니다.</span>';
    return;
  }

  filtered.forEach(function(post) {
    const postId = post.ID || post.id || '';
    const postTitle = post.제목 || post.title || '(제목 없음)';
    const postStatus = (post.상황 || post.status || '작성중').trim();
    const isImportant = String(post.중요 || post.important || 'N').trim().toUpperCase() === 'Y';
    const isHidden = String(post.숨김 || post.hidden || 'N').trim().toUpperCase() === 'Y';

    const row = document.createElement('div');
    row.className = 'post-row-item' + (currentPostId === postId ? ' active' : '');
    row.setAttribute('data-id', postId);

    // [1] 중요 별표 토글 버튼 (⭐ / ☆)
    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = 'btn-star-toggle ' + (isImportant ? 'star-yellow is-important' : 'star-empty');
    starBtn.innerText = isImportant ? '⭐' : '☆';
    starBtn.title = isImportant ? '중요 해제' : '중요 글로 지정';
    starBtn.onclick = function(e) {
      e.stopPropagation();
      togglePostImportant(post);
    };

    // [2] 상황 뱃지 버튼
    let statusClass = 'status-writing';
    if (postStatus === '완료') statusClass = 'status-done';
    else if (postStatus === '구상중') statusClass = 'status-plan';
    else if (postStatus === '대기중') statusClass = 'status-pending';

    const statusBtn = document.createElement('button');
    statusBtn.type = 'button';
    statusBtn.className = 'btn-status-toggle ' + statusClass;
    statusBtn.innerText = postStatus;
    statusBtn.title = "클릭 시 상황 변경";
    statusBtn.onclick = function(e) {
      e.stopPropagation();
      togglePostStatus(post);
    };

    // [3] 제목 텍스트 영역
    const titleArea = document.createElement('div');
    titleArea.className = 'post-row-title-area';
    titleArea.innerHTML = '<span class="post-row-title" title="' + postTitle + '">' + postTitle + '</span>';

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

    // [4] 숨김 토글 버튼
    const hiddenBtn = document.createElement('button');
    hiddenBtn.type = 'button';
    hiddenBtn.className = 'btn-hidden-toggle' + (isHidden ? ' is-hidden' : '');
    hiddenBtn.innerText = isHidden ? '🕶️' : '👓';
    hiddenBtn.title = isHidden ? '숨김 해제 (공개)' : '숨김 글로 설정';
    hiddenBtn.onclick = function(e) {
      e.stopPropagation();
      togglePostHidden(post);
    };

    // [5] 드래그 핸들 (⠿) - OS 팝업화면 제스처 방지용 draggable=false
    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '⠿';
    dragHandle.title = '끌어서 순서 이동';
    dragHandle.setAttribute('draggable', 'false');

    // 데스크톱 일반 마우스 드래그 fallback
    dragHandle.addEventListener('mousedown', function() {
      dragHandle.setAttribute('draggable', 'true');
    });

    dragHandle.addEventListener('dragstart', function(e) {
      draggedPostId = postId;
      touchActiveRow = row;
      touchStartY = e.clientY;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', postId);
    });

    dragHandle.addEventListener('drag', function(e) {
      if (e.clientY && touchActiveRow) {
        const deltaY = e.clientY - touchStartY;
        touchActiveRow.style.transform = 'translateY(' + deltaY + 'px) scale(1.02)';
      }
    });

    dragHandle.addEventListener('dragend', function() {
      if (touchActiveRow) {
        touchActiveRow.classList.remove('is-dragging');
        touchActiveRow.style.transform = '';
      }
      clearDynamicRowDisplacements();
      dragHandle.setAttribute('draggable', 'false');
      draggedPostId = null;
      touchActiveRow = null;
    });

    row.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = row.getBoundingClientRect();
      const insertBefore = e.clientY < (rect.top + rect.height / 2);
      updateDynamicRowDisplacements(row, insertBefore);
    });

    row.addEventListener('drop', function(e) {
      e.preventDefault();
      if (touchActiveRow) {
        touchActiveRow.classList.remove('is-dragging');
        touchActiveRow.style.transform = '';
      }
      clearDynamicRowDisplacements();
      const targetId = row.getAttribute('data-id');
      if (!draggedPostId || draggedPostId === targetId) return;

      const rect = row.getBoundingClientRect();
      const insertBefore = e.clientY < (rect.top + rect.height / 2);
      handlePostReorder(draggedPostId, targetId, insertBefore, filtered);
    });

    // 모바일 터치 및 PC 에뮬레이터 실시간 플로팅 추적
    dragHandle.addEventListener('touchstart', function(e) {
      e.stopPropagation();
      const touch = e.touches[0];
      draggedPostId = postId;
      touchActiveRow = row;
      touchStartY = touch.clientY;
      row.classList.add('is-dragging');
    }, { passive: false });

    dragHandle.addEventListener('touchmove', function(e) {
      if (!draggedPostId || !touchActiveRow) return;
      if (e.cancelable) e.preventDefault();

      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY;
      touchActiveRow.style.transform = 'translateY(' + deltaY + 'px) scale(1.02)';

      touchActiveRow.style.pointerEvents = 'none';
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      touchActiveRow.style.pointerEvents = '';

      const targetRow = targetEl ? targetEl.closest('.post-row-item') : null;

      if (targetRow && targetRow !== touchActiveRow) {
        const rect = targetRow.getBoundingClientRect();
        touchInsertBefore = touch.clientY < (rect.top + rect.height / 2);
        touchCurrentTargetRow = targetRow;
        updateDynamicRowDisplacements(targetRow, touchInsertBefore);
      } else if (!targetRow) {
        touchCurrentTargetRow = null;
      }
    }, { passive: false });

    dragHandle.addEventListener('touchend', function() {
      if (touchActiveRow) {
        touchActiveRow.classList.remove('is-dragging');
        touchActiveRow.style.transform = '';
      }
      clearDynamicRowDisplacements();

      if (draggedPostId && touchCurrentTargetRow) {
        const targetId = touchCurrentTargetRow.getAttribute('data-id');
        if (targetId && targetId !== draggedPostId) {
          handlePostReorder(draggedPostId, targetId, touchInsertBefore, filtered);
        }
      }

      draggedPostId = null;
      touchActiveRow = null;
      touchCurrentTargetRow = null;
    });

    dragHandle.addEventListener('touchcancel', function() {
      if (touchActiveRow) {
        touchActiveRow.classList.remove('is-dragging');
        touchActiveRow.style.transform = '';
      }
      clearDynamicRowDisplacements();
      draggedPostId = null;
      touchActiveRow = null;
      touchCurrentTargetRow = null;
    });

    row.appendChild(starBtn);
    row.appendChild(statusBtn);
    row.appendChild(titleArea);
    row.appendChild(hiddenBtn);
    row.appendChild(dragHandle);

    grid.appendChild(row);
  });
}

// 4-1. 슬롯 맞교환 순서 재배치 로직
function handlePostReorder(sourceId, targetId, insertBefore, currentFilteredList) {
  const visibleList = currentFilteredList.slice();
  const srcIdx = visibleList.findIndex(function(p) { return (p.ID || p.id) === sourceId; });
  const tgtIdx = visibleList.findIndex(function(p) { return (p.ID || p.id) === targetId; });

  if (srcIdx === -1 || tgtIdx === -1) return;

  const slotNumbers = visibleList.map(function(p, i) {
    return p.순서 !== undefined && p.순서 !== "" ? Number(p.순서) : (i + 1);
  }).sort(function(a, b) { return a - b; });

  const itemToMove = visibleList.splice(srcIdx, 1)[0];
  let destIdx = visibleList.findIndex(function(p) { return (p.ID || p.id) === targetId; });
  if (!insertBefore) destIdx += 1;
  visibleList.splice(destIdx, 0, itemToMove);

  visibleList.forEach(function(post, idx) {
    post.순서 = slotNumbers[idx];
  });

  sortPostsByOrder();
  localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
  pushPostListHistory();
  renderPostList();

  visibleList.forEach(function(post) {
    sendPostMetaUpdate(post);
  });
}

// 5. 상황 토글
function togglePostStatus(post) {
  const current = (post.상황 || post.status || '작성중').trim();
  let nextStatus = '구상중';
  if (current === '구상중') nextStatus = '대기중';
  else if (current === '대기중') nextStatus = '작성중';
  else if (current === '작성중') nextStatus = '완료';
  else if (current === '완료') nextStatus = '구상중';

  post.상황 = nextStatus;
  post.status = nextStatus;

  if (currentPostId === (post.ID || post.id)) {
    currentPostStatus = nextStatus;
  }

  localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
  pushPostListHistory();
  renderPostList();
  sendPostMetaUpdate(post);
}

// 5-1. 중요 토글 (⭐ <-> ☆)
function togglePostImportant(post) {
  const current = String(post.중요 || post.important || 'N').trim().toUpperCase();
  const next = current === 'Y' ? 'N' : 'Y';

  post.중요 = next;
  post.important = next;

  if (currentPostId === (post.ID || post.id)) {
    const chk = $('postImportant');
    if (chk) chk.checked = (next === 'Y');
  }

  localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
  pushPostListHistory();
  renderPostList();
  sendPostMetaUpdate(post);
}

// 5-2. 숨김 토글 (🕶️ <-> 👓)
function togglePostHidden(post) {
  const current = String(post.숨김 || post.hidden || 'N').trim().toUpperCase();
  const next = current === 'Y' ? 'N' : 'Y';

  post.숨김 = next;
  post.hidden = next;

  if (currentPostId === (post.ID || post.id)) {
    const chk = $('postHidden');
    if (chk) chk.checked = (next === 'Y');
  }

  localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
  pushPostListHistory();
  renderPostList();
  sendPostMetaUpdate(post);
}

// 5-3. 메타/순서 업데이트 전용 구글 시트 백그라운드 전송
function sendPostMetaUpdate(post) {
  fetch(GAS_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ID: post.ID || post.id,
      id: post.ID || post.id,
      순서: post.순서 !== undefined ? post.순서 : "",
      status: post.상황 || post.status || "작성중",
      important: post.중요 || post.important || "N",
      hidden: post.숨김 || post.hidden || "N",
      category1: post.분류1 || post.category1 || "",
      category2: post.분류2 || post.category2 || "",
      title: post.제목 || post.title || "",
      startDate: post.작성시작일 || post['작성 시작일'] || post.startDate || "",
      endDate: post.작성완료일 || post['작성 완료일'] || post.endDate || "",
      summary: post.요약 || post.summary || "",
      outline: post.글의구성 || post['글의 구성'] || post['글의\n구성'] || post.outline || "",
      completed: post.완성글 || post['완성 글'] || post['완성\n글'] || post.completed || "",
      newDraft: post.신규글 || post['신규 글'] || post['신규\n글'] || post.newDraft || "",
      intent: post.글의의도 || post['글의 의도'] || post['글의\n의도'] || post.intent || "",
      promptReq: post.요청내용 || post['요청 내용'] || post['요청\n내용'] || post.promptReq || "",
      aiRefined: post.AI수정글 || post['AI 수정 글'] || post['AI수정 글'] || post.aiRefined || "",
      snippets: post.보관글 || post['보관 글'] || post['보관\n글'] || post.snippets || ""
    })
  }).catch(function(err) {
    console.warn("[sheet.js] 메타 백그라운드 동기화 실패:", err);
  });
}

// 6. 구글 시트로 현재 작업 전체 전송
function syncPostToSheet(payload) {
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
    console.error("[sheet.js] 구글 시트 저장 통신 오류:", err);
  }
}
