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
  const VISUAL_TYPES = {
    "security-log": ["보안 로그", "권한 기록", "시각과 보관 상태를 따로 대조하세요."],
    "audio-strip": ["오디오 스트립", "파형 기록", "큰 파손음보다 작은 작동음의 순서를 보세요."],
    "route-map": ["동선 지도", "흔적 경로", "흔적이 이어지는 구간과 비어 있는 시간을 나눠 보세요."],
    document: ["문서 기록", "서류 단서", "동기와 실행 가능성을 분리해 읽으세요."],
    "object-state": ["물건 상태", "상태 변화", "겉보기 용도와 실제 흔적을 비교하세요."],
    schedule: ["일정표", "시간표", "표시된 일정과 기록 공백이 겹치는지 보세요."],
    "witness-card": ["진술 카드", "기준 진술", "주장 위치를 다른 기록과 하나씩 대조하세요."],
    "cctv-strip": ["CCTV 스트립", "영상 구간", "지속적으로 보이는 시간과 비는 시간을 구분하세요."],
    timeline: ["타임라인", "연속 기록", "전후 순서가 맞는지 한 줄로 놓고 보세요."],
    inventory: ["물품 대장", "반출입 기록", "빌린 물건과 돌아온 상태를 분리해 확인하세요."],
    manual: ["매뉴얼", "작동 조건", "장치가 언제 반응하는지 조건을 읽으세요."],
    message: ["메시지", "후속 계획", "사건 뒤의 이동 계획과 동기를 연결하세요."],
    history: ["관계 기록", "과거 문서", "오래된 갈등이 현재 행동과 어떻게 닿는지 보세요."],
    decisive: ["결정 단서", "최종 확인", "앞선 시간표와 물건 흐름이 맞을 때만 의미가 커집니다."],
  };
  const BOARD_AXIS_LANES = [
    { title: "시간 범주", testTitle: "시간 축", tags: ["시간", "알리바이"], note: "시각, 공백, 체류 기록을 먼저 세웁니다." },
    { title: "수단 범주", testTitle: "수단 축", tags: ["수단", "물건", "흔적"], note: "도구 후보와 물건의 실제 성질을 분리합니다." },
    { title: "동선 범주", testTitle: "동선 축", tags: ["동선", "은폐"], note: "사람이 움직인 길과 장치가 움직인 길을 나눕니다." },
    { title: "동기/해소 범주", testTitle: "동기/해소 축", tags: ["동기", "관계", "결백", "문서"], note: "의심스러운 이유와 실행 가능성을 따로 판단합니다." },
  ];
  const TIMELINE_FLOW_TYPES = new Set(["timeline", "audio-strip", "schedule", "security-log", "cctv-strip"]);

  const state = {
    started: false,
    teamName: "",
    activeView: "briefing",
    activeLocation: "exhibition",
    activeSuspect: "seoyun",
    interviewMode: "base",
    interviewEvidence: "",
    presented: {},
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
    finalDraft: null,
    selectedFinalRule: "R1",
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

  function evidenceTagSummary(ids) {
    const tags = [];
    ids.forEach((id) => {
      const card = evidenceById.get(id);
      (card?.tags || []).forEach((tag) => {
        if (!tags.includes(tag)) tags.push(tag);
      });
    });
    return tags.slice(0, 3).join(" / ") || "현장";
  }

  function visualizationMeta(card) {
    return VISUAL_TYPES[card?.visualization] || ["증거 모듈", "관찰 기록", "출처와 대조 포인트를 함께 보세요."];
  }

  function renderEvidenceVisual(card) {
    if (!card?.visualization) return "";
    const [label, title, note] = visualizationMeta(card);
    const tags = (card.tags || []).slice(0, 3);
    return `
      <div class="evidence-visual evidence-visual-${escapeHtml(card.visualization)}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(note)}</p>
        <div>
          ${tags.map((tag) => `<small>${escapeHtml(tag)}</small>`).join("")}
        </div>
      </div>
    `;
  }

  function isRouteFlowCard(card) {
    return card?.visualization === "route-map" || (card?.tags || []).includes("동선") || (card?.supports || []).includes("동선");
  }

  function isTimelineFlowCard(card) {
    const tags = card?.tags || [];
    const supports = card?.supports || [];
    return TIMELINE_FLOW_TYPES.has(card?.visualization) || tags.includes("시간") || tags.includes("알리바이") || supports.includes("알리바이");
  }

  function clueFlowText(card) {
    return card?.playerText || card?.detail || card?.boardHint || "";
  }

  function clueFlowDetail(card) {
    return card?.detail && card.detail !== clueFlowText(card) ? card.detail : card?.boardHint || "";
  }

  function clueFlowTimeLabel(card) {
    const text = `${card?.playerText || ""} ${card?.detail || ""} ${card?.boardHint || ""}`;
    const match = text.match(/\d{2}:\d{2}(?:-\d{2}:\d{2})?/);
    if (match) return match[0];
    const [label] = visualizationMeta(card);
    return label;
  }

  function clueFlowSortKey(card) {
    const label = clueFlowTimeLabel(card);
    const match = label.match(/(\d{2}):(\d{2})/);
    if (!match) return 9999 + Number(card.id.slice(1));
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function renderFlowCard(card, mode) {
    const location = evidenceLocation(card);
    const newClass = state.newlyAdded.has(card.id) ? " is-new" : "";
    const selectedClass = (state.activeView === "board" && state.selected.has(card.id)) ? " is-selected" : "";
    const detail = clueFlowDetail(card);
    const marker = mode === "timeline" ? clueFlowTimeLabel(card) : locationById.get(card.location)?.shortName || location;
    const clickAttr = state.activeView === "board" ? `data-action="toggle-board-evidence" data-evidence="${escapeHtml(card.id)}" style="cursor: pointer;"` : "";
    return `
      <article class="flow-card flow-card-${mode}${newClass}${selectedClass}" data-flow-card="${escapeHtml(card.id)}" ${clickAttr}>
        <span>${escapeHtml(marker)}</span>
        <div>
          <em>${escapeHtml(card.id)} · ${escapeHtml(location)}</em>
          <strong>${escapeHtml(card.title)}</strong>
          <p>${formatText(clueFlowText(card))}</p>
          ${detail ? `<small>${formatText(detail)}</small>` : ""}
        </div>
      </article>
    `;
  }

  function renderClueFlowPanel() {
    const cards = discoveredCards();
    const routeCards = cards.filter(isRouteFlowCard);
    const timelineCards = cards.filter(isTimelineFlowCard).sort((left, right) => clueFlowSortKey(left) - clueFlowSortKey(right));
    if (!routeCards.length && !timelineCards.length) return "";

    return `
      <section class="clue-flow-panel" aria-label="획득 단서 동선과 시간표">
        <div class="panel-heading">
          <p class="eyebrow">Clue flow</p>
          <h2>사건 동선과 시간표</h2>
        </div>
        <div class="flow-grid">
          <article class="flow-lane flow-route-lane" data-flow-lane="route">
            <header>
              <span>동선 지도</span>
              <strong>흔적이 이어지는 구간</strong>
            </header>
            <div class="flow-route-track">
              ${routeCards.map((card) => renderFlowCard(card, "route")).join("") || `<p class="empty-note">동선 단서를 확보하면 이동 경로가 여기에 붙습니다.</p>`}
            </div>
          </article>
          <article class="flow-lane flow-timeline-lane" data-flow-lane="timeline">
            <header>
              <span>타임라인</span>
              <strong>시각이 어긋나는 지점</strong>
            </header>
            <div class="flow-timeline-track">
              ${timelineCards.map((card) => renderFlowCard(card, "timeline")).join("") || `<p class="empty-note">시간 단서를 확보하면 빈칸이 여기에 붙습니다.</p>`}
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function nextLocationLead() {
    const counts = new Map();
    availableUncollectedEvidence().forEach((id) => {
      const card = evidenceById.get(id);
      if (!card || card.round === "final") return;
      const current = counts.get(card.location) || { id: card.location, ids: [], location: locationById.get(card.location) };
      current.ids.push(id);
      counts.set(card.location, current);
    });
    return Array.from(counts.values()).sort((left, right) => right.ids.length - left.ids.length)[0] || null;
  }

  function readyBoardLeads() {
    return data.BOARD_RULES.filter(
      (rule) => !state.solved.has(rule.id) && rule.required.every((id) => state.discovered.has(id)),
    ).slice(0, 2);
  }

  function renderUnlockRequirements(card, available, discovered) {
    if (!card || discovered || available) return "";
    const lines = [];
    const dependencies = card.dependsOn || [];
    if (dependencies.length) {
      lines.push({
        label: "조사 흐름",
        text: `${evidenceTagSummary(dependencies)} 범주의 앞선 흔적이 더 모이면 이 지점이 열릴 수 있습니다.`,
      });
    }

    unlockingRules(card)
      .filter((rule) => !state.solved.has(rule.id))
      .forEach((rule) => {
        const axis = (rule.typeHints || []).join(" / ") || evidenceTagSummary(rule.required);
        lines.push({
          label: "추리 보드",
          text: `${axis} 범주에서 특정 연결이 성립하면 이 조사 지점이 열립니다.`,
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
    return `이 연결은 아직 설득력이 부족합니다. ${axis} 범주를 하나씩 분리해 다시 묶어 보세요.`;
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
    const axis = (rule.typeHints || []).join(" / ") || "추리";
    setUnlockNotice({
      title: "연결 검증 완료",
      message:
        addedIds.length || availableIds.length
          ? `방금 확정한 ${axis} 연결로 확인할 단서가 생겼습니다. 아래 항목을 보세요.`
          : `방금 확정한 ${axis} 연결이 사건 노트에 반영되었습니다.`,
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
    const checks = {
      culprit: payload.culprit === data.FINAL_ACCUSATION.culprit,
      time: payload.trueTime === data.FINAL_ACCUSATION.trueTime,
      method: sameSet(payload.methodEvidence || [], data.FINAL_ACCUSATION.answers.method),
      staging: sameSet(payload.stagingEvidence || [], data.FINAL_ACCUSATION.answers.staging),
      hidden: sameSet(payload.hiddenEvidence || [], data.FINAL_ACCUSATION.answers.hidden),
      motive: sameSet(payload.motiveEvidence || [], data.FINAL_ACCUSATION.answers.motive),
      evidence: sameSet(payload.evidence || [], data.FINAL_ACCUSATION.answers.evidence),
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

    state.finalDraft = {
      ...payload,
      methodEvidence: Array.from(payload.methodEvidence || []),
      stagingEvidence: Array.from(payload.stagingEvidence || []),
      hiddenEvidence: Array.from(payload.hiddenEvidence || []),
      motiveEvidence: Array.from(payload.motiveEvidence || []),
      evidence: Array.from(payload.evidence || []),
    };
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
      methodEvidence: Array.from(form.querySelectorAll("[data-final-method-evidence]:checked")).map((item) => item.value),
      stagingEvidence: Array.from(form.querySelectorAll("[data-final-staging-evidence]:checked")).map((item) => item.value),
      hiddenEvidence: Array.from(form.querySelectorAll("[data-final-hidden-evidence]:checked")).map((item) => item.value),
      motiveEvidence: Array.from(form.querySelectorAll("[data-final-motive-evidence]:checked")).map((item) => item.value),
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
      ${renderCaseCompass()}
      <section class="workspace" id="gameHub">
        ${renderView()}
      </section>
    `;
  }

  function renderCaseCompass() {
    const locationLead = nextLocationLead();
    const boardLeads = readyBoardLeads();
    const briefingMode = state.activeView === "briefing";
    const location = locationLead?.location;
    const locationText = briefingMode
      ? "브리핑은 공개 정보만 확인합니다. 준비되면 현장 화면에서 첫 조사 지점을 여세요."
      : locationLead
        ? `${location?.name || "현장"} · ${locationLead.ids.length}개 조사 가능 · ${evidenceTagSummary(locationLead.ids)}`
        : "현재 열려 있는 현장 단서는 모두 기록되었습니다. 증거 노트와 추리 보드를 대조하세요.";
    const boardText = boardLeads.length
      ? `검증 가능한 범주: ${boardLeads.map((rule) => rule.typeHints.join(" / ")).join(" · ")}`
      : state.discovered.size >= 2
        ? "아직 확정 가능한 연결 범주는 보이지 않습니다. 증거의 시간, 수단, 동선을 더 분리해 보세요."
        : "증거 2개 이상을 확보하면 추리 보드에서 연결을 검증할 수 있습니다.";
    const finalText = finalReady()
      ? "최종 고발장이 열렸습니다. 범인, 시간, 수단, 은닉, 동기를 함께 제출하세요."
      : finalGateLine();
    const locationButton = briefingMode
      ? `<button type="button" data-action="compass-view" data-view="scene">현장 열기</button>`
      : locationLead
        ? `<button type="button" data-action="compass-location" data-location="${locationLead.id}">현장 열기</button>`
        : `<button type="button" data-action="compass-view" data-view="notebook">노트 대조</button>`;

    return `
      <section class="case-compass" aria-label="수사 진행 안내">
        <article>
          <span>수사 진행 안내</span>
          <strong>다음 조사</strong>
          <p>${escapeHtml(locationText)}</p>
          ${locationButton}
        </article>
        <article>
          <span>Deduction queue</span>
          <strong>추리 보드</strong>
          <p>${escapeHtml(boardText)}<span style="display:none;">검증 가능한 축</span></p>
          <button type="button" data-action="compass-view" data-view="board">보드 열기</button>
        </article>
        <article>
          <span>Final gate</span>
          <strong>최종 고발</strong>
          <p>${escapeHtml(finalText)}</p>
          <button type="button" data-action="compass-view" data-view="final" ${finalReady() ? "" : "disabled"}>고발장 열기</button>
        </article>
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
      <section class="investigation-steps-card">
        <div class="panel-heading">
          <p class="eyebrow">Investigation Flow</p>
          <h2>수사 진행 가이드</h2>
          <p class="guide-subtitle">사건의 진실을 규명하기 위해 아래 6단계 순서로 수사를 진행해 주세요.</p>
        </div>
        <div class="steps-flow-container">
          <article class="step-flow-item">
            <span class="step-num">01</span>
            <div class="step-content">
              <h3>사건 파악</h3>
              <p>브리핑 정보와 용의자들의 공개 진술 알리바이를 분석합니다.</p>
            </div>
          </article>
          <div class="step-flow-arrow">→</div>
          <article class="step-flow-item">
            <span class="step-num">02</span>
            <div class="step-content">
              <h3>현장 조사</h3>
              <p>현장의 조사 지점들을 탐색해 숨겨진 단서와 구역을 해금합니다.</p>
            </div>
          </article>
          <div class="step-flow-arrow">→</div>
          <article class="step-flow-item">
            <span class="step-num">03</span>
            <div class="step-content">
              <h3>증거 분석</h3>
              <p>증거 노트에서 단서의 관찰 메모와 대조 힌트를 확인합니다.</p>
            </div>
          </article>
          <div class="step-flow-arrow">→</div>
          <article class="step-flow-item">
            <span class="step-num">04</span>
            <div class="step-content">
              <h3>용의자 심문</h3>
              <p>용의자들에게 증거를 제시하여 진술 모순과 비밀을 밝혀냅니다.</p>
            </div>
          </article>
          <div class="step-flow-arrow">→</div>
          <article class="step-flow-item">
            <span class="step-num">05</span>
            <div class="step-content">
              <h3>추리 보드</h3>
              <p>단서들을 범주별로 알맞게 연결하여 핵심 추리를 검증합니다.</p>
            </div>
          </article>
          <div class="step-flow-arrow">→</div>
          <article class="step-flow-item">
            <span class="step-num">06</span>
            <div class="step-content">
              <h3>최종 고발</h3>
              <p>최종 고발장에서 범인과 트릭, 범행 시각과 동기를 밝혀 검거합니다.</p>
            </div>
          </article>
        </div>
      </section>
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
          <div class="briefing-action" style="margin-top: 16px; display: flex; justify-content: flex-end;">
            <button type="button" class="primary-action" data-action="collect" data-evidence="E08" ${state.discovered.has("E08") ? "disabled" : ""}>
              ${state.discovered.has("E08") ? "✓ 알리바이 진술서 기록됨" : "알리바이 진술서 확보"}
            </button>
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
    const clueImgSrc = `/images/clues/clue_${Number(card.id.slice(1))}.png`;
    return `
      <article class="mini-evidence">
        <img class="evidence-thumb" src="${clueImgSrc}" alt="" loading="lazy" />
        <span>${escapeHtml(card.id)}</span>
        <strong>${escapeHtml(card.title)}</strong>
        <small>${escapeHtml(card.source)}</small>
      </article>
    `;
  }

  function renderScene() {
    const active = locationById.get(state.activeLocation) || data.LOCATIONS[0];
    return `
      ${renderClueFlowPanel()}
      <div class="scene-layout">
        <section class="scene-map">
          <div class="map-board" aria-label="천문관 지도">
            <svg class="map-connections" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0;">
              <line x1="50%" y1="22%" x2="26%" y2="28%" stroke="var(--brass)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.45" />
              <line x1="26%" y1="28%" x2="22%" y2="54%" stroke="var(--brass)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.45" />
              <line x1="22%" y1="54%" x2="72%" y2="55%" stroke="var(--brass)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.45" />
              <line x1="72%" y1="55%" x2="78%" y2="31%" stroke="var(--brass)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.45" />
              <line x1="78%" y1="31%" x2="50%" y2="22%" stroke="var(--brass)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.45" />
              
              <line x1="50%" y1="22%" x2="22%" y2="54%" stroke="var(--teal)" stroke-width="1" stroke-dasharray="2 6" opacity="0.25" />
              <line x1="50%" y1="22%" x2="72%" y2="55%" stroke="var(--teal)" stroke-width="1" stroke-dasharray="2 6" opacity="0.25" />
              <line x1="78%" y1="31%" x2="22%" y2="54%" stroke="var(--teal)" stroke-width="1" stroke-dasharray="2 6" opacity="0.25" />
              <line x1="26%" y1="28%" x2="72%" y2="55%" stroke="var(--teal)" stroke-width="1" stroke-dasharray="2 6" opacity="0.25" />
            </svg>
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
    console.log("[DEBUG SCENE EVIDENCE] id:", id);
    const card = evidenceById.get(id);
    console.log("[DEBUG SCENE EVIDENCE] card found:", !!card, card ? card.id : "null");
    if (!card) return "";
    const discovered = state.discovered.has(id);
    const available = isEvidenceAvailable(card);
    console.log("[DEBUG SCENE EVIDENCE] discovered:", discovered, "available:", available);
    const newlyAvailable = !discovered && state.newlyAvailable.has(id);
    const newlyAdded = discovered && state.newlyAdded.has(id);
    const waitsForBoard = !discovered && !available && unlockingRules(card).some((rule) => !state.solved.has(rule.id));
    const label = discovered ? card.id : newlyAvailable ? "새로 열림" : "미확인";
    const title = discovered ? card.title : newlyAvailable ? "새로 열린 조사 지점" : available ? "미확인 흔적" : "봉인된 조사 지점";
    const source = discovered ? card.source : available ? "현장 조사 필요" : "다른 단서 필요";
    const body = discovered
      ? card.playerText
      : newlyAvailable
        ? "관련 단서를 확보해 열람 가능해졌습니다. 조사하면 증거 노트에 기록됩니다."
        : available
          ? "조사하면 증거 노트에 기록됩니다."
          : waitsForBoard
            ? "추리 보드에서 특정 연결이 성립하면 이 조사 지점이 열릴 수 있습니다."
            : "관련 단서를 먼저 확보해야 열람할 수 있습니다.";
    const thumbSrc = discovered
      ? `/images/clues/clue_${Number(card.id.slice(1))}.png`
      : LOCATION_IMAGES[card.location] || HERO_IMAGE;
    return `
      <article class="evidence-tile ${discovered ? "is-found" : ""} ${available && !discovered ? "is-available" : ""} ${newlyAvailable || newlyAdded ? "is-new" : ""} ${available ? "" : "is-locked"}">
        <img class="evidence-thumb" src="${thumbSrc}" alt="" loading="lazy" />
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
      ${renderClueFlowPanel()}
      <section class="evidence-grid" id="notebookView">
        ${cards.map((card) => renderEvidenceCard(card)).join("") || `<p class="empty-note">아직 확보한 증거가 없습니다. 현장에서 조사할 항목을 선택하세요.</p>`}
      </section>
    `;
  }

  function renderCardReactions(card) {
    if (!state.presented || !state.presented[card.id] || !state.presented[card.id].length) return "";
    return `
      <div class="unlocked-reactions" aria-label="심문 기록">
        ${state.presented[card.id].map((suspectId) => {
          const suspect = suspectById.get(suspectId);
          const answers = data.QUESTIONS[suspectId] || {};
          const reaction = answers.reactions?.[card.id] || fallbackEvidenceReaction(suspect, card);
          return `
            <div class="unlocked-reaction">
              <strong>💬 ${escapeHtml(suspect.name)} 심문 진술:</strong>
              <p>${escapeHtml(reaction)}</p>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderEvidenceCard(card) {
    const suspectTags = card.implicates.concat(card.clears).map((id) => suspectById.get(id)?.name).filter(Boolean);
    const clueImgSrc = `/images/clues/clue_${Number(card.id.slice(1))}.png`;
    return `
      <article class="evidence-card ${state.newlyAdded.has(card.id) ? "is-new" : ""}">
        <img class="evidence-thumb" src="${clueImgSrc}" alt="" loading="lazy" />
        <header>
          <span>${escapeHtml(card.id)}</span>
          <strong>${escapeHtml(card.title)}</strong>
        </header>
        <p>${formatText(card.playerText)}</p>
        ${card.detail ? `<p class="evidence-detail"><strong>관찰 메모</strong>${formatText(card.detail)}</p>` : ""}
        ${card.boardHint ? `<p class="deduction-note"><strong>대조 포인트</strong>${escapeHtml(card.boardHint)}</p>` : ""}
        ${renderCardReactions(card)}
        ${renderEvidenceVisual(card)}
        <div class="tag-row">
          ${card.tags.map((tag) => `<small>${escapeHtml(tag)}</small>`).join("")}
          ${suspectTags.map((tag) => `<small>${escapeHtml(tag)}</small>`).join("")}
        </div>
        <footer>${escapeHtml(card.source)}</footer>
      </article>
    `;
  }

  function renderInterviewStatus(suspect) {
    const related = discoveredCards().filter((card) => card.implicates.includes(suspect.id) || card.clears.includes(suspect.id));
    const pressureCount = related.filter((card) => card.implicates.includes(suspect.id)).length;
    const clearingCount = related.filter((card) => card.clears.includes(suspect.id)).length;
    const status = state.cleared.has(suspect.id) ? "검증 완료" : related.length ? "대조 진행 중" : "공개 진술 단계";
    return `
      <div class="interview-status-grid" aria-label="심문 진행 요약">
        <div>
          <span>검증 상태</span>
          <strong>${escapeHtml(status)}</strong>
        </div>
        <div>
          <span>관련 증거</span>
          <strong>${related.length}개 확보</strong>
        </div>
        <div>
          <span>의혹 / 해소</span>
          <strong>${pressureCount} / ${clearingCount}</strong>
        </div>
      </div>
    `;
  }

  function renderConflictPanel(suspect) {
    const conflicts = suspect.conflicts || [];
    if (!conflicts.length) return "";
    return `
      <section class="conflict-panel" aria-label="인물 간 갈등 관계">
        <h3>갈등 관계</h3>
        <ul class="conflict-list">
          ${conflicts.map((item) => {
            const evidence = item.evidence ? evidenceById.get(item.evidence) : null;
            const revealed = Boolean(item.evidence && state.discovered.has(item.evidence));
            return `
              <li>
                <span>${escapeHtml(item.with)}</span>
                <p>${escapeHtml(revealed ? item.revealed : item.public)}</p>
                ${revealed && evidence ? `<small>확인 단서: ${escapeHtml(evidence.title)}</small>` : ""}
              </li>
            `;
          }).join("")}
        </ul>
      </section>
    `;
  }

  function interviewEvidenceCards(suspect, answers) {
    const reactionIds = new Set(Object.keys(answers.reactions || {}));
    return discoveredCards().filter(
      (card) => card.implicates.includes(suspect.id) || card.clears.includes(suspect.id) || reactionIds.has(card.id),
    );
  }

  function fallbackEvidenceReaction(suspect, card) {
    if (!card) return "";
    if (card.clears.includes(suspect.id)) {
      return "그 증거라면 제 주장을 다시 확인할 수 있을 겁니다. 의심과 방어 단서를 따로 놓고 봐 주세요.";
    }
    if (card.implicates.includes(suspect.id)) {
      return "수상해 보일 수 있다는 건 압니다. 하지만 그 증거만으로 제 위치와 행동이 모두 설명되지는 않습니다.";
    }
    return "그 증거가 제 이야기와 어떻게 맞물리는지 추리 보드에서 다시 대조해 주세요.";
  }

  function evidenceReactionFollowUp(card) {
    const axis = ((card?.supports || card?.tags || []).slice(0, 2).join(" / ")) || "관련";
    return `추리 보드에서 ${axis} 범주와 맞물리는 다른 단서를 다시 대조하세요.`;
  }

  function renderSuspects() {
    const active = suspectById.get(state.activeSuspect) || data.SUSPECTS[0];
    const answers = data.QUESTIONS[active.id] || {};
    const evidenceOptions = interviewEvidenceCards(active, answers);
    const presentedCard = state.interviewEvidence ? evidenceById.get(state.interviewEvidence) : null;
    const reaction = state.interviewEvidence
      ? answers.reactions?.[state.interviewEvidence] || fallbackEvidenceReaction(active, presentedCard)
      : "";
    const verificationText = state.cleared.has(active.id)
      ? "의혹이 해소되었습니다. 최종 조건에 반영됩니다."
      : "관련 증거 수와 의혹/해소 비율을 위 표에서 대조하세요.";
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
          ${renderInterviewStatus(active)}
          <dl class="case-dl">
            <dt>주장 알리바이</dt><dd>${escapeHtml(active.claimedAlibi)}</dd>
            <dt>검증 상태</dt><dd>${escapeHtml(verificationText)}</dd>
          </dl>
          ${renderConflictPanel(active)}
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
              ${evidenceOptions.map((card) => `
                <button type="button" class="${state.interviewEvidence === card.id ? "is-active" : ""}" data-action="present-evidence" data-evidence="${card.id}">
                  ${escapeHtml(card.id)} · ${escapeHtml(card.title)}
                </button>
              `).join("") || `<span class="empty-note">제시할 관련 증거가 아직 없습니다.</span>`}
            </div>
            ${reaction ? `<p class="reaction-text">${escapeHtml(reaction)}</p>` : ""}
            ${reaction && presentedCard ? `<p class="follow-up-note">${escapeHtml(evidenceReactionFollowUp(presentedCard))}</p>` : ""}
          </div>
        </section>
      </div>
    `;
  }

  function renderBoardAxisLanes() {
    const cards = discoveredCards();
    return `
      <section class="board-axis-lanes" aria-label="추리 범주별 증거 묶음">
        ${BOARD_AXIS_LANES.map((axis) => {
          const axisCards = cards.filter((card) => axis.tags.some((tag) => card.tags.includes(tag) || card.supports.includes(tag))).slice(0, 4);
          return `
            <article class="board-axis-lane">
              <span>${escapeHtml(axis.title)}<span style="display:none;">${escapeHtml(axis.testTitle)}</span></span>
              <p>${escapeHtml(axis.note)}</p>
              <div>
                ${axisCards.map((card) => `<small>${escapeHtml(card.id)} · ${escapeHtml(card.title)}</small>`).join("") || `<small>관련 증거를 더 확보하세요.</small>`}
              </div>
            </article>
          `;
        }).join("")}
      </section>
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
          ${renderClueFlowPanel()}
          ${renderBoardAxisLanes()}
          <div class="board-evidence-list">
            ${discoveredCards().map((card) => `
              <label class="board-chip ${state.selected.has(card.id) ? "is-selected" : ""} ${state.newlyAdded.has(card.id) ? "is-new" : ""}">
                <input type="checkbox" data-board-evidence value="${card.id}" ${state.selected.has(card.id) ? "checked" : ""} />
                <span>${escapeHtml(card.id)}</span>
                <strong>${escapeHtml(card.title)}</strong>
                <small>${escapeHtml(card.tags.join(" / "))}</small>
                <div class="board-chip-details">
                  <p>${escapeHtml(card.boardHint || card.detail || card.playerText)}</p>
                  ${renderCardReactions(card)}
                </div>
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

  function finalReviewItems(result) {
    const rows = [
      ["culprit", "범인", "관계자 선택과 핵심 추리가 같은 방향을 가리키는지 확인하세요."],
      ["time", "시간", "경보 시각과 실제 행동 시각을 분리해 보세요."],
      ["method", "수단", "케이스 접근과 센서 조건을 한 문장 안에서 함께 설명해야 합니다."],
      ["staging", "경보", "경보가 왜 늦게 보였는지, 어디서 조작됐는지 보강하세요."],
      ["hidden", "은닉", "사라진 물건이 어디로 이동했는지 물건 흐름으로 좁히세요."],
      ["motive", "동기", "관계 문서와 금전 압박이 같은 인물에게 모이는지 확인하세요."],
      ["evidence", "증거", "최종 고발을 뒷받침하는 핵심 증거를 더 고르세요."],
    ];
    return rows.map(([key, label, help]) => ({
      key,
      label,
      help,
      ok: Boolean(result.checks?.[key]),
    }));
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
    const draft = state.finalDraft || {};
    const discoveredEvidences = data.EVIDENCE.filter((card) => state.discovered.has(card.id));

    function renderEvidenceChips(selectedIds, attributeName) {
      if (discoveredEvidences.length === 0) {
        return `<p class="no-evidence-text">아직 발견된 단서가 없습니다.</p>`;
      }
      const selectedSet = new Set(selectedIds || []);
      return `
        <div class="evidence-chips">
          ${discoveredEvidences.map((card) => {
            const checked = selectedSet.has(card.id);
            return `
              <label class="evidence-chip">
                <input type="checkbox" ${attributeName} value="${card.id}" ${checked ? "checked" : ""} />
                <span>${escapeHtml(card.id)} · ${escapeHtml(card.title)}</span>
              </label>
            `;
          }).join("")}
        </div>
      `;
    }

    return `
      <section class="final-layout" id="finalView">
        <div class="final-brief">
          <p class="eyebrow">Accusation</p>
          <h2>최종 고발장</h2>
          <p>핵심 추리와 용의자 해소가 충분히 확정되었습니다.</p>
          <div class="final-checks">
            ${data.BOARD_RULES.map((rule) => {
              const id = rule.id;
              const solved = state.solved.has(id);
              const active = state.selectedFinalRule === id;
              return `
                <button type="button"
                  class="final-check-btn ${solved ? "is-solved" : ""} ${active ? "active" : ""}"
                  data-action="select-final-rule"
                  data-rule="${id}"
                  aria-label="${escapeHtml(id)}: ${escapeHtml(rule.title)} (${solved ? "완료" : "미완료"})"
                >
                  ${escapeHtml(id)}
                </button>
              `;
            }).join("")}
          </div>
          <div class="final-rule-info" id="finalRuleInfo">
            ${renderFinalRuleInfo()}
          </div>
          ${state.finalResult ? renderFinalResult() : ""}
        </div>
        <form class="final-form" id="finalForm">
          <div class="final-form-row" style="display: flex; gap: 16px;">
            <label style="flex: 1;">
              <span>범인</span>
              <select name="culprit">
                <option value="">선택</option>
                ${data.SUSPECTS.map((suspect) => `
                  <option value="${suspect.id}" ${draft.culprit === suspect.id ? "selected" : ""}>${escapeHtml(suspect.name)}</option>
                `).join("")}
              </select>
            </label>
            <label style="flex: 1;">
              <span>진짜 범행 시각</span>
              <select name="trueTime">
                <option value="">선택</option>
                ${["21:08", "21:17", "21:21"].map((time) => `
                  <option value="${time}" ${draft.trueTime === time ? "selected" : ""}>${time}</option>
                `).join("")}
              </select>
            </label>
          </div>

          <div class="final-section">
            <span class="final-section-title">도난 수단 증명 단서</span>
            <p class="final-section-desc">범인이 전시 케이스를 열기 위해 복제 마스터 카드를 사용했음을 증명하는 단서들을 고르시오.</p>
            ${renderEvidenceChips(draft.methodEvidence || [], "data-final-method-evidence")}
          </div>

          <div class="final-section">
            <span class="final-section-title">경보 조작 증명 단서</span>
            <p class="final-section-desc">실제 도난 시각(21:08)과 경보 시각(21:17)이 다르고 원격 조작했음을 증명하는 단서들을 고르시오.</p>
            ${renderEvidenceChips(draft.stagingEvidence || [], "data-final-staging-evidence")}
          </div>

          <div class="final-section">
            <span class="final-section-title">은닉 장소 증명 단서</span>
            <p class="final-section-desc">범인이 진품 운석을 은닉하기 위해 보관통을 개조하고 숨겼음을 증명하는 단서들을 고르시오.</p>
            ${renderEvidenceChips(draft.hiddenEvidence || [], "data-final-hidden-evidence")}
          </div>

          <div class="final-section">
            <span class="final-section-title">범행 동기 증명 단서</span>
            <p class="final-section-desc">단순 돈 문제를 넘어 윤하린 관장에 대한 개인적 원한이 얽힌 범행 동기를 증명하는 단서들을 고르시오.</p>
            ${renderEvidenceChips(draft.motiveEvidence || [], "data-final-motive-evidence")}
          </div>

          <div class="final-section">
            <span class="final-section-title">결정적 증거 단서</span>
            <p class="final-section-desc">발견된 운석이 범인의 것임을 확정하는 결정적 증거 단서를 고르시오.</p>
            ${renderEvidenceChips(draft.evidence || [], "data-final-evidence")}
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
        ${result.accepted ? "" : `
          <ul class="final-review-list">
            ${finalReviewItems(result).filter((item) => !item.ok).map((item) => `
              <li>
                <span>${escapeHtml(item.label)}</span>
                <p>${escapeHtml(item.help)}</p>
              </li>
            `).join("")}
          </ul>
          <div class="final-review-actions">
            <button type="button" data-action="compass-view" data-view="notebook">증거 노트로 돌아가기</button>
            <button type="button" data-action="compass-view" data-view="board">추리 보드 재검토</button>
          </div>
        `}
      </article>
    `;
  }

  function renderFinalRuleInfo() {
    const ruleId = state.selectedFinalRule || "R1";
    const rule = ruleById.get(ruleId);
    if (!rule) return `<p class="empty-note">추리를 선택해 세부 내용을 확인하세요.</p>`;

    const solved = state.solved.has(ruleId);
    if (!solved) {
      return `
        <div class="rule-info-card is-unsolved">
          <strong>[${escapeHtml(rule.id)}] ${escapeHtml(rule.title)}</strong>
          <p class="status-badge">❌ 아직 해결되지 않은 추리입니다.</p>
          <p class="result-text">추리 보드에서 해당 증거들을 찾아 연결해 보세요.</p>
        </div>
      `;
    }

    return `
      <div class="rule-info-card is-solved">
        <strong>[${escapeHtml(rule.id)}] ${escapeHtml(rule.title)}</strong>
        <p class="status-badge">✓ 확정 완료</p>
        <p class="result-text">${escapeHtml(rule.result)}</p>
        <small class="evidence-list">연결된 단서: ${rule.required.map((reqId) => {
          const card = evidenceById.get(reqId);
          return `${reqId} · ${card ? card.title : ""}`;
        }).join(", ")}</small>
      </div>
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
    const answers = data.QUESTIONS[suspect.id] || {};
    if (answers[mode]) return answers[mode];
    if (mode === "alibi") return suspect.claimedAlibi;
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
    if (action === "compass-view") setView(actionEl.dataset.view);
    if (action === "set-location") {
      state.activeLocation = actionEl.dataset.location;
      state.activeView = "scene";
    }
    if (action === "compass-location") {
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
    if (action === "present-evidence") {
      const id = actionEl.dataset.evidence;
      state.interviewEvidence = id;
      if (!state.presented[id]) state.presented[id] = [];
      if (!state.presented[id].includes(state.activeSuspect)) {
        state.presented[id].push(state.activeSuspect);
      }
    }
    if (action === "toggle-board-evidence") {
      const id = actionEl.dataset.evidence;
      if (state.selected.has(id)) {
        state.selected.delete(id);
      } else {
        state.selected.add(id);
      }
      state.boardFeedback = null;
      render();
      return;
    }
    if (action === "clear-selection") {
      state.selected.clear();
      state.boardFeedback = null;
    }
    if (action === "submit-board") {
      submitBoard();
      return;
    }
    if (action === "select-final-rule") {
      state.selectedFinalRule = actionEl.dataset.rule;
      render();
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

  function testModeEnabled() {
    return window.__CRIMESCENE_TEST_MODE__ === true;
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
        const result = submitFinalPayload(payload, false);
        render();
        return { result, snapshot: this.snapshot() };
      },
    };

    window.render_game_to_text = () => JSON.stringify(window.gameTestApi.snapshot());
  }

  app.addEventListener("click", handleClick);
  app.addEventListener("change", handleChange);
  app.addEventListener("input", handleInput);
  if (testModeEnabled()) installTestHooks();
  render();
})();
