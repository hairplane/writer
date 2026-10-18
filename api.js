/* ==========================================================================
   [BOM] index(v3.3) / core.js(v1.1) / sheet.js(v1.1) / api.js(v1.1) / app.js(v1.2) / core.css(v1.1) / style.css(v1.2)
   - api.js: 자체 버전 식별 전역 변수(_V_API) 선언 및 v1.1 갱신
   ========================================================================== */

window._V_API = "v1.1";

const PUBLIC_SHARED_KEY = "__GEMINI_API_KEY__";
let isPersonalWaitState = false;

// 1. API 키 상태 점검 및 UI 배지 갱신
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

// 2. 키 타이핑 입력 반응
function checkKeyInputState() {
  if (localStorage.getItem("GEMINI_USER_API_KEY") || isPersonalWaitState) return;
  const hasInput = $("apiKeyInput").value.trim().length > 0;
  $("apiSaveBtnText").innerText = hasInput ? "개인 키 설치하기" : "키 설치하기";
  $("dropdownArrow").style.display = hasInput ? "none" : "inline";
  $("apiCancelBtn").style.display = hasInput ? "inline-block" : "none";
}

// 3. 키 설치 버튼 클릭 처리
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

// 4. 공용/개인 키 드롭다운 선택
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

// 5. 키 입력 취소 및 삭제
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

// 6. Gemini 2.5 Flash 퇴고 파이프라인
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
      if (typeof handleFieldInput === 'function') handleFieldInput('aiRefined');
    } else {
      aiRefinedEl.value = "수정안 생성에 실패했습니다.";
    }
  } catch (err) {
    console.error("[api.js] 통신 오류:", err);
    aiRefinedEl.value = "통신 중 오류가 발생했습니다.";
  }
}
