const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const rootDir = path.join(__dirname, "..", "..");
const artifactDir = path.join(rootDir, "artifacts");
const requestedBaseUrl = process.env.BASE_URL || "";
const correctFinalPayload = {
  culprit: "seoyun",
  trueTime: "21:08",
  methodEvidence: ["E01", "E10"],
  stagingEvidence: ["E02", "E18", "E19", "E20"],
  hiddenEvidence: ["E16", "E17", "E23"],
  motiveEvidence: ["E04", "E22"],
  evidence: ["E24"],
};

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function getStatus(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on("error", () => resolve(0));
    request.setTimeout(500, () => {
      request.destroy();
      resolve(0);
    });
  });
}

async function waitForServer(baseUrl, processRef) {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    const status = await getStatus(`${baseUrl}/healthz`);
    if (status === 200) return;
    if (processRef?.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("server did not become ready");
}

async function startServer() {
  if (requestedBaseUrl) return { baseUrl: requestedBaseUrl, processRef: null };
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const processRef = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(baseUrl, processRef);
  return { baseUrl, processRef };
}

(async () => {
  fs.mkdirSync(artifactDir, { recursive: true });

  const { baseUrl, processRef } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  const errors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector("#caseEntry");
    const publicHookState = await page.evaluate(() => ({
      gameTestApi: typeof window.gameTestApi,
      renderGameToText: typeof window.render_game_to_text,
      runtimeLoader: typeof window.__loadCaseRuntimeData,
    }));
    assert.strictEqual(publicHookState.gameTestApi, "undefined", "real page should not expose answer-bearing test hooks");
    assert.strictEqual(publicHookState.renderGameToText, "undefined", "real page should not expose test snapshot helpers");
    assert.strictEqual(
      publicHookState.runtimeLoader,
      "undefined",
      "runtime data loader should not remain globally callable on the real page",
    );

    await page.addInitScript(() => {
      Object.defineProperty(window, "__CRIMESCENE_TEST_MODE__", {
        value: true,
        configurable: false,
        writable: false,
      });
    });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector("#caseEntry");
    const testHookState = await page.evaluate(() => ({
      gameTestApi: typeof window.gameTestApi,
      renderGameToText: typeof window.render_game_to_text,
    }));
    assert.strictEqual(testHookState.gameTestApi, "object", "smoke mode should install browser test hooks");
    assert.strictEqual(testHookState.renderGameToText, "function", "smoke mode should install snapshot helper");

    const entryImagesLoaded = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#caseEntry img")).every((img) => img.complete && img.naturalWidth > 0),
    );
    assert.strictEqual(entryImagesLoaded, true, "entry artwork should load");

    const oldCreateRoomCount = await page.locator("#createRoomBtn").count();
    const legacyManifestStatus = await getStatus(`${baseUrl}/api/manifest`);
    const legacySlideStatus = await getStatus(`${baseUrl}/api/slides/1.png`);
    assert.strictEqual(oldCreateRoomCount, 0, "old presentation lobby should not render");
    assert.strictEqual(legacyManifestStatus, 404, "legacy manifest API should be inactive");
    assert.strictEqual(legacySlideStatus, 404, "legacy slide API should be inactive");

    await page.click("#openCaseBtn");
    await page.waitForSelector("#gameHub");
    await page.waitForSelector(".case-compass");

    const briefingImagesLoaded = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#gameHub img")).every((img) => img.complete && img.naturalWidth > 0),
    );
    assert.strictEqual(briefingImagesLoaded, true, "briefing artwork should load");

    const earlyForbiddenTerms = ["21:08", "20:45", "21:21", "차서윤이", "복제", "자석", "낚시줄", "보관통", "장비 상자"];
    const assertNoEarlyTerms = (text, label) => {
      earlyForbiddenTerms.forEach((term) => {
        assert(!text.includes(term), `${label} should not expose early spoiler term: ${term}`);
      });
    };

    const briefingState = await page.evaluate(() => {
      const bodyText = document.body.textContent || "";
      const data = window.CASE_DATA;
      return {
        text: bodyText,
        miniEvidenceCount: document.querySelectorAll(".mini-evidence").length,
        publicAnchorsPresent:
          bodyText.includes(data.CASE.title) &&
          bodyText.includes(data.CASE.setting) &&
          bodyText.includes(data.CASE.object) &&
          bodyText.includes("21:17") &&
          data.SUSPECTS.every(
            (suspect) =>
              bodyText.includes(suspect.name) &&
              bodyText.includes(suspect.role) &&
              bodyText.includes(suspect.claimedAlibi),
          ),
      };
    });
    assertNoEarlyTerms(briefingState.text, "opening briefing");
    assert.strictEqual(briefingState.miniEvidenceCount, 0, "briefing should not render concrete evidence mini-cards");
    assert.strictEqual(briefingState.publicAnchorsPresent, true, "opening should retain public case anchors and claimed alibis");
    ["21:03-21:15", "21:04-21:16", "21:02-21:13"].forEach((timeRange) => {
      assert(briefingState.text.includes(timeRange), `opening briefing should show public alibi time range: ${timeRange}`);
    });
    const briefingCompass = await page.textContent(".case-compass");
    assert(briefingCompass.includes("수사 진행 안내"), "briefing should include a non-spoiling progress guide");
    assert(!/E\d{2}/.test(briefingCompass), "briefing progress guide should not expose evidence ids");
    assertNoEarlyTerms(briefingCompass, "briefing progress guide");

    const initial = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    assert.strictEqual(initial.title, "0시 17분, 별이 사라진 밤");
    assert.strictEqual(initial.suspects, 4, "case should contain four suspects");
    assert.strictEqual(initial.locations, 5, "case should contain five locations");
    assert.strictEqual(initial.totalEvidence, 24, "case should contain twenty-four evidence cards");
    assert.strictEqual(initial.rules, 8, "case should contain eight board rules");
    assert.strictEqual(initial.evidenceCount, 0, "case should not start with concrete evidence discovered");
    const publicGlobalText = await page.evaluate(() => JSON.stringify(window.CASE_DATA));
    assertNoEarlyTerms(publicGlobalText, "public global case data");
    assert.strictEqual(
      await page.evaluate(() => typeof window.__loadCaseRuntimeData),
      "undefined",
      "runtime data loader should not remain globally callable after app boot",
    );

    const finalNavLocked = await page.locator('[data-action="set-view"][data-view="final"]').isDisabled();
    assert.strictEqual(finalNavLocked, true, "final accusation tab should stay locked before final readiness");
    const finalAttempt = await page.evaluate(() => window.gameTestApi.setView("final"));
    assert.notStrictEqual(finalAttempt.view, "final", "test API should not open final before readiness through normal view setter");

    await page.click('[data-action="set-view"][data-view="scene"]');
    await page.waitForSelector(".location-visual img");
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".location-visual img, .evidence-tile img")).every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    const sceneArtwork = await page.evaluate(() => ({
      count: document.querySelectorAll(".location-visual img, .evidence-tile img").length,
      allLoaded: Array.from(document.querySelectorAll(".location-visual img, .evidence-tile img")).every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    }));
    assert(sceneArtwork.count >= 2, "scene should render location and evidence artwork");
    assert.strictEqual(sceneArtwork.allLoaded, true, "scene artwork should load");
    const initialCompass = await page.textContent(".case-compass");
    assert(initialCompass.includes("다음 조사"), "investigation guide should show a next-location cue");
    assert(initialCompass.includes("현장 열기"), "investigation guide should offer a direct navigation action");
    assert(!/E\d{2}/.test(initialCompass), "investigation guide should stay non-spoiling before evidence collection");

    const allSceneIds = await page.evaluate(() => window.CASE_DATA.LOCATIONS.map((location) => location.id));
    for (const locationId of allSceneIds) {
      await page.click(`[data-action="set-location"][data-location="${locationId}"]`);
      const sceneState = await page.evaluate(() => {
        const panel = document.querySelector(".location-panel");
        const text = panel?.textContent || "";
        const lockedTiles = Array.from(panel?.querySelectorAll(".evidence-tile.is-locked") || []);
        const leakedConcrete = Array.from(panel?.querySelectorAll(".evidence-tile") || []).some((tile) => {
          const label = tile.querySelector("span")?.textContent?.trim();
          const title = tile.querySelector("strong")?.textContent?.trim();
          const source = tile.querySelector("small")?.textContent?.trim();
          const body = tile.querySelector("p")?.textContent?.trim() || "";
          const allowedBodies = [
            "조사하면 증거 노트에 기록됩니다.",
            "관련 단서를 먼저 확보해야 열람할 수 있습니다.",
            "추리 보드에서 특정 연결이 성립하면 이 조사 지점이 열릴 수 있습니다.",
          ];
          return (
            /E\d{2}/.test(tile.textContent || "") ||
            !["미확인"].includes(label) ||
            !["미확인 흔적", "봉인된 조사 지점"].includes(title) ||
            !["현장 조사 필요", "다른 단서 필요"].includes(source) ||
            !allowedBodies.includes(body)
          );
        });
        return {
          text,
          leakedConcrete,
          lockedCount: lockedTiles.length,
          lockedWithRequirements: lockedTiles.filter((tile) => tile.querySelector(".unlock-requirements")).length,
        };
      });
      assertNoEarlyTerms(sceneState.text, `scene ${locationId}`);
      assert.strictEqual(sceneState.leakedConcrete, false, `scene ${locationId} should hide uncollected evidence metadata`);
      if (sceneState.lockedCount > 0) {
        assert.strictEqual(
          sceneState.lockedWithRequirements,
          sceneState.lockedCount,
          `scene ${locationId} should explain how locked evidence opens`,
        );
      }
    }

    await page.click('[data-action="set-view"][data-view="notebook"]');
    const emptyNotebook = await page.evaluate(() => {
      const input = document.querySelector("[data-search-input]");
      return {
        cards: document.querySelectorAll(".evidence-card").length,
        text: document.querySelector("#gameHub")?.textContent || "",
        placeholder: input?.getAttribute("placeholder") || "",
      };
    });
    assert.strictEqual(emptyNotebook.cards, 0, "notebook should start without concrete evidence cards");
    assertNoEarlyTerms(`${emptyNotebook.text} ${emptyNotebook.placeholder}`, "empty notebook");

    await page.click('[data-action="set-view"][data-view="board"]');
    const emptyBoard = await page.evaluate(() => ({
      chips: document.querySelectorAll(".board-chip").length,
      text: document.querySelector("#gameHub")?.textContent || "",
    }));
    assert.strictEqual(emptyBoard.chips, 0, "board should start without concrete evidence chips");
    assertNoEarlyTerms(emptyBoard.text, "empty board");

    await page.click('[data-action="set-view"][data-view="suspects"]');
    const suspectIds = await page.evaluate(() => window.CASE_DATA.SUSPECTS.map((suspect) => suspect.id));
    for (const suspectId of suspectIds) {
      await page.click(`[data-action="set-suspect"][data-suspect="${suspectId}"]`);
      for (const mode of ["base", "alibi", "relationship"]) {
        await page.click(`[data-action="ask"][data-mode="${mode}"]`);
        const suspectState = await page.evaluate(() => {
          const data = window.CASE_DATA;
          const panel = document.querySelector("#suspectView");
          const text = panel?.textContent || "";
          const privateProfileTerms = ["숨긴 사실", "검증 결과", "표면 의심", "사채", "표절", "렌즈를 깨뜨", "21:06-21:10"];
          return {
            text,
            allClaimedAlibisVisible: data.SUSPECTS.every((suspect) => text.includes(suspect.claimedAlibi)),
            leakedHiddenValue: privateProfileTerms.some((value) => text.includes(value)),
          };
        });
        assertNoEarlyTerms(suspectState.text, `suspect ${suspectId} ${mode}`);
        assert.strictEqual(suspectState.leakedHiddenValue, false, `suspect ${suspectId} should hide non-public profile facts`);
      }
    }

    await page.click('[data-action="set-view"][data-view="scene"]');
    await page.click('[data-action="set-location"][data-location="exhibition"]');
    const enabledCollectButtons = await page.locator('[data-action="collect"]:not([disabled])').count();
    assert(enabledCollectButtons > 0, "scene should offer generic collectible investigation points");
    await page.locator('[data-action="collect"]:not([disabled])').first().click();
    const collectedSceneText = await page.textContent(".location-panel");
    assert(/E\d{2}/.test(collectedSceneText || ""), "collected evidence should reveal concrete card details");
    const firstUnlockNotice = (await page.textContent(".unlock-notice")) || "";
    assert(firstUnlockNotice.includes("새로 열린 항목"), "collecting evidence should render an explicit unlock notice");
    assert(firstUnlockNotice.includes("기록"), "unlock notice should name the newly available investigation area");

    await page.click('[data-action="set-location"][data-location="records"]');
    const recordsAfterUnlock = await page.textContent(".location-panel");
    assert(recordsAfterUnlock.includes("새로 열림"), "newly available scene cards should be visibly labeled");
    assert(recordsAfterUnlock.includes("새 단서 조사"), "newly available scene cards should have an explicit action label");

    await page.evaluate(() => window.gameTestApi.collect("E02"));

    await page.evaluate(() => {
      window.gameTestApi.collect(["E03", "E06", "E08", "E13", "E14"]);
      window.gameTestApi.setView("scene");
    });
    const clueFlowState = await page.evaluate(() => {
      const panel = document.querySelector(".clue-flow-panel");
      const routeLane = panel?.querySelector('[data-flow-lane="route"]');
      const timelineLane = panel?.querySelector('[data-flow-lane="timeline"]');
      const forbiddenTerms = [
        "복제 카드 가능성",
        "범인과 운석 위치",
        "진짜 도난",
        "E03+E14",
        "최종 범인",
        "운석 이동 경로다",
        "차서윤이 움직일 수 있는 정확한 시간대다",
        "고은별은 렌즈를 숨겼지 운석을 옮기지 않았다",
      ];
      const text = panel?.textContent || "";
      return {
        panelCount: document.querySelectorAll(".clue-flow-panel").length,
        routeText: routeLane?.textContent || "",
        timelineText: timelineLane?.textContent || "",
        cardIds: Array.from(panel?.querySelectorAll("[data-flow-card]") || []).map((node) => node.dataset.flowCard),
        highlightedIds: Array.from(panel?.querySelectorAll("[data-flow-card].is-new") || []).map((node) => node.dataset.flowCard),
        forbiddenPresent: forbiddenTerms.filter((term) => text.includes(term)),
        hasRouteLane: Boolean(routeLane),
        hasTimelineLane: Boolean(timelineLane),
        text,
      };
    });
    assert(clueFlowState.panelCount >= 1, "collecting visual clues should reveal a clue-flow panel");
    assert.strictEqual(clueFlowState.hasRouteLane, true, "clue-flow panel should include a movement-route lane");
    assert.strictEqual(clueFlowState.hasTimelineLane, true, "clue-flow panel should include a timeline lane");
    assert(clueFlowState.routeText.includes("푸른 형광가루 흔적"), "route lane should show the acquired E03 clue");
    assert(clueFlowState.routeText.includes("푸른 가루가 커튼 뒤까지 이어진다"), "route lane should show E03 clue content");
    assert(clueFlowState.timelineText.includes("분광기 로그와 렌즈 파편"), "timeline lane should show the acquired E13 clue");
    assert(clueFlowState.timelineText.includes("헤드셋 녹음 공백"), "timeline lane should show the acquired E14 clue");
    assert(clueFlowState.timelineText.includes("21:06-21:10"), "timeline lane should show the concrete time contradiction");
    ["E03", "E13", "E14"].forEach((id) => {
      assert(clueFlowState.cardIds.includes(id), `clue-flow panel should contain acquired visual clue ${id}`);
    });
    assert(clueFlowState.highlightedIds.length >= 1, "newly acquired flow clues should be visually highlighted");
    assert.deepStrictEqual(clueFlowState.forbiddenPresent, [], "clue-flow panel should not expose hidden trueMeaning or final-answer terms");

    await page.screenshot({ path: path.join(artifactDir, "visual-clue-flow-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifactDir, "visual-clue-flow-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 940 });
    fs.writeFileSync(
      path.join(artifactDir, "visual-clue-flow-report.json"),
      JSON.stringify(
        {
          ok: true,
          assertions: {
            panelCount: clueFlowState.panelCount,
            routeLane: clueFlowState.hasRouteLane,
            timelineLane: clueFlowState.hasTimelineLane,
            cardIds: clueFlowState.cardIds,
            highlightedIds: clueFlowState.highlightedIds,
          },
          nonSpoilerAssertions: {
            forbiddenPresent: clueFlowState.forbiddenPresent,
          },
          screenshots: ["artifacts/visual-clue-flow-desktop.png", "artifacts/visual-clue-flow-mobile.png"],
        },
        null,
        2,
      ),
    );

    await page.click('[data-action="set-view"][data-view="notebook"]');
    await page.click("[data-search-input]");
    await page.keyboard.type("경보");
    const searchState = await page.evaluate(() => ({
      value: document.querySelector("[data-search-input]")?.value,
      focused: document.activeElement === document.querySelector("[data-search-input]"),
      cards: Array.from(document.querySelectorAll(".evidence-card")).map((card) => card.textContent),
    }));
    assert.strictEqual(searchState.value, "경보", "notebook search should keep typed text");
    assert.strictEqual(searchState.focused, true, "notebook search should keep focus while typing");
    assert(searchState.cards.length >= 1, "notebook search should show matching evidence");
    assert(searchState.cards.every((text) => text.includes("경보")), "notebook search should filter visible evidence");
    assert(searchState.cards.some((text) => text.includes("관찰 메모")), "notebook evidence should include expanded observation notes");
    assert(searchState.cards.some((text) => text.includes("대조 포인트")), "notebook evidence should include deduction comparison hints");
    const notebookVisualState = await page.evaluate(() => ({
      modules: document.querySelectorAll(".evidence-visual").length,
      text: document.querySelector("#notebookView")?.textContent || "",
    }));
    assert(notebookVisualState.modules >= 1, "notebook evidence should render a visualization module for visual evidence");
    assert(notebookVisualState.text.includes("오디오"), "audio evidence should render an audio-style visualization label");
    const notebookInterpretationLeak = await page.evaluate(() => {
      const text = document.querySelector("#notebookView")?.textContent || "";
      return ["낚시줄과 자석", "복제 카드 가능성", "실제 도난 시간이 아님", "범인과 운석 위치"].some((term) =>
        text.includes(term),
      );
    });
    assert.strictEqual(notebookInterpretationLeak, false, "notebook should not expose hidden trueMeaning interpretation");

    const wrong = await page.evaluate(() => window.gameTestApi.wrongLink());
    const wrongFeedback = wrong.snapshot.wrongFeedback;
    assert(wrongFeedback, "wrong connection should produce feedback");
    assert(!/E\d{2}/.test(wrongFeedback), "wrong feedback should not leak exact evidence ids");
    assert(!/(차서윤|윤하린|백도현|고은별)/.test(wrongFeedback), "wrong feedback should not reveal a suspect name");

    await page.evaluate(() => window.gameTestApi.solveRule("R1"));
    const ruleUnlockState = await page.evaluate(() => ({
      notice: document.querySelector(".unlock-notice")?.textContent || "",
      newlyAdded: window.gameTestApi.snapshot().newlyAdded,
    }));
    assert(
      ruleUnlockState.notice.includes("방금 확정한") || ruleUnlockState.notice.includes("연결로 확인할 단서"),
      "board-rule unlock notice should explain that the just-made connection opened the next clue",
    );
    assert(ruleUnlockState.notice.includes("은색 글리터 흔적"), "solving a board rule should name newly added evidence");
    assert(ruleUnlockState.newlyAdded.includes("E15"), "rule-unlocked evidence should be tracked for highlighting");
    const boardUnlockFlowState = await page.evaluate(() => {
      const panel = document.querySelector(".clue-flow-panel");
      const routeLane = panel?.querySelector('[data-flow-lane="route"]');
      return {
        routeText: routeLane?.textContent || "",
        highlightedIds: Array.from(panel?.querySelectorAll("[data-flow-card].is-new") || []).map((node) => node.dataset.flowCard),
      };
    });
    assert(boardUnlockFlowState.routeText.includes("은색 글리터 흔적"), "board-unlocked route clues should appear in the clue-flow panel");
    assert(boardUnlockFlowState.highlightedIds.includes("E15"), "board-unlocked visual clues should be highlighted in the clue-flow panel");

    await page.click('[data-action="set-view"][data-view="board"]');
    const boardHelpText = await page.textContent("#boardView");
    assert(boardHelpText.includes("대조:"), "deduction board should show comparison hints on evidence chips");
    assert(boardHelpText.includes("21:06-21:10"), "deduction board should surface concrete comparison anchors");
    const boardAxisState = await page.evaluate(() => ({
      lanes: document.querySelectorAll(".board-axis-lane").length,
      text: document.querySelector("#boardView")?.textContent || "",
    }));
    assert(boardAxisState.lanes >= 3, "deduction board should group evidence into reasoning-axis lanes");
    assert(boardAxisState.text.includes("시간 축"), "deduction board should name the time reasoning lane");
    await page.evaluate(() => window.gameTestApi.collect(["E18", "E19"]));
    const readyCompass = await page.textContent(".case-compass");
    assert(readyCompass.includes("검증 가능한 축"), "progress guide should surface board-ready reasoning axes");
    assert(readyCompass.includes("수단 / 시간 / 은폐"), "progress guide should name only reasoning types for ready links");
    assert(!/E\d{2}/.test(readyCompass), "progress guide should not reveal exact evidence bundles");

    await page.evaluate(() => window.gameTestApi.collect(["E14", "E16", "E20"]));
    await page.click('[data-action="set-view"][data-view="suspects"]');
    await page.click('[data-action="set-suspect"][data-suspect="seoyun"]');
    const suspectProgressState = await page.evaluate(() => ({
      panels: document.querySelectorAll(".interview-status-grid").length,
      text: document.querySelector("#suspectView")?.textContent || "",
    }));
    assert(suspectProgressState.panels >= 1, "suspect interview should summarize related evidence progress");
    assert(suspectProgressState.text.includes("관련 증거"), "suspect interview should label related evidence progress");
    await page.evaluate(() => window.gameTestApi.collect(["E04", "E22"]));
    await page.click('[data-action="set-suspect"][data-suspect="harin"]');
    const relationshipState = await page.evaluate(() => {
      const panel = document.querySelector("#suspectView");
      return {
        text: panel?.textContent || "",
        chips: Array.from(panel?.querySelectorAll(".chip-grid button") || []).map((button) => button.textContent || ""),
      };
    });
    assert(relationshipState.text.includes("갈등 관계"), "suspect interview should expose a public relationship-conflict section");
    assert(relationshipState.text.includes("발견 공로"), "relationship conflicts should carry story-specific pressure");
    assert(
      relationshipState.chips.some((text) => text.includes("오래된 현장노트")),
      "evidence presenter should offer story-conflict evidence with a suspect reaction",
    );
    await page.click('[data-action="present-evidence"][data-evidence="E22"]');
    const harinReaction = await page.evaluate(() => ({
      reaction: document.querySelector(".reaction-text")?.textContent || "",
      followUp: document.querySelector(".follow-up-note")?.textContent || "",
    }));
    assert(
      harinReaction.reaction.includes("서윤") && harinReaction.reaction.includes("발견"),
      "presenting relationship evidence should trigger a richer character reaction",
    );
    assert(harinReaction.followUp.includes("추리 보드"), "evidence reactions should suggest the next reasoning surface");

    await page.evaluate(() => {
      window.gameTestApi.solveRule("R3");
      window.gameTestApi.collect(["E16", "E17"]);
    });
    await page.click('[data-action="set-view"][data-view="scene"]');
    await page.click('[data-action="set-location"][data-location="lab"]');
    const finalLockedHint = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll(".evidence-tile.is-locked"));
      const finalTile = tiles.find((tile) => tile.textContent.includes("최종 잠금"));
      return finalTile?.textContent || "";
    });
    assert(finalLockedHint.includes("열림 조건"), "final locked evidence should show an opening condition");
    assert(finalLockedHint.includes("추리 보드"), "final locked evidence should explain board connection requirements");
    assert(finalLockedHint.includes("특정 연결"), "final locked evidence should hint at board connections without listing ingredients");
    ["보관통 대여 기록", "도려낸 완충재", "케이블 홀의 낚시줄", "새 봉인 스티커"].forEach((title) => {
      assert(!finalLockedHint.includes(title), `final locked evidence should not name exact prerequisite evidence: ${title}`);
    });
    assert(!/E\d{2}/.test(finalLockedHint), "final locked evidence should not expose exact evidence ids");
    assert(finalLockedHint.includes("핵심 추리"), "final locked evidence should explain remaining final-gate progress");

    const lockedBeforeCorePlusTwo = await page.evaluate(() => {
      window.gameTestApi.collect("all");
      ["R1", "R2", "R3", "R5", "R6"].forEach((id) => {
        window.gameTestApi.solveRule(id);
      });
      return window.gameTestApi.snapshot();
    });
    assert.strictEqual(lockedBeforeCorePlusTwo.finalReady, false, "final accusation should stay locked until two suspects are cleared");
    assert(!lockedBeforeCorePlusTwo.discovered.includes("E24"), "decisive final evidence should stay locked before final readiness");

    const corePlusTwo = await page.evaluate(() => {
      window.gameTestApi.solveRule("R7");
      return window.gameTestApi.snapshot();
    });
    assert.strictEqual(corePlusTwo.finalReady, true, "final accusation should unlock after core rules plus two eliminations");
    assert(corePlusTwo.discovered.includes("E24"), "decisive final evidence should unlock when final readiness is reached");

    await page.evaluate(() => window.gameTestApi.setView("final"));
    const nearMiss = await page.evaluate(() =>
      window.gameTestApi.submitFinal({
        methodEvidence: ["E01"],
        stagingEvidence: ["E02"],
        hiddenEvidence: ["E16"],
        motiveEvidence: ["E04"],
        evidence: ["E14"],
      }),
    );
    assert.strictEqual(nearMiss.result.accepted, false, "near-miss final accusation should remain rejected");
    const nearMissFeedback = await page.evaluate(() => ({
      rows: document.querySelectorAll(".final-review-list li").length,
      actions: document.querySelectorAll(".final-review-actions button").length,
      methodChecked: document.querySelector('[data-final-method-evidence][value="E01"]')?.checked || false,
      text: document.querySelector("#finalView")?.textContent || "",
    }));
    assert(nearMissFeedback.rows >= 3, "near-miss final feedback should list category-level review items");
    assert(nearMissFeedback.text.includes("수단"), "near-miss final feedback should name weak reasoning categories");
    assert(nearMissFeedback.actions >= 2, "near-miss final feedback should offer recovery navigation");
    assert.strictEqual(nearMissFeedback.methodChecked, true, "near-miss final form should preserve submitted method evidence selections");
    assert(!nearMissFeedback.text.includes("E20 + E23"), "near-miss final feedback should not reveal exact evidence bundles");

    const solved = await page.evaluate(() => {
      window.gameTestApi.collect("all");
      ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"].forEach((id) => {
        window.gameTestApi.solveRule(id);
      });
      window.gameTestApi.collect("all");
      return window.gameTestApi.snapshot();
    });
    assert.deepStrictEqual(solved.solved, ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]);
    assert.strictEqual(solved.finalReady, true, "final accusation should unlock after required deductions");
    assert.strictEqual(solved.evidenceCount, 24, "all evidence should be discoverable by the endgame");

    const final = await page.evaluate((payload) => window.gameTestApi.submitFinal(payload), correctFinalPayload);
    assert.strictEqual(final.result.accepted, true, "correct final accusation should be accepted");
    assert(final.result.score >= 85, "final score should reward a complete accusation");

    await page.screenshot({ path: path.join(artifactDir, "smoke-investigation-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifactDir, "smoke-investigation-mobile.png"), fullPage: true });

    assert.deepStrictEqual(errors, [], "browser console should stay clean");

    const summary = {
      ok: true,
      baseUrl,
      legacyManifestStatus,
      legacySlideStatus,
      solvedRules: solved.solved.length,
      evidenceCount: solved.evidenceCount,
      finalScore: final.result.score,
      screenshots: [
        "artifacts/visual-clue-flow-desktop.png",
        "artifacts/visual-clue-flow-mobile.png",
        "artifacts/smoke-investigation-desktop.png",
        "artifacts/smoke-investigation-mobile.png",
      ],
    };
    fs.writeFileSync(path.join(artifactDir, "smoke-summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
    if (processRef) processRef.kill();
  }
})();
