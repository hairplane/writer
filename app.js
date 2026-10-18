/* ==========================================================================
   [BOM] index(v3.2) / core.js(v1.0) / sheet.js(v1.0) / api.js(v1.0) / app.js(v1.1) / core.css(v1.0) / style.css(v1.1)
   - style.css: #btn-toggle-all (ON/OFF 버튼) 호버/클릭 스타일 추가 (v1.0 -> v1.1)
   ========================================================================== */

:root {
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --bg-color: #f8fafc;
  --border-color: #cbd5e1;
  --border-light: #e2e8f0;
  --text-main: #0f172a;
  --text-sub: #64748b;
  --app-height: 100dvh;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", sans-serif;
  background-color: var(--bg-color);
  color: var(--text-main);
  line-height: 1.45;
  word-break: keep-all;
  padding: 10px 12px 30px;
  min-height: var(--app-height);
}

.container {
  max-width: 920px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
}

/* 1. Mac 모서리 2단 헤더 */
header.mac-window-header {
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
  border: 1px solid #cbd5e1;
  border-bottom: 2px solid #94a3b8;
}

.header-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid #e2e8f0;
}

.header-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-title-wrap h1 {
  font-size: 0.98rem;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 5px;
}

.header-title-wrap .version-tag {
  font-size: 0.7rem;
  color: var(--primary);
  font-weight: 700;
  background: #ffffff;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid #bfdbfe;
}

.btn-close-app {
  background: none;
  border: none;
  color: #64748b;
  font-size: 1.1rem;
  line-height: 1;
  padding: 2px 4px;
  cursor: pointer;
}
.btn-close-app:hover { color: #dc2626; }

.header-toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  background: #fafafa;
  flex-wrap: wrap;
}

/* ON/OFF 마스터 토글 버튼 스타일 */
.btn-toggle-all {
  background: #ffffff;
  border: 1px solid var(--border-color);
  color: #475569;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.2;
}
.btn-toggle-all:hover {
  background: #f1f5f9;
  border-color: var(--primary);
  color: var(--primary);
}
.btn-toggle-all:active {
  background: #e2e8f0;
}

