/* ==========================================================================
   - sheet.js (v2.1): 분류 텍스트 제거, 별표 고정 박스 왼쪽 정렬, 우측 숨김 뱃지 및 상황 4단계 순환 토글 구현
   [BOM] index(v4.1) / core.js(v1.2) / sheet.js(v2.1) / api.js(v1.1) / app.js(v2.1) / core.css(v1.2) / style.css(v2.1)
   ========================================================================== */

window._V_SHEET = "v2.1";

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
    const itemStatus = (item.상황 || item.status || '작성중').trim();
    const itemImportant = String(item.중요 || item.important || 'N').trim().toUpperCase() === 'Y';
    const itemHidden = String(item.숨김 || item.hidden || 'N').trim().toUpperCase() === 'Y';
    const itemCat1 = (item.분류1 || item.category1 || item.분류 || item.category || '').trim();
    const itemCat2 = (item.분류2 || item.category2 || '').trim();

    if (statusFilter !== '전체' && itemStatus !== statusFilter) return false;
    if (cat1Filter !== '전체' && itemCat1 !== cat1Filter) return false;
    if (cat2Filter !== '전체' && itemCat2 !== cat2Filter) return false;
    if (filterOnlyImportant && !itemImportant) return false;
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
    const postStatus = (post.상황 || post.status || '작성중').trim();
    const isImportant = String(post.중요 || post.important || 'N').trim().toUpperCase() === 'Y';
    const isHidden = String(post.숨김 || post.hidden || 'N').trim().toUpperCase() === 'Y';

    const row = document.createElement('div');
    row.className = 'post-row-item' + (currentPostId === postId ? ' active' : '');

    // 좌측 제목 영역 (별표 고정 박스 + 제목)
    const titleArea = document.createElement('div');
    titleArea.className = 'post-row-title-area';

    const starBox = document.createElement('span');
    starBox.className = 'post-star-box';
    starBox.innerHTML = isImportant ? '⭐' : '';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'post-row-title';
    titleSpan.innerText = postTitle;
    titleSpan.title = postTitle;

    titleArea.appendChild(starBox);
    titleArea.appendChild(titleSpan);

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

    // 우측 그룹: 숨김 뱃지 + 상황 토글 버튼
    const rightGroup = document.createElement('div');
    rightGroup.className = 'post-row-right-group';

    if (isHidden) {
      const hiddenBadge = document.createElement('span');
      hiddenBadge.className = 'post-hidden-badge';
      hiddenBadge.innerText = '👁️';
      hiddenBadge.title = '숨김 글';
      rightGroup.appendChild(hiddenBadge);
    }

    // 상황 4단계 스타일 클래스
    let statusClass = 'status-writing';
    if (postStatus === '구상중') statusClass = 'status-concept';
    else if (postStatus === '대기중') statusClass = 'status-wait';
    else if (postStatus === '완료') statusClass = 'status-done';

    const statusBtn = document.createElement('button');
    statusBtn.type = 'button';
    statusBtn.className = 'btn-status-toggle ' + statusClass;
    statusBtn.innerText = postStatus;
    statusBtn.title = "클릭 시 상황 변경 (구상중 -> 대기중 -> 작성중 -> 완료)";
    statusBtn.onclick = function(e) {
      e.stopPropagation();
      togglePostStatus(post);
    };

    rightGroup.appendChild(statusBtn);

    row.appendChild(titleArea);
    row.appendChild(rightGroup);
    grid.appendChild(row);
  });
}

// 5. 상황 4단계 (구상중 -> 대기중 -> 작성중 -> 완료) 순환 토글 및 시트 비동기 동기화
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
