import test from "node:test";
import assert from "node:assert/strict";
import { createRoutineMethods } from "../src/desk/routines.js";
function setup() {
  const db = {},
    staff = [
      { uid: "a", name: "가상직원", status: "ACTIVE" },
      { uid: "b", name: "검증직원", status: "ACTIVE" },
    ];
  const store = {
    get: async (p) =>
      structuredClone(
        db[p] ||
          Object.fromEntries(
            Object.entries(db)
              .filter(([k]) => k.startsWith(p + "/"))
              .map(([k, v]) => [k.slice(p.length + 1), v]),
          ),
      ),
    transaction: async (p, fn) => {
      const next = fn(structuredClone(db[p] || null));
      if (next !== undefined) db[p] = next;
      return structuredClone(db[p] || null);
    },
  };
  const api = createRoutineMethods({
    store,
    loadStaffDirectory: async () => staff,
    now: () => "2026-10-23T05:00:00Z",
  });
  const a = { uid: "a", name: "가상직원", role: "STAFF" },
    b = { uid: "b", name: "검증직원", role: "STAFF" };
  db["desk_portal/monthly_schedule/2026-10"] = {
    entries: { a: { date: "2026-10-23", worker: a.name } },
  };
  return { api, db, a, b };
}
const template = {
  id: "sample",
  title: "오전 출결 체크",
  grade: "A",
  type: "학생",
  weekdays: [5],
  responsible: "a",
  assistant: "b",
};
test("daily generation is idempotent and snapshots survive template edits", async () => {
  const { api, a } = setup();
  await api.saveDeskRoutineTemplate(template, a);
  let x = await api.prepareDeskRoutineDay({ date: "2026-10-23" }, a);
  assert.equal(x.day.items.sample.responsible, "a");
  assert.equal(x.day.items.sample.assistant, "");
  assert.equal(x.day.version, 1);
  x = await api.prepareDeskRoutineDay({ date: "2026-10-23" }, a);
  assert.equal(x.day.version, 1);
  await api.saveDeskRoutineTemplate(
    { ...template, title: "수정", version: 1 },
    a,
  );
  x = await api.prepareDeskRoutineDay({ date: "2026-10-23" }, a);
  assert.equal(x.day.items.sample.title, template.title);
  assert.equal(
    Object.keys(
      (await api.prepareDeskRoutineDay({ date: "2026-10-24" }, a)).day.items,
    ).length,
    0,
  );
});
test("everyone assigns others; helper completes; stale versions and duplicate roles rejected", async () => {
  const { api, a, b } = setup();
  await api.saveDeskRoutineTemplate(template, a);
  await api.prepareDeskRoutineDay({ date: "2026-10-23" }, a);
  let x = await api.updateDeskRoutineDay(
    {
      date: "2026-10-23",
      id: "sample",
      version: 1,
      action: "assign",
      responsible: "a",
      assistant: "b",
    },
    b,
  );
  assert.equal(x.day.version, 2);
  await assert.rejects(
    api.updateDeskRoutineDay(
      {
        date: "2026-10-23",
        id: "sample",
        version: 1,
        action: "assign",
        responsible: "b",
      },
      b,
    ),
    /다른 근무자/,
  );
  x = await api.updateDeskRoutineDay(
    {
      date: "2026-10-23",
      id: "sample",
      version: 2,
      action: "status",
      status: "done",
    },
    b,
  );
  assert.equal(x.day.items.sample.completed.role, "보조");
  await assert.rejects(
    api.updateDeskRoutineDay(
      {
        date: "2026-10-23",
        id: "sample",
        version: 3,
        action: "assign",
        responsible: "a",
        assistant: "a",
      },
      a,
    ),
    /다른 근무자/,
  );
});
test("non-author cannot edit templates, inactive assignee rejected and exclusions require reason", async () => {
  const { api, a, b } = setup();
  await api.saveDeskRoutineTemplate(template, a);
  await assert.rejects(
    api.saveDeskRoutineTemplate({ ...template, version: 1 }, b),
    /작성자/,
  );
  await assert.rejects(
    api.saveDeskRoutineTemplate({ ...template, responsible: "unknown" }, a),
    /활성/,
  );
  await api.prepareDeskRoutineDay({ date: "2026-10-23" }, a);
  await assert.rejects(
    api.updateDeskRoutineDay(
      {
        date: "2026-10-23",
        id: "sample",
        version: 1,
        action: "status",
        status: "excluded",
      },
      a,
    ),
    /사유/,
  );
  await assert.rejects(
    api.getDeskRoutineBoard({ date: "2026-02-30" }, a),
    /날짜/,
  );
});