.traffic-group {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.traffic-btn {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 0.5px solid rgba(0, 0, 0, 0.15);
  transition: all 0.15s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.traffic-btn:hover {
  transform: scale(1.15);
  opacity: 0.9;
}

.tb-postList { background-color: #0284c7; }
.tb-meta { background-color: #0d9488; }
.tb-outline { background-color: #10b981; }
.tb-completed { background-color: #3b82f6; }
.tb-newDraft { background-color: #8b5cf6; }
.tb-intent { background-color: #6366f1; }
.tb-api { background-color: #f59e0b; }
.tb-promptReq { background-color: #ec4899; }
.tb-aiRefined { background-color: #06b6d4; }
.tb-snippets { background-color: #64748b; }

.traffic-btn.is-closed {
  filter: grayscale(0.5) brightness(0.85);
  opacity: 0.7;
}

/* 2. 스퀘어 토글 버튼 및 접힘 뱃지 */
.btn-section-toggle {
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
  background: #ffffff;
  border: 1px solid var(--border-color);
  color: #334155;
  font-size: 0.78rem;
  font-weight: 700;
  font-family: system-ui, -apple-system, sans-serif;
  cursor: pointer;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  margin: 0;
  transition: all 0.15s ease;
}
.btn-section-toggle:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.btn-section-toggle.is-closed {
  background: #fef3c7;
  border-color: #fde68a;
  color: #b45309;
}

.badge-collapsed {
  font-size: 0.68rem;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid #fde68a;
  margin-left: 4px;
}

.header-collapsed-line {
  border-bottom: 1px dashed #cbd5e1 !important;
}

/* 3. 액션 툴바 & 버튼 */
.action-toolbar-clean {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
  flex-shrink: 0;
}

.btn {
  padding: 5px 10px;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-default {
  background: #ffffff;
  border-color: var(--border-color);
  color: var(--text-main);
}
.btn-default:hover { background-color: #f1f5f9; }

.btn-primary {
  background: var(--primary);
  color: #ffffff;
}
.btn-primary:hover { background-color: var(--primary-hover); }

.btn-danger {
  background: #ffffff;
  border-color: #fca5a5;
  color: #dc2626;
}
.btn-danger:hover { background-color: #fef2f2; }

.btn-copy {
  background: #ffffff;
  border: 1px solid var(--border-light);
  color: #475569;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  transition: all 0.15s ease;
}
.btn-copy:hover {
  background: #f1f5f9;
  color: var(--primary);
  border-color: var(--border-color);
}

/* 4. 작성 글 목록 */
.post-list-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.post-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 3px;
  border-bottom: 1px solid var(--border-light);
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}

.post-list-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 0.76rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 3px;
}

.select-filter {
  padding: 2px 4px;
  font-size: 0.76rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  outline: none;
  background: #fff;
  color: #334155;
  font-weight: 600;
}

.post-list-rows {
  display: flex;
  flex-direction: column;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: #ffffff;
  padding-bottom: 2px;
}

.post-row-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 8px;
  min-height: 26px;
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  transition: background-color 0.1s ease;
}
.post-row-item:last-child { border-bottom: none; }
.post-row-item:nth-child(even) { background-color: #eef2f6; }
.post-row-item:hover { background-color: #e2e8f0 !important; }
.post-row-item.active { background-color: #dbeafe !important; }

.post-row-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.82rem;
  color: #334155;
  flex: 1;
}

.post-category-tag {
  display: inline-block;
  font-size: 0.74rem;
  font-weight: 600;
  color: #64748b;
  text-align: left;
}
.post-row-item.active .post-category-tag {
  color: var(--primary);
  font-weight: 700;
}

.post-row-title { font-weight: 500; }
.post-row-title:hover { text-decoration: underline; }
.post-row-item.active .post-row-title {
  color: var(--primary);
  font-weight: 700;
}

.btn-status-toggle {
  flex-shrink: 0;
  padding: 1px 5px;
  font-size: 0.68rem;
  font-weight: 600;
  border-radius: 3px;
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.1s ease;
  margin-left: 6px;
}
.btn-status-toggle.status-writing { background: #e0f2fe; color: #0369a1; border-color: #bae6fd; }
.btn-status-toggle.status-writing:hover { background: #bae6fd; }
.btn-status-toggle.status-done { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
.btn-status-toggle.status-done:hover { background: #bbf7d0; }
.btn-status-toggle.status-plan { background: #fef3c7; color: #b45309; border-color: #fde68a; }
.btn-status-toggle.status-plan:hover { background: #fde68a; }

/* 5. 메타 표 */
.meta-table-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 3px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.meta-grid-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 3px;
}
.meta-grid-table th {
  width: 80px;
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  padding: 4px 6px;
  text-align: center;
  border: 1px solid var(--border-light);
  white-space: nowrap;
}
.meta-grid-table td {
  padding: 3px 6px;
  border: 1px solid var(--border-light);
  background: #ffffff;
}
.meta-grid-table input,
.meta-grid-table textarea {
  width: 100%;
  border: none;
  outline: none;
  font-size: 0.82rem;
  font-family: inherit;
  background: transparent;
  color: #0f172a;
}
.meta-grid-table input:focus,
.meta-grid-table textarea:focus {
  background: #f0f7ff;
}

/* 6. API 설정 */
.api-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.api-box-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 3px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}
.api-header-left {
  display: flex;
  align-items: center;
  gap: 5px;
}
.api-status-badge {
  font-size: 0.74rem;
  font-weight: 700;
  color: #d97706;
  background: #fef3c7;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #fde68a;
}
.btn-key-compact {
  background: #ffffff;
  color: #d97706;
  border: 1px solid #fde68a;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 0.78rem;
  text-decoration: none;
}
.api-content-wrap {
  background: #fffdf5;
  border: 1px solid #fde68a;
  padding: 6px 8px;
  border-radius: 4px;
}
.api-row {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
  flex-wrap: wrap;
}
.api-row input {
  flex: 1;
  min-width: 160px;
  padding: 5px 8px;
  font-size: 0.8rem;
  border: 1px solid #cbd5e1;
  border-radius: 3px;
  outline: none;
  background: #fff;
}
.api-btn-group {
  display: flex;
  gap: 4px;
  align-items: center;
}
.dropdown {
  position: relative;
  display: inline-block;
}
.api-save-btn {
  background: #f57c00;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
}
.api-save-btn:disabled {
  background: #cbd5e1;
  color: #64748b;
  cursor: not-allowed;
}
.api-wait-btn { background: #e67e22 !important; }
.api-cancel-btn {
  background: #64748b;
  color: white;
  border: none;
  padding: 5px 8px;
  border-radius: 3px;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
}
.dropdown-content {
  right: 0;
  top: 110%;
  background-color: #ffffff;
  min-width: 140px;
  box-shadow: 0px 4px 10px rgba(0,0,0,0.1);
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  z-index: 50;
}
.dropdown-content button {
  color: #334155;
  padding: 6px 10px;
  text-align: left;
  background: none;
  border: none;
  width: 100%;
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 600;
  display: block;
}
.api-del-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 5px 8px;
  border-radius: 3px;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
}

/* 7. 집필 영역 공통 */
.editor-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.section-header-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 2px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}
.section-header-left {
  display: flex;
  align-items: center;
  gap: 5px;
}
.section-title {
  font-size: 0.86rem;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 3px;
  transition: all 0.15s ease;
}
.section-title:hover {
  color: var(--primary);
  background: #eff6ff;
  text-decoration: underline;
}
.section-title.is-focused {
  color: var(--primary);
  background: #dbeafe;
}
.editor-content-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
textarea.flat-textarea {
  width: 100%;
  padding: 8px 10px;
  font-size: 0.88rem;
  line-height: 1.5;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: #ffffff;
  outline: none;
  font-family: inherit;
}
textarea.flat-textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}
.editor-bottom-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.72rem;
  color: var(--text-sub);
  padding: 1px 2px;
  flex-wrap: wrap;
  gap: 4px;
  flex-shrink: 0;
}
.stat-info { font-weight: 500; }
.restore-group {
  display: flex;
  gap: 3px;
  margin-left: auto;
}
.btn-restore-icon {
  background: #ffffff;
  border: 1px solid var(--border-light);
  color: #475569;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.btn-restore-icon:hover {
  background-color: #f1f5f9;
  color: #0f172a;
}
.btn-ai-req {
  background: #4f46e5;
  color: #ffffff;
  border: none;
  padding: 2px 7px;
  border-radius: 3px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}
.btn-ai-req:hover { background: #4338ca; }
.btn-append-header {
  background: #0284c7;
  color: #ffffff;
  border: none;
  padding: 2px 7px;
  border-radius: 3px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}
.btn-append-header:hover { background: #0369a1; }

/* 8. 커스텀 모달 오버레이 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}
.modal-card {
  background: #ffffff;
  border-radius: 6px;
  padding: 16px 18px;
  max-width: 340px;
  width: 90%;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  border: 1px solid var(--border-color);
}
.modal-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 6px;
}
.modal-desc {
  font-size: 0.82rem;
  color: #475569;
  margin-bottom: 14px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

/* 9. 모바일 미디어 쿼리 */
@media (max-width: 640px) {
  body { padding: 6px 8px 24px; }
  .container { gap: 8px; }
  .meta-grid-table th { width: 70px; font-size: 0.75rem; }
  .meta-grid-table td { font-size: 0.78rem; }
  .header-toggle-row { gap: 6px; }
  .traffic-group { gap: 5px; }
}
