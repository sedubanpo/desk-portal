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
      "PASS actual app parsing/navigation, role assignment, exclusion error, grade drag and mobile layout",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