test("reopening clears completion and swapping preserves distinct roles with undo", async () => {
  const { api, a, b } = setup();
  await api.saveDeskRoutineTemplate(template, a);
  await api.prepareDeskRoutineDay({ date: "2026-10-23" }, a);
  await api.updateDeskRoutineDay(
    {
      date: "2026-10-23",
      id: "sample",
      version: 1,
      action: "assign",
      responsible: "a",
      assistant: "b",
    },
    a,
  );
  await api.updateDeskRoutineDay(
    {
      date: "2026-10-23",
      id: "sample",
      version: 2,
      action: "status",
      status: "done",
    },
    b,
  );
  let x = await api.updateDeskRoutineDay(
    {
      date: "2026-10-23",
      id: "sample",
      version: 3,
      action: "status",
      status: "doing",
    },
    a,
  );
  assert.equal(x.day.items.sample.completed, undefined);
  x = await api.updateDeskRoutineDay(
    {
      date: "2026-10-23",
      id: "sample",
      version: 4,
      action: "assign",
      responsible: "b",
      assistant: "a",
    },
    a,
  );
  assert.equal(x.day.items.sample.responsible, "b");
  x = await api.updateDeskRoutineDay(
    {
      date: "2026-10-23",
      id: "sample",
      version: 5,
      action: "assign",
      responsible: "a",
      assistant: "b",
    },
    a,
  );
  assert.equal(x.day.items.sample.responsible, "a");
});

test("HTTP auth, routing and author permission are enforced", async () => {
  const { default: request } = await import("supertest");
  const { createApp } = await import("../src/app.js");
  const { api, a } = setup();
  const app = createApp({
    config: { allowedOrigins: [] },
    payrollAccess: {},
    deskHandlers: api,
    verifyIdToken: async (uid) => ({ uid }),
    loadAccount: async (uid) => ({
      account: { role: "STAFF", status: "ACTIVE", name: uid },
      access: { apps: { deskPortal: true } },
    }),
  });
  await request(app)
    .post("/v1/desk/getDeskRoutineBoard")
    .send({ payload: { date: "2026-10-23" } })
    .expect(401);
  await api.saveDeskRoutineTemplate(template, a);
  await request(app)
    .post("/v1/desk/saveDeskRoutineTemplate")
    .set("Authorization", "Bearer b")
    .set("x-idempotency-key", "routine-test-author-0001")
    .send({ payload: { ...template, version: 1 } })
    .expect(403);
  const r = await request(app)
    .post("/v1/desk/prepareDeskRoutineDay")
    .set("Authorization", "Bearer a")
    .set("x-idempotency-key", "routine-test-day-0001")
    .send({ payload: { date: "2026-10-23" } })
    .expect(200);
  assert.equal(r.body.day.items.sample.title, template.title);
});

test("cold RTDB transaction retries null before the actual persisted snapshot", async () => {
  let value = {
    ...template,
    creator: { uid: "a", name: "가상직원" },
    version: 1,
  };
  let noChangeWrites = 0;
  const store = {
    get: async () => ({}),
    transaction: async (_path, fn) => {
      const candidate = fn(null);
      assert.notEqual(
        candidate,
        undefined,
        "cold cache must reach server comparison",
      );
      const next = fn(structuredClone(value));
      if (next !== undefined) value = next;
      else noChangeWrites++;
      return structuredClone(value);
    },
  };
  const api = createRoutineMethods({
    store,
    loadStaffDirectory: async () => [
      { uid: "a", name: "가상직원" },
      { uid: "b", name: "검증직원" },
    ],
    now: () => new Date().toISOString(),
  });
  await api.saveDeskRoutineTemplate(
    { ...template, version: 1, title: "변경 후" },
    { uid: "a", name: "가상직원", role: "STAFF" },
  );
  assert.equal(value.title, "변경 후");
  assert.equal(value.version, 2);
  value = { version: 5, items: { sample: { ...template, status: "done" } } };
  const d = await api.prepareDeskRoutineDay(
    { date: "2026-10-23" },
    { uid: "a", name: "가상직원" },
  );
  assert.equal(d.day.version, 5);
  assert.equal(d.day.items.sample.status, "done");
  assert.equal(noChangeWrites, 1);
});
