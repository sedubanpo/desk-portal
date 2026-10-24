const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"),
  fs = require("fs"),
  http = require("http"),
  path = require("path"),
  assert = require("assert/strict");
(async () => {
  const root = process.cwd() + "/docs";
  const server = http.createServer((req, res) => {
    let f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
    if (req.url === "/") f = path.join(root, "index.html");
    if (!f.startsWith(root) || !fs.existsSync(f)) {
      res.writeHead(404);
      return res.end();
    }
    res.setHeader(
      "Content-Type",
      f.endsWith(".js") || f.endsWith(".mjs")
        ? "text/javascript"
        : f.endsWith(".css")
          ? "text/css"
          : f.endsWith(".html")
            ? "text/html"
            : "image/svg+xml",
    );
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (r) =>
    r.request().url().startsWith(base) ? r.continue() : r.abort(),
  );
  try {
    await page.goto(base);
    await page.waitForFunction(
      () => typeof state !== "undefined" && typeof DeskRoutines !== "undefined",
    );
    await page.evaluate(() => {
      state.firebaseUser = { uid: "me", getIdToken: async () => "synthetic" };
      state.cloudIdentity = { uid: "me", name: "가상직원", role: "STAFF" };
      state.cloudApiReady = true;
      state.activeModule = "expense";
      entryGateEl.style.display = "none";
      document.body.classList.remove("entry-locked");
      window.routineFixture = {
        templates: [],
        day: { version: 1, items: {} },
        staff: [
          { uid: "me", name: "가상직원", staffPosition: "주임" },
          { uid: "other", name: "검증직원", staffPosition: "대리" },
        ],
        schedule: {},
        canManage: false,
      };
      for (const [i, g] of ["S", "A", "B", "C"].entries()) {
        const t = {
          id: "task" + i,
          title: [
            "오전 시간별 출결 체크",
            "수강료 수납 확인",
            "강의실 청소 및 정리",
            "블로그 자료 모으기",
          ][i],
          description: "결과를 확인하고 완료해 주세요.",
          type: ["학생", "수납", "시설", "자료"][i],
          grade: g,
          weekdays: [1, 2, 3, 4, 5],
          responsible: "",
          assistant: "",
          creator: { uid: "me", name: "가상직원" },
          active: true,
          version: 1,
        };
        routineFixture.templates.push(t);
        routineFixture.day.items[t.id] = {
          ...t,
          status: "waiting",
          history: [],
        };
      }
      runDeskCloudApi_ = async (m, p) => {
        const d = routineFixture;
        if (m === "getDeskRoutineBoard") return structuredClone(d);
        if (m === "prepareDeskRoutineDay")
          return { day: structuredClone(d.day) };
        if (m === "updateDeskRoutineDay") {
          Object.assign(d.day.items[p.id], p);
          d.day.version++;
          return { success: true, day: d.day };
        }
        if (m === "deleteDeskRoutineTemplate") {
          if (window.failRoutineId === p.id) throw Error("다른 근무자가 변경했습니다.");
          d.templates = d.templates.filter(t => t.id !== p.id);
          return { success: true };
        }
        if (m === "saveDeskRoutineTemplate") {
          const t = d.templates.find((t) => t.id === p.id);
          Object.assign(t, p, { version: t.version + 1 });
          return { success: true };
        }
        return {
          success: true,
          staff: [],
          tasks: [],
          entries: [],
          records: [],
        };
      };
    });
    await page.locator("[data-desk-tab=routines]").click();
    await page.locator(".rd-task").first().waitFor();
    assert.equal(await page.locator(".rd-task").count(), 4);
    await page.locator('[data-search]').fill('수강료');
    assert.equal(await page.locator('.rd-task').count(), 1);
    await page.locator('[data-search]').fill('없는 업무 검색');
    await page.getByText('조건에 맞는 업무가 없습니다.', {exact:true}).waitFor();
    await page.locator('.rd-searchbar [data-reset]').click();
    assert.equal(await page.locator('.rd-task').count(), 4);
    await page.locator("[data-self=responsible]").first().click();
    await page.waitForFunction(
      () => routineFixture.day.items.task0.responsible === "me",
    );
    await page.locator("[data-state=task0]").click();
    await page
      .locator(".rd-dialog select[name=status]")
      .selectOption("excluded");
    await page.getByRole("button", { name: "상태 저장", exact: true }).click();
    await page
      .getByText("오늘 제외하는 이유를 입력해 주세요.", { exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: path.join(
        process.env.ROUTINE_TEST_OUTPUT || require("os").tmpdir(),
        "routine-desktop.png",
      ),
      fullPage: true,
    });
    await page.locator("[data-tab=library]").click();
    await page.locator("[data-move]").first().waitFor();
    await page.locator('[data-library-state]').selectOption('paused');
    assert.equal(await page.locator('[data-move]').count(), 0);
    await page.locator('[data-library-state]').selectOption('all');
    assert.equal(await page.locator('[data-move]').count(), 4);
    await page.locator('[data-search]').fill('출결');
    assert.equal(await page.locator('[data-move]').count(), 1);
    await page.locator('.rd-searchbar [data-reset]').click();
    await page
      .locator("[data-move=task1]")
      .dragTo(page.locator("[data-grade=S]"));
    await page.waitForFunction(() => routineFixture.templates[1].grade === "S");
    await page.screenshot({
      path: path.join(
        process.env.ROUTINE_TEST_OUTPUT || require("os").tmpdir(),
        "routine-library.png",
      ),
      fullPage: true,
    });
    assert.equal(await page.locator('.rd-columns .rd-creator').count(), 0);
    assert.equal((await page.locator('[data-move=task0]').innerText()).trim(), '');
    await page.locator('[data-toggle-active=task0]').click();
    await page.locator('[data-active-cancel]').click();
    assert.equal(await page.evaluate(() => routineFixture.templates[0].active), true);
    await page.locator('[data-toggle-active=task0]').click();
    await page.locator('[data-active-confirm]').click();
    await page.locator('.rd-saving').waitFor({state:'detached'});
    await page.locator('[data-library-state]').selectOption('all');
    assert.equal(await page.evaluate(() => routineFixture.templates[0].active), false);
    await page.locator('[data-toggle-active=task0]').click();
    await page.locator('[data-active-confirm]').click();
    await page.locator('.rd-saving').waitFor({state:'detached'});
    assert.equal(await page.evaluate(() => routineFixture.templates[0].active), true);
    // Selection is scoped to visible editable cards and clears when filtering.
    await page.locator('[data-select=task0]').check();
    await page.locator('[data-select=task2]').check();
    assert.equal(await page.locator('[data-select-all]').evaluate(e => e.indeterminate), true);
    await page.locator('[data-search]').fill('출결');
    assert.equal(await page.locator('[data-select]:checked').count(), 0);
    await page.locator('[data-select-all]').check();
    assert.equal(await page.locator('[data-select]:checked').count(), 1);
    await page.locator('[data-search]').fill('');
    await page.evaluate(() => {
      routineFixture.templates.forEach(t => t.active = false);
      routineFixture.templates.find(t => t.id === 'task3').creator.uid = 'other';
    });
    await page.locator('.rd [data-reload]').click();
    await page.locator('[data-library-state]').selectOption('all');
    await page.locator('[data-select-all]').check();
    assert.equal(await page.locator('[data-select]:checked').count(), 3);
    assert.equal(await page.locator('[data-select=task3]').isDisabled(), true);
    await page.locator('[data-bulk=activate]').click();
    await page.locator('[data-bulk-cancel]').click();
    assert.equal(await page.evaluate(() => routineFixture.templates.filter(t => t.active).length), 0);
    await page.locator('[data-bulk=activate]').click();
    await page.locator('[data-bulk-confirm]').click();
    await page.waitForFunction(() => routineFixture.templates.filter(t => t.active).length === 3);
    await page.locator('.rd-saving').waitFor({state:'detached'});
    assert.equal(await page.locator('[data-select]:checked').count(), 0);
    // Keep the rest of the original regression fixture editable.
    await page.evaluate(() => { routineFixture.templates.find(t => t.id === 'task3').creator.uid = 'me'; });
    await page.locator('.rd [data-reload]').click();
    await page.locator('[data-select=task0]').check();
    await page.locator('[data-select=task2]').check();
    await page.locator('[data-bulk=delete]').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => routineFixture.templates.length), 4);
    await page.locator('[data-clear-selection]').click();
    // Deletion requires confirmation; cancellation/Escape never mutate data.
    await page.locator('[data-delete=task1]').click();
    await page.getByText('기존 날짜별 배정·완료 이력은 그대로 유지됩니다.', {exact:true}).waitFor();
    await page.getByRole('button', {name:'취소', exact:true}).click();
    assert.equal(await page.locator('[data-delete=task1]').count(), 1);
    await page.locator('[data-delete=task1]').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => routineFixture.templates.length), 4);
    await page.locator('[data-delete=task1]').click();
    await page.getByRole('button', {name:'루틴 삭제', exact:true}).click();
    await page.locator('[data-delete=task1]').waitFor({state:'detached'});
    assert.equal(await page.evaluate(() => routineFixture.templates.length), 3);
    assert.ok(await page.evaluate(() => routineFixture.day.items.task1));
    await page.locator('[data-tab=today]').click();
    await page.locator('.rd-task[data-id=task1]').waitFor();
    assert.equal(await page.locator('.rd-task').count(), 4);
    await page.locator('[data-tab=library]').click();
    await page.locator('[data-delete=task0]').waitFor();
    await page.evaluate(() => { window.failRoutineId = 'task2'; });
    await page.locator('[data-select-all]').check();
    await page.locator('[data-bulk=delete]').click();
    await page.locator('[data-bulk-confirm]').click();
    await page.waitForFunction(() => routineFixture.templates.length === 1);
    await page.locator('.rd-saving').waitFor({state:'detached'});
    assert.equal(await page.locator('[data-select]:checked').count(), 1);
    await page.getByText(/1개 처리 실패/).waitFor();
    await page.evaluate(() => { window.failRoutineId = null; });
    await page.locator('[data-bulk=delete]').click();
    await page.locator('[data-bulk-confirm]').click();
    await page.waitForFunction(() => routineFixture.templates.length === 0);
    await page.locator('.rd-saving').waitFor({state:'detached'});
    assert.equal(await page.evaluate(() => Object.keys(routineFixture.day.items).length), 4);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(
        process.env.ROUTINE_TEST_OUTPUT || require("os").tmpdir(),
        "routine-mobile.png",
      ),
      fullPage: true,
    });
    assert.equal(
      await page
        .locator(".rd")
        .evaluate((e) => e.scrollWidth > e.clientWidth + 1),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS actual app parsing/navigation, role assignment, exclusion error, grade drag, deletion confirmation/cancel/history retention and mobile layout",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
