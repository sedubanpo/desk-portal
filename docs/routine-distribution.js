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
    let gradeFilter = "",
      typeFilter = "",
      workerFilter = "",
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
      '<div class="rd"><header><div><h2>루틴 업무 분배</h2><p>함께 할 일을 모으고, 책임과 보조를 나눠요.</p></div><button data-add>＋ 루틴 등록</button></header><nav><button data-tab="today">오늘의 배정</button><button data-tab="library">루틴 보관함</button><input type="date" aria-label="배정 날짜"><button data-reload>새로고침</button></nav><p role="status" class="rd-message"></p><div class="rd-content"></div><dialog class="rd-dialog"></dialog></div>';
    const box = root.querySelector(".rd-content"),
      message = root.querySelector(".rd-message"),
      dialog = root.querySelector("dialog"),
      input = root.querySelector("input");
    input.value = date;
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
      const stats = `<div class="rd-stats">${esc(date)} · ${all.length}건 · 책임 미배정 ${all.filter((t) => !t.responsible).length} · 보조 미배정 ${all.filter((t) => !t.assistant).length} · 완료 ${all.filter((t) => t.status === "done").length}</div>`;
      if (tab === "library") {
        box.innerHTML =
          '<p>등급 손잡이를 다른 열로 끌거나 등급 버튼을 눌러 변경하세요. 원본 변경은 다음 생성분부터 적용됩니다.</p><div class="rd-columns">' +
          Object.entries(grades)
            .map(
              ([g, label]) =>
                `<section data-grade="${g}"><h3>${g} <small>${label}</small></h3>${data.templates
                  .filter((t) => t.grade === g)
                  .map(
                    (t) =>
                      `<article data-id="${t.id}"><button class="rd-grip" draggable="${canEdit(t)}" data-move="${t.id}" ${canEdit(t) ? "" : "disabled"} aria-label="${esc(t.title)} 등급 변경">⠿ ${g} 등급</button><h4>${esc(t.title)}</h4><p>${esc(t.type)} · ${t.weekdays.map((d) => "일월화수목금토"[d]).join("·")}</p><p>책임 ${identity(t.responsible)}<br>보조 ${identity(t.assistant)}</p><p>작성 ${badge(t.creator.name)}</p><button data-edit="${t.id}" ${canEdit(t) ? "" : "disabled"}>${t.active ? "수정 · 일시 중지" : "중지됨 · 다시 사용"}</button></article>`,
                  )
                  .join("")}</section>`,
            )
            .join("") +
          "</div>";
      } else {
        const shown = all
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
                `<button data-filter="${k}" aria-pressed="${filter === k}">${v}</button>`,
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
          shown
            .map(
              (t) =>
                `<article class="rd-task" data-id="${t.id}"><div><button data-day-grade="${t.id}">${t.grade}</button><strong>${esc(t.title)}</strong><small>${esc(t.type)}</small><details><summary>수행 방법·변경 이력</summary><p>${esc(t.description)}</p><p>작성 ${badge(t.creator.name)}</p>${(t.history || []).map((h) => `<p>${esc(timeLabel(h.at))} · ${esc(h.actor.name)} · ${esc(historyText(h))}</p>`).join("")}</details></div>${["responsible", "assistant"].map((r, i) => `<div><label>${i ? "보조" : "책임"}</label>${t[r] ? `<button data-role="${r}" data-task="${t.id}">${identity(t[r])}</button>` : `<button data-self="${r}" data-task="${t.id}">＋ 내가 맡기</button><button data-role="${r}" data-task="${t.id}">근무자 선택</button>${t[i ? "defaultAssistant" : "defaultResponsible"] ? "<small>기본 담당 비근무 · 재배정 필요</small>" : ""}`}</div>`).join("")}<div><button data-state="${t.id}" ${data.canManage || [t.responsible, t.assistant].includes(uid) ? "" : 'disabled title="책임·보조 담당자가 상태를 변경합니다"'}>${labels[t.status]}</button>${t.status === "done" && t.completed ? `<small>${esc(t.completed.actor.name)} · ${t.completed.role}</small>` : ""}${t.reason ? `<small>${esc(t.reason)}</small>` : ""}</div></article>`,
            )
            .join("") +
          (shown.length
            ? ""
            : '<div class="rd-empty">해당 업무가 없습니다. 보관함에서 반복 요일을 확인하거나 루틴을 등록하세요.</div>');
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
      dialog.innerHTML =
        '<button class="rd-close" type="button">닫기</button>' + html;
      dialog.querySelector(".rd-close").onclick = () => dialog.close();
      dialog.showModal();
    };
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
      if (b.hasAttribute("data-add")) editor();
      if (b.dataset.tab) {
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
