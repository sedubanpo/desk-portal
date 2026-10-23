import { randomUUID } from "node:crypto";
import { ApiError } from "../http.js";
const root = "desk_portal/routine_distribution";
const fail = (status, message) => {
  throw new ApiError(status, "routine_conflict", message);
};
const clean = (v, n = 200) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
const manager = (i) =>
  i.role === "ADMIN" || i.permissions?.canManageDailyTasks === true;
const actor = (i) => ({
  uid: i.uid,
  name: i.name,
  staffPosition: i.staffPosition || "",
});
const validDate = (v) =>
  /^20\d{2}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;
export function createRoutineMethods({ store, loadStaffDirectory, now }) {
  const staff = async () =>
    (await loadStaffDirectory()).filter(
      (s) => s.uid && s.name && (!s.status || s.status === "ACTIVE"),
    );
  const validateRoles = (v, people) => {
    for (const key of ["responsible", "assistant"])
      if (v[key] && !people.some((s) => s.uid === v[key]))
        fail(400, "활성 근무자를 선택해 주세요.");
    if (v.responsible && v.responsible === v.assistant)
      fail(400, "책임과 보조는 다른 근무자여야 합니다.");
  };
  const edit = async (path, version, fn) => {
    let issue;
    const result = await store.transaction(path, (current) => {
      issue = null;
      if (current === null && Number(version) > 0) {
        issue = new ApiError(
          404,
          "routine_missing",
          "업무를 찾지 못했습니다. 새로고침해 주세요.",
        );
        return null;
      }
      if ((current?.version || 0) !== Number(version)) {
        issue = new ApiError(
          409,
          "routine_conflict",
          "다른 근무자가 변경했습니다. 새로고침 후 다시 선택해 주세요.",
        );
        return;
      }
      try {
        return fn(current);
      } catch (e) {
        issue = e;
        return;
      }
    });
    if (issue) throw issue;
    return result;
  };
  return {
    async getDeskRoutineBoard(p = {}, i) {
      if (!validDate(p.date)) fail(400, "날짜를 확인해 주세요.");
      const [templates, day, people, schedule] = await Promise.all([
        store.get(root + "/templates"),
        store.get(root + "/days/" + p.date),
        staff(),
        store.get("desk_portal/monthly_schedule/" + p.date.slice(0, 7)),
      ]);
      return {
        success: true,
        templates: Object.values(templates || {}).filter((t) => !t.deletedAt),
        day: day || { version: 0, items: {} },
        staff: people,
        canManage: manager(i),
        schedule: schedule || {},
      };
    },
    async saveDeskRoutineTemplate(p = {}, i) {
      const id = p.id || randomUUID();
      if (!/^[\w-]{1,80}$/.test(id)) fail(400, "잘못된 업무입니다.");
      const people = await staff();
      validateRoles(p, people);
      if (
        !clean(p.title) ||
        !["S", "A", "B", "C"].includes(p.grade) ||
        !Array.isArray(p.weekdays) ||
        !p.weekdays.length ||
        p.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
      )
        fail(400, "업무명·등급·반복 요일을 확인해 주세요.");
      const saved = await edit(
        root + "/templates/" + id,
        p.version || 0,
        (current) => {
          if (current?.deletedAt) fail(410, "삭제된 루틴입니다. 새 루틴으로 등록해 주세요.");
          if (current && current.creator.uid !== i.uid && !manager(i))
            fail(403, "작성자 또는 업무 관리자만 원본을 수정할 수 있습니다.");
          return {
            id,
            title: clean(p.title),
            description: clean(p.description, 3000),
            type: clean(p.type, 40) || "일반",
            grade: p.grade,
            weekdays: [...new Set(p.weekdays)],
            responsible: p.responsible || "",
            assistant: p.assistant || "",
            active: p.active !== false,
            creator: current?.creator || actor(i),
            updatedBy: actor(i),
            updatedAt: now(),
            version: (current?.version || 0) + 1,
          };
        },
      );
      return { success: true, template: saved };
    },
    async deleteDeskRoutineTemplate(p = {}, i) {
      if (!/^[\w-]{1,80}$/.test(p.id || "")) fail(400, "잘못된 업무입니다.");
      await edit(root + "/templates/" + p.id, p.version, (current) => {
        if (!current || current.deletedAt) fail(404, "이미 삭제되었거나 없는 루틴입니다.");
        if (current.creator.uid !== i.uid && !manager(i))
          fail(403, "작성자 또는 업무 관리자만 원본을 삭제할 수 있습니다.");
        // Keep a tombstone to reject stale edits; dated snapshots are never touched.
        return {
          id: current.id,
          creator: current.creator,
          version: current.version + 1,
          active: false,
          deletedAt: now(),
          deletedBy: actor(i),
        };
      });
      return { success: true };
    },
    async prepareDeskRoutineDay(p = {}, i) {
      if (!validDate(p.date)) fail(400, "날짜를 확인해 주세요.");
      const templates = Object.values(
          (await store.get(root + "/templates")) || {},
        ),
        people = await staff();
      const schedule = await store.get(
        "desk_portal/monthly_schedule/" + p.date.slice(0, 7),
      );
      const entries = Object.values(schedule?.entries || schedule || {});
      const working = new Set(
        entries
          .filter((e) => e.date === p.date && !e.unavailable)
          .map((e) => e.worker),
      );
      const weekday = new Date(p.date + "T12:00:00+09:00").getUTCDay();
      const day = await store.transaction(
        root + "/days/" + p.date,
        (current) => {
          const d = current || { version: 0, items: {} };
          d.items ||= {};
          let changed = false;
          for (const t of templates.filter(
            (t) => !t.deletedAt && t.active && t.weekdays.includes(weekday),
          )) {
            if (d.items[t.id]) continue;
            const role = (key) => {
              const s = people.find((s) => s.uid === t[key]);
              return s && working.has(s.name) ? s.uid : "";
            };
            d.items[t.id] = {
              ...t,
              responsible: role("responsible"),
              assistant: role("assistant"),
              defaultResponsible: t.responsible,
              defaultAssistant: t.assistant,
              status: "waiting",
              history: [{ at: now(), actor: actor(i), action: "생성" }],
            };
            changed = true;
          }
          if (!changed) return current === null ? null : undefined;
          d.version++;
          return d;
        },
      );
      return { success: true, day: day || { version: 0, items: {} } };
    },
    async updateDeskRoutineDay(p = {}, i) {
      if (!validDate(p.date) || !/^[\w-]{1,80}$/.test(p.id || ""))
        fail(400, "업무와 날짜를 확인해 주세요.");
      const people = await staff();
      const day = await edit(root + "/days/" + p.date, p.version, (d) => {
        const t = d?.items?.[p.id];
        if (!t) fail(404, "업무를 찾지 못했습니다.");
        const before = {
          responsible: t.responsible,
          assistant: t.assistant,
          status: t.status,
          grade: t.grade,
        };
        if (p.action === "assign") {
          validateRoles(p, people);
          t.responsible = p.responsible || "";
          t.assistant = p.assistant || "";
        } else if (p.action === "status") {
          if (![t.responsible, t.assistant].includes(i.uid) && !manager(i))
            fail(403, "책임·보조 담당자만 완료 상태를 변경할 수 있습니다.");
          if (!["waiting", "doing", "done", "excluded"].includes(p.status))
            fail(400, "상태를 확인해 주세요.");
          if (p.status === "excluded" && !clean(p.reason))
            fail(400, "제외 사유를 입력해 주세요.");
          t.status = p.status;
          t.reason = clean(p.reason, 500);
          if (p.status !== "done") delete t.completed;
          if (p.status === "done")
            t.completed = {
              at: now(),
              actor: actor(i),
              role:
                t.responsible === i.uid
                  ? "책임"
                  : t.assistant === i.uid
                    ? "보조"
                    : "관리자",
            };
        } else if (p.action === "grade") {
          if (!["S", "A", "B", "C"].includes(p.grade))
            fail(400, "등급을 확인해 주세요.");
          t.grade = p.grade;
        } else fail(400, "지원하지 않는 변경입니다.");
        t.history ||= [];
        t.history.push({
          at: now(),
          actor: actor(i),
          action: p.action,
          before,
          after: {
            responsible: t.responsible,
            assistant: t.assistant,
            status: t.status,
            grade: t.grade,
          },
          reason: t.reason || "",
        });
        if (t.history.length > 300)
          fail(400, "변경 이력 한도에 도달했습니다. 관리자에게 문의해 주세요.");
        d.version++;
        return d;
      });
      return { success: true, day };
    },
  };
}
