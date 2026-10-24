(function () {
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const timeLabel = (at) =>
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(at));
  const grades = {
      S: "최우선 필수",
      A: "당일 필수",
      B: "일반 정기",
      C: "여유 시 수행",
    },
    labels = {
      waiting: "대기",
      doing: "진행 중",
      done: "완료",
      excluded: "오늘 제외",
    };
  function mount(root, { api, uid, badge, infer }) {
    const selected = new Set();
    let gradeFilter = "",
      typeFilter = "",
      workerFilter = "",
      search = "",
      libraryState = "active",
      loading = false;
    let date = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Seoul",
      }).format(new Date()),
      tab = "today",
      filter = "all",
      data = null,
      epoch = 0,
      busy = false,
      disposed = false,
      undo = null;
    root.innerHTML =
      '<div class="rd"><header><div><h2>루틴 업무 분배</h2><p>함께 할 일을 모으고, 책임과 보조를 나눠요.</p></div><button class="rd-primary" data-add>루틴 등록</button></header><nav aria-label="루틴 보기"><div class="rd-tabs"><button data-tab="today">오늘의 배정</button><button data-tab="library">루틴 보관함</button></div><input type="date" aria-label="배정 날짜"><button data-reload>새로고침</button></nav><div class="rd-searchbar"><label>업무 검색<input type="search" data-search placeholder="업무명이나 수행 방법 검색" autocomplete="off"></label><button data-reset>검색·필터 초기화</button></div><p role="status" class="rd-message"></p><div class="rd-content"></div><dialog class="rd-dialog"></dialog></div>';
    const box = root.querySelector(".rd-content"),
      message = root.querySelector(".rd-message"),
      dialog = root.querySelector("dialog"),
      input = root.querySelector("input");
    input.value = date;
    const searchInput = root.querySelector('[data-search]');
    searchInput.oninput = () => { selected.clear(); search = searchInput.value.trim().toLocaleLowerCase('ko'); if (data) render(); };
    const matches = (t) => !search || (t.title + " " + (t.description || "")).toLocaleLowerCase('ko').includes(search);
    const tell = (s) => (message.textContent = s);
    const items = () => Object.values(data?.day.items || {});
    const person = (id) => data.staff.find((s) => s.uid === id);
    const name = (id) => person(id)?.name || "미배정";
    const historyText = (h) => {
      if (!h.before) return "루틴 생성";
      if (h.action === "assign")
        return (
          "담당 변경 · " +
          name(h.before.responsible) +
          " / " +
          name(h.before.assistant) +
          " → " +
          name(h.after.responsible) +
          " / " +
          name(h.after.assistant)
        );
      if (h.action === "grade")
        return "등급 변경 · " + h.before.grade + " → " + h.after.grade;
      return (
        "상태 변경 · " +
        labels[h.before.status] +
        " → " +
        labels[h.after.status] +
        (h.reason ? " · " + h.reason : "")
      );
    };
    const identity = (id) => (id ? badge(name(id)) : "미배정");
    const canEdit = (t) => data.canManage || t.creator.uid === uid;
    const workNames = () => {
      const s = data.schedule;
      return new Set(
        Object.values(s.entries || s)
          .filter((e) => e.date === date && !e.unavailable)
          .map((e) => e.worker),
      );
    };
    async function load() {
      const e = ++epoch;
      loading = true;
      box.inert = true;
      tell("루틴을 불러오고 있습니다…");
      try {
        const d = await api("getDeskRoutineBoard", { date });
        if (disposed || e !== epoch) return;
        data = d;
        for (const id of selected) if (!data.templates.some(t => t.id === id && canEdit(t))) selected.delete(id);
        if (tab === "today") {
          const p = await api("prepareDeskRoutineDay", { date });
          if (disposed || e !== epoch) return;
          data.day = p.day;
        }
        render();
        tell("");
        return true;
      } catch (e2) {
        if (e === epoch && !disposed) tell(e2.message);
        return false;
      } finally {
        if (e === epoch) {
          loading = false;
          box.inert = false;
        }
      }
    }
    async function save(method, p, text) {
      if (busy) return false;
      busy = true;
      root.classList.add("rd-saving");
      input.disabled = true;
      try {
        await api(method, p);
        undo = null;
        if (disposed) return false;
        if (!(await load())) {
          tell(
            "변경은 저장됐지만 화면 갱신에 실패했습니다. 새로고침해 주세요.",
          );
          return false;
        }
        tell(text);
        return true;
      } catch (e) {
        if (!disposed) {
          undo = null;
          await load();
          tell(e.message);
        }
        return false;
      } finally {
        busy = false;
        root.classList.remove("rd-saving");
        input.disabled = false;
      }
    }
    function render() {
      root
        .querySelectorAll("[data-tab]")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.tab === tab)),
        );
      input.hidden = tab === "library";
      const all = items();
      const completed = all.filter(t => t.status === "done").length;
      const unassigned = all.filter(t => !t.responsible || !t.assistant).length;
      const stats = `<div class="rd-summary"><div><strong>${completed}<span> / ${all.length}</span></strong><span>업무 완료</span></div><div class="rd-completion"><progress value="${completed}" max="${all.length || 1}" aria-label="전체 업무 완료 현황"></progress><span>${all.length ? Math.round(completed / all.length * 100) : 0}% 완료 · ${all.filter(t => t.status === "doing").length}건 진행 중</span></div><button data-filter="unassigned">담당 배정 필요 <b>${unassigned}</b><small>책임 ${all.filter(t => !t.responsible).length} · 보조 ${all.filter(t => !t.assistant).length}</small></button></div>`;
      if (tab === "library") {
        const library = data.templates.filter(matches).filter(t => libraryState === "all" || (libraryState === "active" ? t.active : !t.active));
        const selectable = library.filter(canEdit);
        const picked = data.templates.filter(t => selected.has(t.id) && canEdit(t));
        box.innerHTML =
          `<div class="rd-bulk" role="region" aria-label="루틴 일괄 정리"><label><input type="checkbox" data-select-all ${selectable.length && selectable.every(t => selected.has(t.id)) ? "checked" : ""} ${selectable.length ? "" : "disabled"}>현재 목록 전체 선택 (${selectable.length})</label><strong>${picked.length}개 선택</strong><button data-clear-selection ${picked.length ? "" : "disabled"}>선택 해제</button><button data-bulk="activate" ${picked.some(t => !t.active) ? "" : "disabled"}>선택 업무 사용 중으로</button><button class="rd-danger" data-bulk="delete" ${picked.length ? "" : "disabled"}>선택 업무 삭제</button><small>검색·표시 조건을 바꾸면 선택이 해제됩니다. 수정 권한이 있는 업무만 선택할 수 있습니다.</small></div><div class="rd-library-tools"><div><strong>반복 업무 보관함</strong><p>등급 손잡이를 끌어 이동하세요. 버튼으로도 변경할 수 있습니다.</p><small>원본 변경은 다음 생성분부터 적용됩니다.</small></div><label>표시<select data-library-state aria-label="보관함 표시">${[['active','사용 중'],['paused','일시 중지'],['all','전체 루틴']].map(([v,l])=>`<option value="${v}" ${libraryState===v?'selected':''}>${l}</option>`).join('')}</select></label></div><div class="rd-columns">` +
          Object.entries(grades)
            .map(
              ([g, label]) =>
                `<section data-grade="${g}"><h3><span class="rd-grade" data-level="${g}">${g}</span><span>${label}</span><span class="rd-count">${library.filter(t=>t.grade===g).length}</span></h3>${library
                  .filter((t) => t.grade === g)
                  .map(
                    (t) =>
                      `<article data-id="${t.id}" class="${selected.has(t.id) ? "rd-selected" : ""}"><label class="rd-select"><input type="checkbox" data-select="${t.id}" ${selected.has(t.id) ? "checked" : ""} ${canEdit(t) ? "" : "disabled"} aria-label="${esc(t.title)} 선택">선택</label><button class="rd-grip" draggable="${canEdit(t)}" data-move="${t.id}" ${canEdit(t) ? "" : "disabled"} aria-label="${esc(t.title)} 등급 변경"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M5 3h1m4 0h1M5 8h1m4 0h1M5 13h1m4 0h1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button><h4>${esc(t.title)}</h4><div class="rd-meta"><span>${esc(t.type)}</span><span>${t.weekdays.map((d) => "일월화수목금토"[d]).join("·")}</span>${!t.active ? "<span>일시 중지</span>" : ""}</div><dl class="rd-defaults"><div><dt>기본 책임</dt><dd>${identity(t.responsible)}</dd></div><div><dt>기본 보조</dt><dd>${identity(t.assistant)}</dd></div></dl><div class="rd-card-actions"><button data-edit="${t.id}" ${canEdit(t) ? "" : "disabled"} aria-label="${esc(t.title)} 수정" title="수정"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16 12-12 4 4L8 20H4zM14 6l4 4"/></svg></button><button data-toggle-active="${t.id}" ${canEdit(t) ? "" : "disabled"} aria-label="${esc(t.title)} ${t.active ? "중지" : "다시 사용"}" title="${t.active ? "중지" : "다시 사용"}"><svg viewBox="0 0 24 24" aria-hidden="true">${t.active ? '<path d="M8 5v14M16 5v14"/>' : '<path d="m8 5 11 7-11 7z"/>'}</svg></button><button class="rd-danger" data-delete="${t.id}" ${canEdit(t) ? "" : "disabled"} aria-label="${esc(t.title)} 삭제" title="삭제"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg></button></div></article>`,
                  )
                  .join("")}${library.some(t=>t.grade===g) ? "" : '<p class="rd-column-empty">이 등급의 루틴이 없습니다.<br>손잡이를 끌어 옮길 수 있어요.</p>'}</section>`,
            )
            .join("") +
          "</div>";
      } else {
        const shown = all.filter(matches)
          .filter(
            (t) =>
              (!gradeFilter || t.grade === gradeFilter) &&
              (!typeFilter || t.type === typeFilter) &&
              (!workerFilter ||
                [t.responsible, t.assistant].includes(workerFilter)),
          )
          .filter((t) =>
            filter === "mine"
              ? [t.responsible, t.assistant].includes(uid)
              : filter === "unassigned"
                ? !t.responsible || !t.assistant
                : filter === "done"
                  ? t.status === "done"
                  : true,
          )
          .sort(
            (a, b) =>
              "SABC".indexOf(a.grade) - "SABC".indexOf(b.grade) ||
              a.title.localeCompare(b.title, "ko"),
          );
        box.innerHTML =
          stats +
          '<div class="rd-filters">' +
          [
            ["all", "전체"],
            ["mine", "내 업무"],
            ["unassigned", "미배정"],
            ["done", "완료"],
          ]
            .map(
              ([k, v]) =>
                `<button data-filter="${k}" aria-pressed="${filter === k}">${v} <span class="rd-count">${k === "all" ? all.length : k === "mine" ? all.filter(t=>[t.responsible,t.assistant].includes(uid)).length : k === "unassigned" ? unassigned : completed}</span></button>`,
            )
            .join("") +
          `<select data-query="grade" aria-label="등급 필터"><option value="">모든 등급</option>${Object.keys(
            grades,
          )
            .map(
              (g) =>
                `<option ${gradeFilter === g ? "selected" : ""}>${g}</option>`,
            )
            .join(
              "",
            )}</select><select data-query="type" aria-label="유형 필터"><option value="">모든 유형</option>${[...new Set(all.map((t) => t.type))].map((v) => `<option ${typeFilter === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select><select data-query="worker" aria-label="담당자 필터"><option value="">모든 근무자</option>${data.staff.map((s) => `<option value="${esc(s.uid)}" ${workerFilter === s.uid ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>` +
          `<div class="rd-list-heading"><span>업무 ${shown.length}건</span><span>책임 · 직접 수행</span><span>보조 · 함께 확인</span><span>진행 상태</span></div>` +
          shown
            .map(
              (t) =>
                `<article class="rd-task" data-status="${t.status}" data-id="${t.id}"><div class="rd-task-main"><button class="rd-grade" data-level="${t.grade}" data-day-grade="${t.id}" aria-label="${esc(t.title)} 등급 변경">${t.grade}</button><strong>${esc(t.title)}</strong><small>${esc(t.type)}</small><details><summary>수행 방법·변경 이력</summary><p>${esc(t.description)}</p><p>작성 ${badge(t.creator.name)}</p>${(t.history || []).map((h) => `<p>${esc(timeLabel(h.at))} · ${esc(h.actor.name)} · ${esc(historyText(h))}</p>`).join("")}</details></div>${["responsible", "assistant"].map((r, i) => `<div class="rd-assignment"><label>${i ? "보조" : "책임"}</label>${t[r] ? `<button class="rd-assignee" data-role="${r}" data-task="${t.id}" aria-label="${esc(t.title)} ${i ? "보조" : "책임"} 변경">${identity(t[r])}<span class="rd-change">변경</span></button>` : `<button class="rd-self" data-self="${r}" data-task="${t.id}">＋ 내가 맡기</button><button data-role="${r}" data-task="${t.id}">근무자 선택</button>${t[i ? "defaultAssistant" : "defaultResponsible"] ? "<small>기본 담당 비근무 · 재배정 필요</small>" : ""}`}</div>`).join("")}<div class="rd-state"><label>진행 상태</label><button data-state="${t.id}" ${data.canManage || [t.responsible, t.assistant].includes(uid) ? "" : 'disabled title="책임·보조 담당자가 상태를 변경합니다"'}>${labels[t.status]}</button>${t.status === "done" && t.completed ? `<small>${esc(t.completed.actor.name)} · ${t.completed.role}</small>` : ""}${t.reason ? `<small>${esc(t.reason)}</small>` : ""}</div></article>`,
            )
            .join("") +
          (shown.length
            ? ""
            : `<div class="rd-empty"><strong>${all.length ? '조건에 맞는 업무가 없습니다.' : '이 날짜에 배정된 루틴이 없습니다.'}</strong><p>${all.length ? '검색어나 필터를 바꾸어 확인해 주세요.' : '보관함에서 반복 요일을 확인하거나 새 루틴을 등록하세요.'}</p><button ${all.length ? 'data-reset' : 'data-tab="library"'}>${all.length ? '검색·필터 초기화' : '보관함 열기'}</button></div>`);
      }
      const selectAll = box.querySelector("[data-select-all]");
      if (selectAll) {
        const checks = [...box.querySelectorAll("[data-select]:not(:disabled)")];
        selectAll.indeterminate = checks.some(c => c.checked) && !checks.every(c => c.checked);
      }
      if (undo) {
        const b = document.createElement("button");
        b.textContent = "방금 변경 실행 취소";
        b.onclick = async () => {
          const u = undo;
          undo = null;
          await save(u.method, u.payload, "변경을 되돌렸습니다.");
        };
        box.prepend(b);
      }
    }
    const show = (html) => {
      dialog.removeAttribute("aria-labelledby");
      dialog.innerHTML =
        '<button class="rd-close" type="button">닫기</button>' + html;
      dialog.querySelector(".rd-close").onclick = () => dialog.close();
      dialog.showModal();
    };
    function confirmBulk(action) {
      const targets = data.templates.filter(t => selected.has(t.id) && canEdit(t) && (action === "delete" || !t.active));
      if (!targets.length) return;
      const deleting = action === "delete";
      show(`<h3 id="rd-bulk-title">${targets.length}개 업무를 ${deleting ? "삭제할까요?" : "사용 중으로 전환할까요?"}</h3><ul class="rd-bulk-preview">${targets.map(t => `<li>${esc(t.title)}${deleting ? "" : `<small>반복: ${t.weekdays.map(d => "일월화수목금토"[d]).join("·")}</small>`}</li>`).join("")}</ul><p>${deleting ? "보관함에서 삭제되며 앞으로 자동 배정되지 않습니다. 기존 날짜별 배정·완료 이력은 유지됩니다. 삭제 후에는 새로 등록해야 합니다." : "저장된 반복 요일과 기본 담당자가 적용됩니다. 기존 날짜별 배정·완료 이력은 바뀌지 않습니다."}</p><div class="rd-delete-actions"><button data-bulk-cancel>취소</button><button data-bulk-confirm class="${deleting ? "rd-danger" : "rd-primary"}">${targets.length}개 ${deleting ? "삭제" : "사용 중으로 전환"}</button></div>`);
      dialog.setAttribute("aria-labelledby", "rd-bulk-title");
      dialog.querySelector('[data-bulk-cancel]').onclick = () => dialog.close();
      dialog.querySelector('[data-bulk-cancel]').focus();
      dialog.querySelector('[data-bulk-confirm]').onclick = async () => {
        if (busy) return;
        dialog.close();
        busy = true;
        root.classList.add('rd-saving');
        input.disabled = true;
        searchInput.disabled = true;
        box.inert = true;
        undo = null;
        let succeeded = 0;
        const failed = [];
        try {
          for (const t of targets) {
            if (disposed) break;
            tell(`${targets.length}개 중 ${succeeded + failed.length + 1}번째 처리 중…`);
            try {
              await api(deleting ? 'deleteDeskRoutineTemplate' : 'saveDeskRoutineTemplate', deleting ? {id:t.id, version:t.version} : {...t, active:true});
              selected.delete(t.id);
              succeeded++;
            } catch (e) { failed.push(`${t.title}: ${e.message}`); }
          }
          if (disposed) return;
          const refreshed = await load();
          tell(`${succeeded}개 ${deleting ? '삭제' : '사용 중 전환'} 완료.${failed.length ? ` ${failed.length}개 처리 실패. 실패한 업무는 선택 상태로 남겼습니다. ${failed.join(' / ')}` : ''}${refreshed ? '' : ' 목록 갱신에 실패했습니다. 새로고침해 주세요.'}`);
        } finally {
          busy = false;
          root.classList.remove('rd-saving');
          input.disabled = false;
          searchInput.disabled = false;
          box.inert = false;
        }
      };
    }
    function confirmActive(t) {
      if (!t || !canEdit(t)) return;
      const label = t.active ? "중지" : "다시 사용";
      show(`<h3 id="rd-active-title">이 루틴을 ${label}할까요?</h3><p>${esc(t.title)}</p><p>${t.active ? "앞으로 자동 배정되지 않습니다." : `저장된 반복 요일(${t.weekdays.map(d => "일월화수목금토"[d]).join("·")})에 따라 배정됩니다.`} 기존 날짜별 배정·완료 이력은 유지됩니다.</p><div class="rd-delete-actions"><button data-active-cancel>취소</button><button class="rd-primary" data-active-confirm>${label}</button></div>`);
      dialog.setAttribute('aria-labelledby', 'rd-active-title');
      dialog.querySelector('[data-active-cancel]').onclick = () => dialog.close();
      dialog.querySelector('[data-active-cancel]').focus();
      dialog.querySelector('[data-active-confirm]').onclick = async () => {
        dialog.close();
        await save('saveDeskRoutineTemplate', {...t, active: !t.active}, `루틴을 ${label}했습니다.`);
      };
    }
    function confirmDelete(t) {
      if (!t || !canEdit(t)) return;
      show(`<h3 id="rd-delete-title">루틴을 삭제할까요?</h3><p>${esc(t.title)}</p><p>보관함에서 삭제되며 앞으로 자동 배정되지 않습니다. <strong>기존 날짜별 배정·완료 이력은 그대로 유지됩니다.</strong></p><p>삭제 후에는 새 루틴으로 다시 등록해야 합니다.</p><div class="rd-delete-actions"><button type="button" data-cancel-delete>취소</button><button type="button" class="rd-danger" data-confirm-delete>루틴 삭제</button></div>`);
      dialog.setAttribute("aria-labelledby", "rd-delete-title");
      const cancel = dialog.querySelector("[data-cancel-delete]");
      cancel.onclick = () => dialog.close();
      cancel.focus();
      dialog.querySelector("[data-confirm-delete]").onclick = async () => {
        dialog.close();
        await save("deleteDeskRoutineTemplate", { id: t.id, version: t.version }, "루틴을 삭제했습니다. 기존 배정·완료 이력은 유지됩니다.");
      };
    }
    function choices(selected = "") {
      const working = workNames();
      return (
        '<option value="">미배정</option>' +
        [...data.staff]
          .sort(
            (a, b) =>
              (b.uid === uid) - (a.uid === uid) ||
              Number(working.has(b.name)) - Number(working.has(a.name)),
          )
          .map(
            (s) =>
              `<option value="${esc(s.uid)}" ${s.uid === selected ? "selected" : ""}>${esc(s.name)} ${esc(s.staffPosition)}${s.uid === uid ? " · 나" : ""} · ${working.has(s.name) ? "오늘 근무" : "비근무"} · 책임 ${items().filter((t) => t.responsible === s.uid).length} / 보조 ${items().filter((t) => t.assistant === s.uid).length}</option>`,
          )
          .join("")
      );
    }
    async function assign(t, r, id) {
      const p = {
        date,
        id: t.id,
        version: data.day.version,
        action: "assign",
        responsible: t.responsible,
        assistant: t.assistant,
        [r]: id,
      };
      if (p.responsible && p.responsible === p.assistant) {
        tell(
          "이미 다른 역할을 맡고 있습니다. 담당자 선택에서 역할을 맞바꿔 주세요.",
        );
        return;
      }
      const before = {
        ...p,
        responsible: t.responsible,
        assistant: t.assistant,
      };
      if (await save("updateDeskRoutineDay", p, "담당자를 변경했습니다.")) {
        undo = {
          method: "updateDeskRoutineDay",
          payload: { ...before, version: data.day.version },
        };
        render();
      }
    }
    function role(t, r) {
      show(
        `<h3>${r === "responsible" ? "책임" : "보조"} 변경</h3><p>${esc(t.title)}</p><p>현재 ${identity(t[r])}</p><form><select aria-label="새 담당자">${choices(t[r])}</select><button>담당자 저장</button><button type="button" data-swap>책임 ↔ 보조 맞바꾸기</button></form>`,
      );
      dialog.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        const id = dialog.querySelector("select").value;
        dialog.close();
        await assign(t, r, id);
      };
      dialog.querySelector("[data-swap]").onclick = async () => {
        dialog.close();
        const before = {
          date,
          id: t.id,
          action: "assign",
          responsible: t.responsible,
          assistant: t.assistant,
        };
        if (
          await save(
            "updateDeskRoutineDay",
            {
              ...before,
              version: data.day.version,
              responsible: t.assistant,
              assistant: t.responsible,
            },
            "책임과 보조를 맞바꿨습니다.",
          )
        ) {
          undo = {
            method: "updateDeskRoutineDay",
            payload: { ...before, version: data.day.version },
          };
          render();
        }
      };
    }
    function editor(t = {}) {
      show(
        `<h3>${t.id ? "루틴 수정" : "루틴 등록"}</h3><form><label>업무명<input name="title" required maxlength="200" value="${esc(t.title)}"></label><label>수행 방법·완료 기준<textarea name="description" maxlength="3000">${esc(t.description)}</textarea></label><label>유형 <input name="type" value="${esc(t.type || "일반")}" maxlength="40"></label><small data-auto>제목을 입력하면 자동 분류합니다. 유형을 직접 바꾸면 유지됩니다.</small><label>등급<select name="grade">${Object.entries(
          grades,
        )
          .map(
            ([k, v]) =>
              `<option ${t.grade === k ? "selected" : ""} value="${k}">${k} ${v}</option>`,
          )
          .join(
            "",
          )}</select></label><fieldset><legend>반복 요일</legend>${[0, 1, 2, 3, 4, 5, 6].map((d) => `<label><input type="checkbox" name="weekday" value="${d}" ${(t.weekdays || [1, 2, 3, 4, 5]).includes(d) ? "checked" : ""}>${"일월화수목금토"[d]}</label>`).join("")}</fieldset><label>기본 책임<select name="responsible">${choices(t.responsible)}</select></label><label>기본 보조<select name="assistant">${choices(t.assistant)}</select></label><label><input name="active" type="checkbox" ${t.active !== false ? "checked" : ""}> 사용 중</label><p class="rd-error" role="alert"></p><button>저장</button></form>`,
      );
      const f = dialog.querySelector("form");
      let manual = !!t.id;
      f.elements.type.oninput = () => (manual = true);
      f.elements.title.oninput = () => {
        if (!manual) f.elements.type.value = infer(f.elements.title.value);
      };
      f.onsubmit = async (e) => {
        e.preventDefault();
        const v = new FormData(f),
          p = {
            ...t,
            title: v.get("title"),
            description: v.get("description"),
            type: v.get("type"),
            grade: v.get("grade"),
            weekdays: v.getAll("weekday").map(Number),
            responsible: v.get("responsible"),
            assistant: v.get("assistant"),
            active: v.has("active"),
          };
        if (
          !p.weekdays.length ||
          (p.responsible && p.responsible === p.assistant)
        ) {
          f.querySelector(".rd-error").textContent =
            "반복 요일을 선택하고 책임·보조를 다르게 지정해 주세요.";
          return;
        }
        if (await save("saveDeskRoutineTemplate", p, "루틴을 저장했습니다."))
          dialog.close();
        else f.querySelector(".rd-error").textContent = message.textContent;
      };
    }
    async function grade(t, g, day = false) {
      if (g === t.grade) return;
      const p = day
        ? {
            date,
            id: t.id,
            version: data.day.version,
            action: "grade",
            grade: g,
          }
        : { ...t, grade: g };
      if (
        await save(
          day ? "updateDeskRoutineDay" : "saveDeskRoutineTemplate",
          p,
          `${t.grade} → ${g} 등급으로 이동했습니다.`,
        )
      ) {
        undo = {
          method: day ? "updateDeskRoutineDay" : "saveDeskRoutineTemplate",
          payload: day
            ? { ...p, version: data.day.version, grade: t.grade }
            : {
                ...t,
                version: data.templates.find((x) => x.id === t.id).version,
              },
        };
        render();
      }
    }
    root.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b || busy || loading || !data) return;
      if (b.dataset.bulk) confirmBulk(b.dataset.bulk);
      if (b.hasAttribute("data-clear-selection")) { selected.clear(); render(); }
      if (b.hasAttribute("data-add")) editor();
      if (b.hasAttribute("data-reset")) { selected.clear(); search = ""; searchInput.value = ""; gradeFilter = typeFilter = workerFilter = ""; filter = "all"; libraryState = "active"; render(); }
      if (b.dataset.tab) {
        selected.clear();
        tab = b.dataset.tab;
        undo = null;
        load();
      }
      if (b.hasAttribute("data-reload")) {
        undo = null;
        load();
      }
      if (b.dataset.filter) {
        filter = b.dataset.filter;
        render();
      }
      if (b.dataset.toggleActive) confirmActive(data.templates.find(t => t.id === b.dataset.toggleActive));
      if (b.dataset.delete)
        confirmDelete(data.templates.find((t) => t.id === b.dataset.delete));
      if (b.dataset.edit)
        editor(data.templates.find((t) => t.id === b.dataset.edit));
      const t = items().find((t) => t.id === b.dataset.task);
      if (b.dataset.self) assign(t, b.dataset.self, uid);
      if (b.dataset.role) role(t, b.dataset.role);
      if (b.dataset.move || b.dataset.dayGrade) {
        const day = !!b.dataset.dayGrade,
          t = (day ? items() : data.templates).find(
            (t) => t.id === (b.dataset.dayGrade || b.dataset.move),
          );
        show(
          "<h3>등급 변경</h3>" +
            Object.entries(grades)
              .map(([g, l]) => `<button data-pick="${g}">${g} ${l}</button>`)
              .join(""),
        );
        dialog.querySelectorAll("[data-pick]").forEach(
          (b) =>
            (b.onclick = () => {
              dialog.close();
              grade(t, b.dataset.pick, day);
            }),
        );
      }
      if (b.dataset.state) {
        const t = items().find((t) => t.id === b.dataset.state);
        show(
          `<h3>진행 상태</h3><p>${esc(t.title)}</p><form><select name="status">${Object.entries(
            labels,
          )
            .map(
              ([k, v]) =>
                `<option value="${k}" ${k === t.status ? "selected" : ""}>${v}</option>`,
            )
            .join(
              "",
            )}</select><label>제외 사유<input name="reason" maxlength="500"></label><p class="rd-error" role="alert"></p><button>상태 저장</button></form>`,
        );
        dialog.querySelector("form").onsubmit = async (e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          if (
            f.get("status") === "excluded" &&
            !String(f.get("reason")).trim()
          ) {
            e.target.querySelector(".rd-error").textContent =
              "오늘 제외하는 이유를 입력해 주세요.";
            e.target.elements.reason.focus();
            return;
          }
          tell("");
          dialog.close();
          save(
            "updateDeskRoutineDay",
            {
              date,
              id: t.id,
              version: data.day.version,
              action: "status",
              status: f.get("status"),
              reason: f.get("reason"),
            },
            "상태를 저장했습니다.",
          );
        };
      }
    };
    root.onchange = (e) => {
      if (busy || loading || !data) return;
      if (e.target.dataset.select) {
        const t = data.templates.find(t => t.id === e.target.dataset.select);
        if (t && canEdit(t)) { if (e.target.checked) selected.add(t.id); else selected.delete(t.id); render(); }
      }
      if (e.target.hasAttribute("data-select-all")) {
        for (const t of data.templates.filter(matches).filter(t => canEdit(t) && (libraryState === "all" || (libraryState === "active" ? t.active : !t.active)))) { if (e.target.checked) selected.add(t.id); else selected.delete(t.id); }
        render();
      }
      if (e.target.hasAttribute("data-library-state")) { selected.clear(); libraryState = e.target.value; render(); }
      if (e.target.dataset.query) {
        const q = e.target.dataset.query;
        if (q === "grade") gradeFilter = e.target.value;
        if (q === "type") typeFilter = e.target.value;
        if (q === "worker") workerFilter = e.target.value;
        render();
      }
    };
    input.onchange = () => {
      date = input.value;
      undo = null;
      load();
    };
    root.ondragstart = (e) => {
      const b = e.target.closest("[data-move]");
      if (!b || b.disabled) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", b.dataset.move);
    };
    const clearDrop = () =>
      root
        .querySelectorAll(".rd-drop")
        .forEach((c) => c.classList.remove("rd-drop"));
    root.ondragend = clearDrop;
    root.ondragover = (e) => {
      const col = e.target.closest("[data-grade]");
      if (col && !busy && !loading) {
        e.preventDefault();
        clearDrop();
        col.classList.add("rd-drop");
      }
    };
    root.ondrop = (e) => {
      clearDrop();
      if (busy || loading) return;
      const col = e.target.closest("[data-grade]");
      if (!col) return;
      e.preventDefault();
      const t = data.templates.find(
        (t) => t.id === e.dataTransfer.getData("text/plain"),
      );
      if (t && canEdit(t)) grade(t, col.dataset.grade);
    };
    return {
      load,
      dispose() {
        disposed = true;
        epoch++;
        dialog.close();
        root.replaceChildren();
      },
    };
  }
  window.DeskRoutines = { mount };
  const root = document.querySelector('[data-desk-panel="routines"]');
  let view;
  window.renderDeskRoutines_ = () => {
    if (!view)
      view = mount(root, {
        api: async (method, p) => {
          const r = await runDeskCloudApi_(method, p);
          if (r.success === false)
            throw Error(r.message || "저장하지 못했습니다.");
          return r;
        },
        uid: state.firebaseUser?.uid,
        badge: (name) => getDeskWorkerBadgeHtml_(name),
        infer: inferDeskMemoTypeFromText_,
      });
    view.load();
  };
  initializeDeskFirebaseAuth_().then((auth) =>
    auth?.onAuthStateChanged(() => {
      view?.dispose();
      view = null;
    }),
  );
})();
