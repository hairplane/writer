/* ==========================================================================
   [BOM] index(v3.3) / core.js(v1.1) / sheet.js(v1.1) / api.js(v1.1) / app.js(v1.2) / core.css(v1.1) / style.css(v1.2)
   - sheet.js: 자체 버전 식별 전역 변수(_V_SHEET) 선언 및 v1.1 갱신
   ========================================================================== */

window._V_SHEET = "v1.1";

const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzFdIdTROi1QhNrIj6bpoiT6vLdkhD2jWoCiDyUSg5Zyj8uGGHVZqjUlbbqz-tmH37rjg/exec";
const POSTS_CACHE_KEY = "WRITER_POSTS_CACHE_V03";

let postListCache = [];

// 1. 캐시 불러오기
function loadCachedPosts() {
  const cached = localStorage.getItem(POSTS_CACHE_KEY);
  if (cached) {
    try {
      postListCache = JSON.parse(cached);
      populateCategoryFilter();
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
      populateCategoryFilter();
      renderPostList();
    }
  };

  const script = document.createElement('script');
  script.id = 'gas_jsonp_script';
  script.src = GAS_ENDPOINT + '?callback=handleGasResponse&_t=' + new Date().getTime();
  document.body.appendChild(script);
}

// 3. 카테고리 필터 드롭다운 구성
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

// 4. 작성 글 목록 DOM 렌더링
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
      category: post.분류 || post.category || '',
      title: post.제목 || post.title || '',
      outline: post.글의구성 || post['글의 구성'] || post.outline || ''
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
