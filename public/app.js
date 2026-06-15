(function () {
  const runtimeLoader = window.__loadCaseRuntimeData;
  const data = typeof runtimeLoader === "function" ? runtimeLoader() : window.CASE_DATA;
  if (typeof runtimeLoader === "function") delete window.__loadCaseRuntimeData;
  const app = document.getElementById("app");

  const VIEWS = [
    ["briefing", "브리핑"],
    ["scene", "현장"],
    ["notebook", "증거"],
    ["suspects", "심문"],
    ["board", "추리 보드"],
    ["final", "최종 고발"],
    ["reveal", "리빌"],
  ];

  const INITIAL_EVIDENCE = [];
  const HERO_IMAGE = "/assets/hero-observatory.png";
  const LOCATION_IMAGES = {
    exhibition: "/assets/location-exhibition.png",
    control: "/assets/location-control.png",
    lab: "/assets/location-lab.png",
    lounge: "/assets/location-lounge.png",
    records: "/assets/location-records.png",
    briefing: "/assets/hero-observatory.png",
  };
  const CLEARED_UNLOCKS = {
    harinCleared: "harin",
    dohyunCleared: "dohyun",
    eunbyeolCleared: "eunbyeol",
  };

  const state = {
    started: false,
    teamName: "",
    activeView: "briefing",
    activeLocation: "exhibition",
    activeSuspect: "seoyun",
    interviewMode: "base",
    interviewEvidence: "",
    notebookFilter: "전체",
    search: "",
    discovered: new Set(INITIAL_EVIDENCE),
    selected: new Set(),
    solved: new Set(),
    cleared: new Set(),
    insights: [],
    boardFeedback: null,
    hintsUsed: 0,
    hintIndex: -1,
    finalResult: null,
    revealIndex: 0,
    unlockNotice: null,
    newlyAvailable: new Set(),
    newlyAdded: new Set(),
  };

  const evidenceById = new Map(data.EVIDENCE.map((item) => [item.id, item]));
  const suspectById = new Map(data.SUSPECTS.map((item) => [item.id, item]));
  const locationById = new Map(data.LOCATIONS.map((item) => [item.id, item]));
  const ruleById = new Map(data.BOARD_RULES.map((item) => [item.id, item]));

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatText(value) {
    return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function sortEvidence(ids) {
    return Array.from(ids).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  }

  function discoveredCards() {
    return sortEvidence(state.discovered)
      .map((id) => evidenceById.get(id))
      .filter(Boolean);
  }

  function solvedRules() {
    return data.BOARD_RULES.filter((rule) => state.solved.has(rule.id));
  }

  function finalReady() {
    const coreReady = ["R1", "R2", "R3", "R5"].every((id) => state.solved.has(id));
    const clearedCount = ["harin", "dohyun", "eunbyeol"].filter((id) => state.cleared.has(id)).length;
    return coreReady && clearedCount >= 2;
  }

  function evidenceLocation(card) {
    return locationById.get(card?.location)?.name || "조사 현장";
  }

  function isUnlockedByRule(card) {
    return data.BOARD_RULES.some((rule) => state.solved.has(rule.id) && rule.unlocks.includes(card.id));
  }

  function unlockingRules(card) {
    if (!card) return [];
    return data.BOARD_RULES.filter((rule) => rule.unlocks.includes(card.id));
  }

  function isEvidenceAvailable(card) {
    if (!card) return false;
    if (state.discovered.has(card.id)) return true;
    if (INITIAL_EVIDENCE.includes(card.id)) return true;
    if (card.round === "final") return finalReady() && isUnlockedByRule(card);
    if (isUnlockedByRule(card)) return true;
    return (card.dependsOn || []).every((id) => state.discovered.has(id));
  }

  function requirementLabel(id) {
    const card = evidenceById.get(id);
    if (!card) return "확인되지 않은 선행 단서";
    if (state.discovered.has(id)) return `${card.id} · ${card.title}`;
    const status = isEvidenceAvailable(card) ? "조사 가능" : "미확보";
    const tags = (card.tags || []).slice(0, 2).join(" / ") || "관련";
    return `${status}: ${evidenceLocation(card)}의 ${tags} 단서`;
  }

  function finalGateLine() {
    const coreIds = ["R1", "R2", "R3", "R5"];
    const coreCount = coreIds.filter((id) => state.solved.has(id)).length;
    const clearedCount = ["harin", "dohyun", "eunbyeol"].filter((id) => state.cleared.has(id)).length;
    return `최종 조건: 핵심 추리 ${coreCount}/4, 용의자 검증 ${Math.min(clearedCount, 2)}/2`;
  }

  function renderUnlockRequirements(card, available, discovered) {
    if (!card || discovered || available) return "";
    const lines = [];
    const dependencies = card.dependsOn || [];
    if (dependencies.length) {
      const found = dependencies.filter((id) => state.discovered.has(id)).length;
      lines.push({
        label: "선행 단서",
        text: `${found}/${dependencies.length} 확보 · ${dependencies.map(requirementLabel).join(" + ")}`,
      });
    }

    unlockingRules(card)
      .filter((rule) => !state.solved.has(rule.id))
      .forEach((rule) => {
        const found = rule.required.filter((id) => state.discovered.has(id)).length;
        lines.push({
          label: "추리 보드",
          text: `${found}/${rule.required.length} 연결 필요 · ${rule.required.map(requirementLabel).join(" + ")}`,
        });
      });

    if (card.round === "final" && !finalReady()) {
      lines.push({
        label: "최종 잠금",
        text: finalGateLine(),
      });
    }

    const visibleLines = lines.length
      ? lines
      : [{ label: "열림 조건", text: "다른 현장에서 관련 단서를 더 확보하면 열립니다." }];

    return `
      <div class="unlock-requirements" aria-label="단서 열림 조건">
        <strong>열림 조건</strong>
        <ul>
          ${visibleLines.map((line) => `
            <li>
              <span>${escapeHtml(line.label)}</span>
              <small>${escapeHtml(line.text)}</small>
            </li>
          `).join("")}
        </ul>
      </div>
    `;
  }

  function availableUncollectedEvidence() {
    return data.EVIDENCE
      .filter((card) => !state.discovered.has(card.id) && isEvidenceAvailable(card))
      .map((card) => card.id);
  }

  function idsOpenedAfter(beforeIds) {
    const before = new Set(beforeIds);
    return availableUncollectedEvidence().filter((id) => !before.has(id));
  }

  function markNewlyAvailable(ids) {
    ids.forEach((id) => state.newlyAvailable.add(id));
  }

  function markNewlyAdded(ids) {
    ids.forEach((id) => {
      state.newlyAdded.add(id);
      state.newlyAvailable.delete(id);
    });
  }

  function summarizeAvailable(ids) {
    const counts = new Map();
    ids.forEach((id) => {
      const card = evidenceById.get(id);
      const location = evidenceLocation(card);
      counts.set(location, (counts.get(location) || 0) + 1);
    });
    return Array.from(counts, ([location, count]) => ({
      label: `${location} · 새 조사 지점 ${count}개`,
      detail: "현장 화면에서 바로 조사할 수 있습니다.",
      locked: true,
    }));
  }

  function summarizeAdded(ids) {
    return ids.map((id) => {
      const card = evidenceById.get(id);
      return {
        label: `${card.id} · ${card.title}`,
        detail: `${evidenceLocation(card)}에서 증거 노트에 추가됨`,
      };
    });
  }

  function setUnlockNotice({ title, message, addedIds = [], availableIds = [], clearedIds = [] }) {
    if (!addedIds.length && !availableIds.length && !clearedIds.length) {
      state.unlockNotice = null;
      return;
    }
    state.unlockNotice = {
      title,
      message,
      added: summarizeAdded(addedIds),
      available: summarizeAvailable(availableIds),
      cleared: clearedIds.map((id) => {
        const suspect = suspectById.get(id);
        return {
          label: `${suspect?.name || "용의자"} 검증 완료`,
          detail: "최종 고발 조건에 반영되었습니다.",
        };
      }),
    };
  }

  function collectEvidence(id) {
    const beforeAvailable = availableUncollectedEvidence();
    const card = evidenceById.get(id);
    if (!card || !isEvidenceAvailable(card)) return false;
    state.discovered.add(id);
    markNewlyAdded([id]);
    const newlyAvailable = idsOpenedAfter(beforeAvailable).filter((openedId) => openedId !== id);
    markNewlyAvailable(newlyAvailable);
    setUnlockNotice({
      title: "단서 확보",
      message: newlyAvailable.length
        ? "방금 확보한 단서와 연결된 조사 지점이 새로 열렸습니다."
        : "증거 노트에 새 단서가 기록되었습니다.",
      addedIds: [id],
      availableIds: newlyAvailable,
    });
    return true;
  }

  function collectAvailableEvidence() {
    let changed = false;
    let keepGoing = true;
    while (keepGoing) {
      keepGoing = false;
      data.EVIDENCE.forEach((card) => {
        if (!state.discovered.has(card.id) && isEvidenceAvailable(card)) {
          state.discovered.add(card.id);
          changed = true;
          keepGoing = true;
        }
      });
    }
    return changed;
  }

  function sameSet(left, right) {
    if (left.length !== right.length) return false;
    const pool = new Set(left);
    return right.every((item) => pool.has(item));
  }

  function selectedIds() {
    return sortEvidence(state.selected);
  }

  function ruleForSelection(ids) {
    return data.BOARD_RULES.find((rule) => sameSet(rule.required, ids));
  }

  function pushInsight(rule) {
    const already = state.insights.some((item) => item.id === rule.id);
    if (!already) {
      state.insights.unshift({
        id: rule.id,
        title: rule.title,
        result: rule.result,
        kind: rule.kind,
      });
    }
  }

  function applyRuleUnlocks(rule) {
    const addedEvidence = [];
    const clearedSuspects = [];
    rule.unlocks.forEach((unlock) => {
      if (unlock.startsWith("E")) {
        const card = evidenceById.get(unlock);
        if (card?.round !== "final" || finalReady()) {
          if (!state.discovered.has(unlock)) addedEvidence.push(unlock);
          state.discovered.add(unlock);
        }
        return;
      }
      const suspectId = CLEARED_UNLOCKS[unlock];
      if (suspectId) {
        if (!state.cleared.has(suspectId)) clearedSuspects.push(suspectId);
        state.cleared.add(suspectId);
      }
    });
    markNewlyAdded(addedEvidence);
    return { addedEvidence, clearedSuspects };
  }

  function unlockFinalEvidenceIfReady() {
    const addedEvidence = [];
    data.BOARD_RULES.forEach((rule) => {
      if (!state.solved.has(rule.id)) return;
      rule.unlocks.forEach((unlock) => {
        const card = evidenceById.get(unlock);
        if (card?.round === "final" && finalReady()) {
          if (!state.discovered.has(card.id)) addedEvidence.push(card.id);
          state.discovered.add(card.id);
        }
      });
    });
    markNewlyAdded(addedEvidence);
    return addedEvidence;
  }

  function wrongConnectionFeedback(ids) {
    const hintTypes = new Set();
    ids.forEach((id) => {
      const card = evidenceById.get(id);
      (card?.supports || card?.tags || []).slice(0, 2).forEach((tag) => hintTypes.add(tag));
    });
    const axis = Array.from(hintTypes).slice(0, 3).join(", ") || "시간, 수단, 동기";
    return `이 연결은 아직 설득력이 부족합니다. ${axis} 축을 하나씩 분리해 다시 묶어 보세요.`;
  }

  function submitBoard(shouldRender = true) {
    const ids = selectedIds();
    if (ids.length < 2) {
      state.boardFeedback = {
        tone: "warn",
        text: "증거는 최소 두 개 이상 연결해야 합니다.",
      };
      if (shouldRender) render();
      return { ok: false, reason: "too_few" };
    }

    const rule = ruleForSelection(ids);
    if (!rule) {
      state.boardFeedback = {
        tone: "wrong",
        text: wrongConnectionFeedback(ids),
      };
      if (shouldRender) render();
      return { ok: false, reason: "wrong", feedback: state.boardFeedback.text };
    }

    if (state.solved.has(rule.id)) {
      state.boardFeedback = {
        tone: "warn",
        text: "이미 확인한 연결입니다.",
      };
      state.selected.clear();
      if (shouldRender) render();
      return { ok: false, reason: "duplicate" };
    }

    const beforeAvailable = availableUncollectedEvidence();
    state.solved.add(rule.id);
    pushInsight(rule);
    const ruleUnlocks = applyRuleUnlocks(rule);
    const finalUnlocks = unlockFinalEvidenceIfReady();
    const addedIds = Array.from(new Set([...ruleUnlocks.addedEvidence, ...finalUnlocks]));
    const availableIds = idsOpenedAfter(beforeAvailable).filter((id) => !addedIds.includes(id));
    markNewlyAvailable(availableIds);
    state.selected.clear();
    state.boardFeedback = {
      tone: "right",
      text: rule.result,
    };
    setUnlockNotice({
      title: "연결 검증 완료",
      message: "검증 결과로 새롭게 열람 가능한 항목이 갱신되었습니다.",
      addedIds,
      availableIds,
      clearedIds: ruleUnlocks.clearedSuspects,
    });
    if (shouldRender) render();
    return { ok: true, rule: rule.id, text: rule.result };
  }

  function normalized(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  function includesAny(value, terms) {
    const haystack = normalized(value);
    return terms.some((term) => haystack.includes(normalized(term)));
  }

  function includesAtLeast(value, terms, minimum) {
    const haystack = normalized(value);
    return terms.filter((term) => haystack.includes(normalized(term))).length >= minimum;
  }

  function validateFinal(payload) {
    const selectedEvidence = new Set(payload.evidence || []);
    const checks = {
      culprit: payload.culprit === data.FINAL_ACCUSATION.culprit,
      time: payload.trueTime === data.FINAL_ACCUSATION.trueTime,
      method:
        includesAny(payload.method, ["복제", "마스터"]) &&
        includesAny(payload.method, ["자석", "센서"]) &&
        includesAny(payload.method, ["운석", "케이스"]),
      staging:
        includesAny(payload.staging, ["경보", "지연"]) &&
        includesAny(payload.staging, ["낚시줄", "조정실", "원격"]),
      hidden: includesAny(payload.hidden, data.FINAL_ACCUSATION.hiddenTerms),
      motive:
        includesAny(payload.motive, ["아버지", "표절", "발견"]) &&
        includesAny(payload.motive, ["빚", "돈", "사채"]),
      evidence:
        Array.from(selectedEvidence).filter((id) => data.FINAL_ACCUSATION.requiredEvidencePool.includes(id)).length >= 4,
    };
    const score = Object.values(checks).filter(Boolean).length;
    return {
      accepted: Object.values(checks).every(Boolean),
      score: Math.round((score / Object.keys(checks).length) * 100),
      checks,
    };
  }

  function submitFinalPayload(payload, shouldRender = true) {
    if (!finalReady()) {
      state.finalResult = {
        accepted: false,
        score: 0,
        checks: {},
        text: "핵심 추리가 아직 잠겨 있습니다.",
      };
      if (shouldRender) render();
      return state.finalResult;
    }

    const result = validateFinal(payload);
    state.finalResult = {
      ...result,
      text: result.accepted
        ? "최종 고발이 성립했습니다. 사건의 시간표와 은닉 경로가 맞물립니다."
        : "아직 빈틈이 남았습니다. 범행 시간, 장치, 은닉 장소, 동기를 다시 대조하세요.",
    };
    if (result.accepted) state.activeView = "reveal";
    if (shouldRender) render();
    return state.finalResult;
  }

  function submitFinalForm() {
    const form = app.querySelector("#finalForm");
    if (!form) return;
    const payload = {
      culprit: form.elements.culprit.value,
      trueTime: form.elements.trueTime.value,
      method: form.elements.method.value,
      staging: form.elements.staging.value,
      hidden: form.elements.hidden.value,
      motive: form.elements.motive.value,
      evidence: Array.from(form.querySelectorAll("[data-final-evidence]:checked")).map((item) => item.value),
    };
    submitFinalPayload(payload);
  }

  function scoreLine() {
    const total = data.EVIDENCE.length;
    const clearedCount = ["harin", "dohyun", "eunbyeol"].filter((id) => state.cleared.has(id)).length;
    return `
      <div class="metric"><strong>${state.discovered.size}</strong><span>증거 / ${total}</span></div>
      <div class="metric"><strong>${state.solved.size}</strong><span>추리 / ${data.BOARD_RULES.length}</span></div>
      <div class="metric"><strong>${clearedCount}</strong><span>해소 / 3</span></div>
      <div class="metric"><strong>${state.hintsUsed}</strong><span>단서 사용</span></div>
    `;
  }

  function renderStart() {
    return `
      <section class="case-entry" id="caseEntry">
        <div class="entry-panel">
          <figure class="entry-visual">
            <img src="${HERO_IMAGE}" alt="비어 있는 운석 전시 케이스가 있는 오르빗 돔 전시홀" />
          </figure>
          <p class="eyebrow">${escapeHtml(data.CASE.status)}</p>
          <h1>${escapeHtml(data.CASE.title)}</h1>
          <p class="case-lead">${escapeHtml(data.CASE.briefing)}</p>
          <div class="case-facts" aria-label="사건 요약">
            <span>${escapeHtml(data.CASE.setting)}</span>
            <span>${escapeHtml(data.CASE.object)}</span>
            <span>${escapeHtml(data.CASE.session)}</span>
          </div>
          <label class="team-field">
            <span>수사팀</span>
            <input id="teamNameInput" maxlength="24" value="${escapeHtml(state.teamName)}" autocomplete="off" placeholder="Orbit cold case" />
          </label>
          <button class="primary-action" type="button" id="openCaseBtn" data-action="open-case">사건 파일 열기</button>
        </div>
        <aside class="entry-dossier">
          <div>
            <span class="dossier-label">발생 시각</span>
            <strong>21:17 경보</strong>
          </div>
          <div>
            <span class="dossier-label">초기 상태</span>
            <strong>잠긴 전시 케이스</strong>
          </div>
          <div>
            <span class="dossier-label">관계자</span>
            <strong>${data.SUSPECTS.length}명</strong>
          </div>
          <div>
            <span class="dossier-label">현장</span>
            <strong>${data.LOCATIONS.length}구역</strong>
          </div>
        </aside>
      </section>
    `;
  }

  function renderShell() {
    return `
      <header class="case-header">
        <div class="case-title-block">
          <p class="eyebrow">${escapeHtml(data.CASE.status)}</p>
          <h1>${escapeHtml(data.CASE.title)}</h1>
          <span>${escapeHtml(state.teamName || "무명 수사팀")} · ${escapeHtml(data.CASE.setting)}</span>
        </div>
        <div class="metrics-strip">${scoreLine()}</div>
      </header>
      <nav class="view-tabs" aria-label="조사 화면">
        ${VIEWS.map(([id, label]) => {
          const locked = (id === "final" && !finalReady()) || (id === "reveal" && !state.finalResult?.accepted);
          return `
            <button type="button" class="${state.activeView === id ? "is-active" : ""}" data-action="set-view" data-view="${id}" ${locked ? "disabled" : ""}>
              ${escapeHtml(label)}
            </button>
          `;
        }).join("")}
      </nav>
      ${renderUnlockNotice()}
      <section class="workspace" id="gameHub">
        ${renderView()}
      </section>
    `;
  }

  function renderUnlockNotice() {
    const notice = state.unlockNotice;
    if (!notice) return "";
    const rows = [
      ...notice.added.map((item) => ({ ...item, type: "증거 노트" })),
      ...notice.available.map((item) => ({ ...item, type: "조사 가능" })),
      ...notice.cleared.map((item) => ({ ...item, type: "검증 완료" })),
    ];
    return `
      <aside class="unlock-notice" role="status" aria-live="polite">
        <div>
          <span>새로 열린 항목</span>
          <strong>${escapeHtml(notice.title)}</strong>
          <p>${escapeHtml(notice.message)}</p>
        </div>
        <ul>
          ${rows.map((item) => `
            <li>
              <em>${escapeHtml(item.type)}</em>
              <span>${escapeHtml(item.label)}</span>
              <small>${escapeHtml(item.detail)}</small>
            </li>
          `).join("")}
        </ul>
      </aside>
    `;
  }

  function renderView() {
    if (state.activeView === "scene") return renderScene();
    if (state.activeView === "notebook") return renderNotebook();
    if (state.activeView === "suspects") return renderSuspects();
    if (state.activeView === "board") return renderBoard();
    if (state.activeView === "final") return renderFinal();
    if (state.activeView === "reveal") return renderReveal();
    return renderBriefing();
  }

  function renderBriefing() {
    return `
      <div class="briefing-grid">
        <section class="case-card large-card">
          <figure class="case-visual">
            <img src="${HERO_IMAGE}" alt="아틀라스 블루가 사라진 천문관 전시홀" />
          </figure>
          <p class="eyebrow">Incident</p>
          <h2>${escapeHtml(data.CASE.object)}</h2>
          <p>${escapeHtml(data.CASE.apparentIncident)}</p>
        </section>
        <section class="case-card">
          <p class="eyebrow">Suspects</p>
          <div class="suspect-stack">
            ${data.SUSPECTS.map((suspect) => `
              <button type="button" class="suspect-row" data-action="open-suspect" data-suspect="${suspect.id}">
                <span>${escapeHtml(suspect.badge)}</span>
                <strong>${escapeHtml(suspect.name)}</strong>
                <small>${escapeHtml(suspect.role)} · ${escapeHtml(suspect.claimedAlibi)}</small>
              </button>
            `).join("")}
          </div>
        </section>
      </div>
      <section class="timeline-panel public-briefing-panel">
        <div class="panel-heading">
          <p class="eyebrow">Public Briefing</p>
          <h2>공개 조사 범위</h2>
        </div>
        <div class="timeline-list">
          ${[
            ["21:17", "보안 경보가 울렸고 전시 케이스 안의 아틀라스 블루가 사라진 상태로 확인됐다.", "경보 시각은 공개 기록이며, 실제 경위는 아직 확정되지 않았다."],
            ["현장", `${data.LOCATIONS.length}개 조사 구역이 봉쇄되었다.`, "구체 단서는 각 구역을 직접 조사해야 기록된다."],
            ["관계자", `${data.SUSPECTS.length}명의 관계자가 현장 안에 남아 있었다.`, "각자의 주장 알리바이는 심문 화면에서 확인한다."],
          ].map(([time, text, question]) => `
            <article class="timeline-item">
              <time>${escapeHtml(time)}</time>
              <div>
                <strong>${escapeHtml(text)}</strong>
                <span>${escapeHtml(question)}</span>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderEvidenceMini(id) {
    const card = evidenceById.get(id);
    if (!card) return "";
    return `
      <article class="mini-evidence">
        <img class="evidence-thumb" src="${LOCATION_IMAGES[card.location] || HERO_IMAGE}" alt="" loading="lazy" />
        <span>${escapeHtml(card.id)}</span>
        <strong>${escapeHtml(card.title)}</strong>
        <small>${escapeHtml(card.source)}</small>
      </article>
    `;
  }

  function renderScene() {
    const active = locationById.get(state.activeLocation) || data.LOCATIONS[0];
    return `
      <div class="scene-layout">
        <section class="scene-map">
          <div class="map-board" aria-label="천문관 지도">
            ${data.LOCATIONS.map((location) => `
              <button
                type="button"
                class="map-pin ${state.activeLocation === location.id ? "is-active" : ""}"
                style="left:${location.coordinates[0]}%; top:${location.coordinates[1]}%;"
                data-action="set-location"
                data-location="${location.id}"
              >
                <span>${escapeHtml(location.shortName)}</span>
              </button>
            `).join("")}
          </div>
        </section>
        <section class="location-panel">
          <figure class="location-visual">
            <img src="${LOCATION_IMAGES[active.id] || HERO_IMAGE}" alt="${escapeHtml(active.name)} 조사 구역 이미지" />
          </figure>
          <p class="eyebrow">${escapeHtml(active.round)}</p>
          <h2>${escapeHtml(active.name)}</h2>
          <p>${escapeHtml(active.sceneState)}</p>
          <div class="scene-evidence-grid">
            ${active.evidenceIds.map((id) => renderSceneEvidence(id)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderSceneEvidence(id) {
    const card = evidenceById.get(id);
    const discovered = state.discovered.has(id);
    const available = isEvidenceAvailable(card);
    const newlyAvailable = !discovered && state.newlyAvailable.has(id);
    const newlyAdded = discovered && state.newlyAdded.has(id);
    const label = discovered ? card.id : newlyAvailable ? "새로 열림" : "미확인";
    const title = discovered ? card.title : newlyAvailable ? "새로 열린 조사 지점" : available ? "미확인 흔적" : "봉인된 조사 지점";
    const source = discovered ? card.source : available ? "현장 조사 필요" : "다른 단서 필요";
    const body = discovered
      ? card.playerText
      : newlyAvailable
        ? "관련 단서를 확보해 열람 가능해졌습니다. 조사하면 증거 노트에 기록됩니다."
        : available
          ? "조사하면 증거 노트에 기록됩니다."
          : "관련 단서를 먼저 확보해야 열람할 수 있습니다.";
    return `
      <article class="evidence-tile ${discovered ? "is-found" : ""} ${available && !discovered ? "is-available" : ""} ${newlyAvailable || newlyAdded ? "is-new" : ""} ${available ? "" : "is-locked"}">
        <img class="evidence-thumb" src="${LOCATION_IMAGES[card.location] || HERO_IMAGE}" alt="" loading="lazy" />
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(source)}</small>
        </div>
        <p>${formatText(body)}</p>
        ${renderUnlockRequirements(card, available, discovered)}
        <button type="button" data-action="collect" data-evidence="${card.id}" ${!available || discovered ? "disabled" : ""}>
          ${discovered ? "확보됨" : newlyAvailable ? "새 단서 조사" : available ? "조사" : "잠김"}
        </button>
      </article>
    `;
  }

  function notebookFilters() {
    const tags = new Set(["전체"]);
    discoveredCards().forEach((card) => card.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags);
  }

  function filteredEvidence() {
    const query = normalized(state.search);
    return discoveredCards().filter((card) => {
      const matchesFilter = state.notebookFilter === "전체" || card.tags.includes(state.notebookFilter);
      const text = normalized(`${card.id} ${card.title} ${card.source} ${card.playerText} ${card.tags.join(" ")}`);
      return matchesFilter && (!query || text.includes(query));
    });
  }

  function renderNotebook() {
    const cards = filteredEvidence();
    return `
      <section class="notebook-toolbar">
        <div>
          <p class="eyebrow">Evidence</p>
          <h2>증거 노트</h2>
        </div>
        <label class="search-field">
          <span>검색</span>
          <input data-search-input value="${escapeHtml(state.search)}" placeholder="확보한 증거 검색" />
        </label>
      </section>
      <div class="filter-row">
        ${notebookFilters().map((tag) => `
          <button type="button" class="${state.notebookFilter === tag ? "is-active" : ""}" data-action="set-filter" data-filter="${escapeHtml(tag)}">
            ${escapeHtml(tag)}
          </button>
        `).join("")}
      </div>
      <section class="evidence-grid" id="notebookView">
        ${cards.map((card) => renderEvidenceCard(card)).join("") || `<p class="empty-note">아직 확보한 증거가 없습니다. 현장에서 조사할 항목을 선택하세요.</p>`}
      </section>
    `;
  }

  function renderEvidenceCard(card) {
    const suspectTags = card.implicates.concat(card.clears).map((id) => suspectById.get(id)?.name).filter(Boolean);
    return `
      <article class="evidence-card ${state.newlyAdded.has(card.id) ? "is-new" : ""}">
        <img class="evidence-thumb" src="${LOCATION_IMAGES[card.location] || HERO_IMAGE}" alt="" loading="lazy" />
        <header>
          <span>${escapeHtml(card.id)}</span>
          <strong>${escapeHtml(card.title)}</strong>
        </header>
        <p>${formatText(card.playerText)}</p>
        ${card.detail ? `<p class="evidence-detail"><strong>관찰 메모</strong>${formatText(card.detail)}</p>` : ""}
        ${card.boardHint ? `<p class="deduction-note"><strong>대조 포인트</strong>${escapeHtml(card.boardHint)}</p>` : ""}
        <div class="tag-row">
          ${card.tags.map((tag) => `<small>${escapeHtml(tag)}</small>`).join("")}
          ${suspectTags.map((tag) => `<small>${escapeHtml(tag)}</small>`).join("")}
        </div>
        <footer>${escapeHtml(card.source)}</footer>
      </article>
    `;
  }

  function renderSuspects() {
    const active = suspectById.get(state.activeSuspect) || data.SUSPECTS[0];
    const answers = data.QUESTIONS[active.id] || {};
    const reaction = state.interviewEvidence ? answers.reactions?.[state.interviewEvidence] : "";
    return `
      <div class="suspect-layout" id="suspectView">
        <aside class="suspect-list">
          ${data.SUSPECTS.map((suspect) => `
            <button type="button" class="suspect-file ${state.activeSuspect === suspect.id ? "is-active" : ""} ${state.cleared.has(suspect.id) ? "is-cleared" : ""}" data-action="set-suspect" data-suspect="${suspect.id}">
              <span>${escapeHtml(suspect.badge)}</span>
              <strong>${escapeHtml(suspect.name)}</strong>
              <small>${state.cleared.has(suspect.id) ? "의혹 해소" : suspect.role}</small>
            </button>
          `).join("")}
        </aside>
        <section class="interview-panel">
          <p class="eyebrow">${escapeHtml(active.role)}</p>
          <h2>${escapeHtml(active.name)}</h2>
          <div class="profile-strip">
            <span>공개 진술</span>
            <span>${escapeHtml(active.role)}</span>
          </div>
          <dl class="case-dl">
            <dt>주장 알리바이</dt><dd>${escapeHtml(active.claimedAlibi)}</dd>
            <dt>검증 상태</dt><dd>아직 증거로 검증되지 않았습니다.</dd>
          </dl>
          <div class="question-row">
            ${["base", "alibi", "relationship"].map((mode) => `
              <button type="button" class="${state.interviewMode === mode ? "is-active" : ""}" data-action="ask" data-mode="${mode}">
                ${mode === "base" ? "진술" : mode === "alibi" ? "알리바이" : "관계"}
              </button>
            `).join("")}
          </div>
          <blockquote>${escapeHtml(publicInterviewAnswer(active, state.interviewMode))}</blockquote>
          <div class="evidence-presenter">
            <h3>증거 제시</h3>
            <div class="chip-grid">
              ${discoveredCards().filter((card) => card.implicates.includes(active.id) || card.clears.includes(active.id)).map((card) => `
                <button type="button" class="${state.interviewEvidence === card.id ? "is-active" : ""}" data-action="present-evidence" data-evidence="${card.id}">
                  ${escapeHtml(card.id)} · ${escapeHtml(card.title)}
                </button>
              `).join("") || `<span class="empty-note">제시할 관련 증거가 아직 없습니다.</span>`}
            </div>
            ${reaction ? `<p class="reaction-text">${escapeHtml(reaction)}</p>` : ""}
          </div>
        </section>
      </div>
    `;
  }

  function renderBoard() {
    return `
      <div class="board-layout" id="boardView">
        <section class="board-panel">
          <div class="panel-heading">
            <p class="eyebrow">Deduction</p>
            <h2>추리 보드</h2>
          </div>
          <div class="selected-strip">
            <strong>${state.selected.size}</strong>
            <span>선택된 증거</span>
            <button type="button" data-action="clear-selection">선택 해제</button>
            <button type="button" class="primary-action" data-action="submit-board">연결 검증</button>
          </div>
          ${state.boardFeedback ? `<p class="board-feedback ${state.boardFeedback.tone === "wrong" ? "wrong-feedback" : ""}" role="status" aria-live="polite">${escapeHtml(state.boardFeedback.text)}</p>` : ""}
          <div class="board-evidence-list">
            ${discoveredCards().map((card) => `
              <label class="board-chip ${state.selected.has(card.id) ? "is-selected" : ""} ${state.newlyAdded.has(card.id) ? "is-new" : ""}">
                <input type="checkbox" data-board-evidence value="${card.id}" ${state.selected.has(card.id) ? "checked" : ""} />
                <span>${escapeHtml(card.id)}</span>
                <strong>${escapeHtml(card.title)}</strong>
                <small>${escapeHtml(card.tags.join(" / "))}</small>
                <p>${escapeHtml(card.boardHint || card.detail || card.playerText)}</p>
              </label>
            `).join("")}
          </div>
        </section>
        <aside class="insight-panel">
          <div class="panel-heading">
            <p class="eyebrow">Findings</p>
            <h2>확정된 결론</h2>
          </div>
          <div class="rule-meter">
            ${data.BOARD_RULES.map((rule) => `
              <span class="${state.solved.has(rule.id) ? "is-solved" : ""}">${escapeHtml(rule.id)}</span>
            `).join("")}
          </div>
          <div class="insight-list">
            ${state.insights.map((item) => `
              <article class="insight-card">
                <span>${escapeHtml(item.id)} · ${escapeHtml(item.kind)}</span>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.result)}</p>
              </article>
            `).join("") || `<p class="empty-note">아직 확정된 연결이 없습니다.</p>`}
          </div>
          <div class="hint-box">
            <h3>추가 단서</h3>
            ${renderHintContent()}
          </div>
        </aside>
      </div>
    `;
  }

  function renderHintContent() {
    if (state.hintIndex < 0) {
      return `
        <p role="status" aria-live="polite">막힐 때만 추가 단서를 여세요. 공개 전에는 추리 보드가 어떤 방향도 대신 말하지 않습니다.</p>
        <button type="button" data-action="use-hint">첫 단서 열기</button>
      `;
    }
    const hint = data.HINTS[Math.min(state.hintIndex, data.HINTS.length - 1)];
    if (!hint) return `<p>더 이상 공개할 단서가 없습니다.</p>`;
    return `
      <p role="status" aria-live="polite"><strong>${escapeHtml(hint.axis)}</strong> · ${escapeHtml(hint.text)}</p>
      <button type="button" data-action="use-hint" ${state.hintIndex >= data.HINTS.length - 1 ? "disabled" : ""}>다음 단서 열기</button>
    `;
  }

  function renderFinal() {
    const ready = finalReady();
    if (!ready) {
      return `
        <section class="case-card final-locked" id="finalView">
          <p class="eyebrow">Locked</p>
          <h2>최종 고발장은 아직 열 수 없습니다.</h2>
          <p>핵심 연결과 용의자 검증을 충분히 마친 뒤 제출 화면이 열립니다.</p>
        </section>
      `;
    }
    return `
      <section class="final-layout" id="finalView">
        <div class="final-brief">
          <p class="eyebrow">Accusation</p>
          <h2>최종 고발장</h2>
          <p>핵심 추리와 용의자 해소가 충분히 확정되었습니다.</p>
          <div class="final-checks">
            ${["R1", "R2", "R3", "R5", "R6", "R7", "R8"].map((id) => `
              <span class="${state.solved.has(id) ? "is-solved" : ""}">${escapeHtml(id)}</span>
            `).join("")}
          </div>
          ${state.finalResult ? renderFinalResult() : ""}
        </div>
        <form class="final-form" id="finalForm">
          <label>
            <span>범인</span>
            <select name="culprit">
              <option value="">선택</option>
              ${data.SUSPECTS.map((suspect) => `<option value="${suspect.id}">${escapeHtml(suspect.name)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>진짜 범행 시각</span>
            <select name="trueTime">
              <option value="">선택</option>
              <option value="21:08">21:08</option>
              <option value="21:17">21:17</option>
              <option value="21:21">21:21</option>
            </select>
          </label>
          <label>
            <span>도난 수단</span>
            <textarea name="method"></textarea>
          </label>
          <label>
            <span>경보 조작</span>
            <textarea name="staging"></textarea>
          </label>
          <label>
            <span>은닉 장소</span>
            <textarea name="hidden"></textarea>
          </label>
          <label>
            <span>동기</span>
            <textarea name="motive"></textarea>
          </label>
          <div class="final-evidence-pool">
            ${data.FINAL_ACCUSATION.requiredEvidencePool.map((id) => {
              const card = evidenceById.get(id);
              const unlocked = state.discovered.has(id);
              return `
                <label class="${unlocked ? "" : "is-locked"}">
                  <input type="checkbox" data-final-evidence value="${id}" ${unlocked ? "" : "disabled"} />
                  <span>${escapeHtml(id)} · ${escapeHtml(card?.title || id)}</span>
                </label>
              `;
            }).join("")}
          </div>
          <button type="button" class="primary-action" data-action="submit-final">고발장 제출</button>
        </form>
      </section>
    `;
  }

  function renderFinalResult() {
    const result = state.finalResult;
    const labels = {
      culprit: "범인",
      time: "시간",
      method: "수단",
      staging: "경보",
      hidden: "은닉",
      motive: "동기",
      evidence: "증거",
    };
    return `
      <article class="score-card ${result.accepted ? "is-pass" : "is-fail"}" role="status" aria-live="polite">
        <strong>${result.score}점</strong>
        <p>${escapeHtml(result.text)}</p>
        <div class="result-tags">
          ${Object.entries(labels).map(([key, label]) => `
            <span class="${result.checks?.[key] ? "is-solved" : ""}">${escapeHtml(label)}</span>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderReveal() {
    if (!state.finalResult?.accepted) {
      return `
        <section class="case-card">
          <p class="eyebrow">Locked</p>
          <h2>리빌은 아직 봉인되어 있습니다.</h2>
        </section>
      `;
    }
    const shown = data.REVEAL_STEPS.slice(0, state.revealIndex + 1);
    return `
      <section class="reveal-layout" id="revealView">
        <div class="reveal-header">
          <p class="eyebrow">Case Closed</p>
          <h2>${escapeHtml(data.CASE.finalLine)}</h2>
          <button type="button" class="primary-action" data-action="next-reveal" ${state.revealIndex >= data.REVEAL_STEPS.length - 1 ? "disabled" : ""}>
            다음 기록
          </button>
        </div>
        <div class="reveal-list">
          ${shown.map((step) => `
            <article class="reveal-card">
              <span>${escapeHtml(step.id)}</span>
              <strong>${escapeHtml(step.title)}</strong>
              <p>${escapeHtml(step.text)}</p>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function publicInterviewAnswer(suspect, mode) {
    if (mode === "alibi") return suspect.claimedAlibi;
    if (mode === "relationship") return "관계 진술은 증거와 대조한 뒤 판단하세요.";
    return "현재 공개된 진술은 검증 전입니다. 주장 알리바이를 먼저 확인하고 현장 증거와 대조하세요.";
  }

  function render() {
    app.innerHTML = state.started ? renderShell() : renderStart();
  }

  function renderNotebookResults() {
    const grid = app.querySelector("#notebookView");
    if (!grid) return;
    const cards = filteredEvidence();
    grid.innerHTML = cards.map((card) => renderEvidenceCard(card)).join("") || `<p class="empty-note">아직 확보한 증거가 없습니다. 현장에서 조사할 항목을 선택하세요.</p>`;
  }

  function setView(view) {
    if (view === "reveal" && !state.finalResult?.accepted) return;
    if (view === "final" && !finalReady()) return;
    state.activeView = view;
  }

  function handleClick(event) {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === "open-case") {
      const input = document.getElementById("teamNameInput");
      state.teamName = input?.value.trim() || "Orbit cold case";
      state.started = true;
      render();
      return;
    }

    if (action === "set-view") setView(actionEl.dataset.view);
    if (action === "set-location") {
      state.activeLocation = actionEl.dataset.location;
      state.activeView = "scene";
    }
    if (action === "collect") collectEvidence(actionEl.dataset.evidence);
    if (action === "set-filter") state.notebookFilter = actionEl.dataset.filter;
    if (action === "open-suspect") {
      state.activeSuspect = actionEl.dataset.suspect;
      state.activeView = "suspects";
      state.interviewEvidence = "";
    }
    if (action === "set-suspect") {
      state.activeSuspect = actionEl.dataset.suspect;
      state.interviewEvidence = "";
    }
    if (action === "ask") state.interviewMode = actionEl.dataset.mode;
    if (action === "present-evidence") state.interviewEvidence = actionEl.dataset.evidence;
    if (action === "clear-selection") {
      state.selected.clear();
      state.boardFeedback = null;
    }
    if (action === "submit-board") {
      submitBoard();
      return;
    }
    if (action === "use-hint") {
      if (state.hintIndex < data.HINTS.length - 1) {
        state.hintsUsed += 1;
        state.hintIndex += 1;
      }
    }
    if (action === "submit-final") {
      submitFinalForm();
      return;
    }
    if (action === "next-reveal") {
      state.revealIndex = Math.min(data.REVEAL_STEPS.length - 1, state.revealIndex + 1);
    }

    render();
  }

  function handleChange(event) {
    const target = event.target;
    if (target.matches("[data-board-evidence]")) {
      if (target.checked) state.selected.add(target.value);
      else state.selected.delete(target.value);
      state.boardFeedback = null;
      render();
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (target.matches("[data-search-input]")) {
      state.search = target.value;
      renderNotebookResults();
      return;
    }
    if (target.id === "teamNameInput") state.teamName = target.value;
  }

  function installTestHooks() {
    window.gameTestApi = {
      snapshot() {
        return {
          title: data.CASE.title,
          started: state.started,
          view: state.activeView,
          evidenceCount: state.discovered.size,
          totalEvidence: data.EVIDENCE.length,
          suspects: data.SUSPECTS.length,
          locations: data.LOCATIONS.length,
          rules: data.BOARD_RULES.length,
          discovered: sortEvidence(state.discovered),
          solved: Array.from(state.solved).sort(),
          cleared: Array.from(state.cleared).sort(),
          finalReady: finalReady(),
          finalResult: state.finalResult,
          unlockNotice: state.unlockNotice,
          newlyAvailable: Array.from(state.newlyAvailable).sort(),
          newlyAdded: Array.from(state.newlyAdded).sort(),
          wrongFeedback: state.boardFeedback?.tone === "wrong" ? state.boardFeedback.text : "",
        };
      },
      open() {
        state.started = true;
        render();
        return this.snapshot();
      },
      setView(view) {
        setView(view);
        render();
        return this.snapshot();
      },
      collect(ids = "all") {
        if (ids === "all") collectAvailableEvidence();
        else [].concat(ids).forEach((id) => collectEvidence(id));
        render();
        return this.snapshot();
      },
      wrongLink() {
        state.started = true;
        ["E01", "E05"].forEach((id) => state.discovered.add(id));
        state.selected = new Set(["E01", "E05"]);
        const result = submitBoard(false);
        render();
        return { result, snapshot: this.snapshot() };
      },
      solveRule(id) {
        state.started = true;
        const rule = ruleById.get(id);
        if (!rule) return { ok: false, reason: "missing_rule", snapshot: this.snapshot() };
        rule.required.forEach((evidenceId) => state.discovered.add(evidenceId));
        state.selected = new Set(rule.required);
        const result = submitBoard(false);
        collectAvailableEvidence();
        render();
        return { result, snapshot: this.snapshot() };
      },
      submitFinal(payload = {}) {
        const result = submitFinalPayload(
          {
            culprit: "seoyun",
            trueTime: "21:08",
            method: "복제 마스터 카드로 케이스를 열고 자석 센서 장치로 운석 도난 시간을 숨겼다.",
            staging: "조정실에서 낚시줄을 원격으로 당겨 21:17 경보가 늦게 울리게 했다.",
            hidden: "별자리 지도 보관통을 장비 상자 안에 숨겼다.",
            motive: "아버지의 발견을 표절당했다는 원한과 빚, 돈 문제가 겹쳤다.",
            evidence: data.FINAL_ACCUSATION.requiredEvidencePool.slice(0, 6),
            ...payload,
          },
          false,
        );
        render();
        return { result, snapshot: this.snapshot() };
      },
    };

    window.render_game_to_text = () => JSON.stringify(window.gameTestApi.snapshot());
  }

  app.addEventListener("click", handleClick);
  app.addEventListener("change", handleChange);
  app.addEventListener("input", handleInput);
  installTestHooks();
  render();
})();
