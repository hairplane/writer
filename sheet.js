/* ==========================================================================
   - sheet.js (v2.0): 분류1/분류2 2단계 연동 필터링, 중요/숨김 토글 필터 및 C/D/E/F열 데이터 매핑 구현
   [BOM] index(v4.0) / core.js(v1.2) / sheet.js(v2.0) / api.js(v1.1) / app.js(v1.5) / core.css(v1.2) / style.css(v2.0)
   ========================================================================== */

window._V_SHEET = "v2.0";

const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzFdIdTROi1QhNrIj6bpoiT6vLdkhD2jWoCiDyUSg5Zyj8uGGHVZqjUlbbqz-tmH37rjg/exec";
const POSTS_CACHE_KEY = "WRITER_POSTS_CACHE_V03";

let postListCache = [];
let filterOnlyImportant = false;
let filterIncludeHidden = false;

// 1. 로컬 캐시 불러오기
function loadCachedPosts() {
  const cached = localStorage.getItem(POSTS_CACHE_KEY);
  if (cached) {
    try {
      postListCache = JSON.parse(cached);
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
      localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(postListCache));
      populateCategoryFilters();
      renderPostList();
    }
  };

  const script = document.createElement('script');
  script.id = 'gas_jsonp_script';
  script.src = GAS_ENDPOINT + '?callback=handleGasResponse&_t=' + new Date().getTime();
  document.body.appendChild(script);
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

  // 분류1 옵션 갱신
  cat1Select.innerHTML = '<option value="전체">분류1:전체</option>';
  cat1Set.forEach(function(c1) {
    const opt = document.createElement('option');
    opt.value = c1;
    opt.innerText = c1;
    cat1Select.appendChild(opt);
  });
  cat1Select.value = cat1Set.has(currentCat1) ? currentCat1 : '전체';

  // 분류2 옵션 갱신 (선택된 분류1 기준)
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

// 4. 작성 글 목록 DOM 렌더링
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
    const itemStatus = (item.상황 || item.status || '작성').trim();
    const itemImportant = String(item.중요 || item.important || 'N').trim().toUpperCase() === 'Y';
    const itemHidden = String(item.숨김 || item.hidden || 'N').trim().toUpperCase() === 'Y';
    const itemCat1 = (item.분류1 || item.category1 || item.분류 || item.category || '').trim();
    const itemCat2 = (item.분류2 || item.category2 || '').trim();

    // 1) 상황 필터
    if (statusFilter !== '전체' && itemStatus !== statusFilter) return false;
    // 2) 분류1 필터
    if (cat1Filter !== '전체' && itemCat1 !== cat1Filter) return false;
    // 3) 분류2 필터
    if (cat2Filter !== '전체' && itemCat2 !== cat2Filter) return false;
    // 4) 중요 필터
    if (filterOnlyImportant && !itemImportant) return false;
    // 5) 숨김 필터 (비활성화 상태에서는 숨김 글 제외)
    if (!filterIncludeHidden && itemHidden) return false;

    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<span style="font-size:0.78rem; color:#64748b; padding:8px 10px; display:block;">조건에 맞는 글이 없습니다.</span>';
    return;
  }

  filtered.forEach(function(post) {
    const postId = post.ID || post.id || '';
    const postTitle = post.제목 || post.title || '(제목 없음)';
    const postStatus = (post.상황 || post.status || '작성').trim();
    const isImportant = String(post.중요 || post.important || 'N').trim().toUpperCase() === 'Y';
    const cat1 = (post.분류1 || post.category1 || post.분류 || post.category || '').trim();
    const cat2 = (post.분류2 || post.category2 || '').trim();

    let displayTag = '-';
    if (cat1 && cat2) displayTag = cat1 + '/' + cat2;
    else if (cat1) displayTag = cat1;
    else if (cat2) displayTag = cat2;

    const row = document.createElement('div');
    row.className = 'post-row-item' + (currentPostId === postId ? ' active' : '');

    const titleArea = document.createElement('div');
    titleArea.className = 'post-row-title-area';

    const starHtml = isImportant ? '<span class="post-star-badge" title="중요 글">⭐</span>' : '';
    titleArea.innerHTML = starHtml +
      '<span class="post-category-tag" title="' + displayTag + '">' + displayTag + '</span>' +
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

// 5. 작성/완료/예정 상태 토글 및 시트 비동기 동기화
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
      important: post.중요 || post.important || "N",
      hidden: post.숨김 || post.hidden || "N",
      category1: post.분류1 || post.category1 || "",
      category2: post.분류2 || post.category2 || "",
      title: post.제목 || post.title || "",
      outline: post.글의구성 || post['글의 구성'] || post.outline || ""
    })
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
