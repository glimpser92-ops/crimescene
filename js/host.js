// =====================================================================
// 진행자 (Host) 컨트롤러
// =====================================================================
/* global io */
const socket = io();

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let state = null; // 서버로부터 전달받는 hostState

const PHASES = [
  'lobby', 'briefing', 'roles', 'investigation',
  'questioning', 'final', 'vote', 'reveal', 'end'
];

const PHASE_LABELS = {
  lobby: '1. 대기실 & 역할 배정',
  briefing: '2. 사건 브리핑 (슬라이드)',
  roles: '3. 참가자 역할 확인',
  investigation: '4. 단서 공유 토론 (구역 제어)',
  questioning: '5. 용의자 심문 (스포트라이트)',
  final: '6. 최종 토론',
  vote: '7. 범인 투표 진행 및 통제',
  reveal: '8. 진상 단계별 공개',
  end: '9. 사건 종결'
};

const BRIEFING_SLIDES = [
  '0. 타이틀 표지',
  '1. 사건 발생 상황 개요',
  '2. 피해자 강하늘 프로필',
  '3. 용의자 1 오덕후 프로필',
  '4. 용의자 2 박체육 프로필',
  '5. 용의자 3 나범인 프로필',
  '6. 용의자 4 이모범 프로필',
  '7. 알리바이 타임라인 표',
  '8. 조사 수칙 및 게임 안내'
];

const REVEAL_STEPS = [
  '0. 투표 결과 그래프 노출',
  '1. 진짜 범인 정체 공개 (나범인)',
  '2. 결정적 단서 ① 젖은 스케치 해설',
  '3. 결정적 단서 ② 노란 아크릴 파편 해설',
  '4. 결정적 단서 ③ 가방 속 윤활유 천 해설',
  '5. 나범인의 범행 타임라인 재구성',
  '6. 다른 용의자들의 진짜 비밀 해제',
  '7. 최종 사건 종결 엔딩'
];

// ----- 세션 저장/복원 ---------------------------------------------------
const HKEY = 'crimescene_host_session';
function saveHostSession(code, token) { localStorage.setItem(HKEY, JSON.stringify({ code, token })); }
function loadHostSession() { try { return JSON.parse(localStorage.getItem(HKEY)); } catch { return null; } }
function clearHostSession() { localStorage.removeItem(HKEY); }

// ----- 초기화 및 이벤트 연결 -------------------------------------------------
function init() {
  // 방 만들기
  $('#btn-create-room').addEventListener('click', () => {
    socket.emit('host:create', (res) => {
      if (!res.ok) return toast('방 생성에 실패했습니다: ' + res.error, true);
      saveHostSession(res.code, res.hostToken);
      attachHost(res.code, res.hostToken);
    });
  });

  // 복원 복구 버튼 처리
  const sess = loadHostSession();
  if (sess) {
    $('#rejoin-host-area').style.display = 'block';
    $('#btn-rejoin-host').addEventListener('click', () => {
      attachHost(sess.code, sess.token);
    });
  }

  // 타이머 공통 이벤트 연결
  $$('[data-timer-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state) return;
      const action = btn.dataset.timerAct;
      const seconds = parseInt(btn.dataset.sec || '0', 10);
      socket.emit('host:timer', { action, seconds }, (res) => {
        if (!res.ok) toast(res.error, true);
      });
    });
  });

  // 방 폭파 버튼
  $('#btn-destroy-room').addEventListener('click', () => {
    if (confirm('방을 폭파하고 초기화하시겠습니까?\n모든 플레이어가 튕기며 방 정보가 삭제됩니다.')) {
      clearHostSession();
      location.reload();
    }
  });
}

function attachHost(code, hostToken) {
  socket.emit('host:attach', { code, hostToken }, (res) => {
    if (!res.ok) {
      toast('방 연결 복원에 실패했습니다. 새 방을 생성해 주세요.', true);
      clearHostSession();
      $('#rejoin-host-area').style.display = 'none';
      return;
    }
    toast('진행방이 성공적으로 연동되었습니다.');
    $('#setup-box').style.display = 'none';
    $('#dashboard-box').style.display = 'block';
    
    // 페이즈 네비게이션 동적 렌더링
    renderPhaseNav();
  });
}

// ----- 소켓 데이터 수신 ----------------------------------------------------
socket.on('hostState', (hostState) => {
  state = hostState;
  render();
});

// ----- 타이머 틱 동기화 ----------------------------------------------------
let tickBase = null;
setInterval(() => {
  if (!tickBase || !tickBase.running) return;
  const passed = Math.floor((Date.now() - tickBase.at) / 1000);
  const r = Math.max(0, tickBase.remaining - passed);
  $('#host-timer-val').textContent = r > 0 ? fmtTime(r) : '00:00';
  $('#host-timer-val').classList.toggle('danger', r > 0 && r <= 60);
}, 500);

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = isError ? 'show error' : 'show';
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = ''), 2600);
}

function addBotPlayers(count, successMessage) {
  socket.emit('host:addBots', { count }, (res) => {
    if (!res.ok) return toast(res.error, true);
    const names = (res.added || []).map((b) => b.name).join(', ');
    toast(successMessage || `봇 ${res.added.length}명이 수사대에 합류했습니다${names ? `: ${names}` : ''}.`);
  });
}

// ----- UI 렌더링 -----------------------------------------------------------
function render() {
  if (!state) return;

  // 상단바 업데이트
  $('#host-code-val').textContent = state.code;
  $('#btn-open-display').href = `/display.html?room=${state.code}`;

  // 타이머 동기화 설정
  tickBase = { remaining: state.timer.remaining, at: Date.now(), running: state.timer.running };
  $('#host-timer-val').textContent = state.timer.running || state.timer.remaining > 0 ? fmtTime(state.timer.remaining) : '00:00';
  $('#host-timer-val').classList.remove('danger');

  // 플레이어 관리 렌더링
  renderPlayers();

  // 페이즈 네비게이션 활성화 클래스 조절
  $$('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.phase === state.phase);
  });

  // 역할 배정 요약 렌더링
  renderRoleSummary();

  // 진행자 전용 전체 정보 열람 렌더링
  renderHostIntel();

  // 현재 페이즈의 세부 제어창 렌더링
  renderPhaseDetail();
}

// ----- 진행자 전용: 용의자 비밀 시트 + 형사별 단서/힌트 분배표 ----------------
const CLUE_TYPE_LABELS = {
  decisive: ['🔴 결정적 단서', 'var(--red)'],
  'decisive-support': ['🔵 보강 단서', 'var(--cyan)'],
  support: ['🔵 기준 단서', 'var(--cyan)'],
  herring: ['🟠 레드 헤링', 'var(--orange)'],
  alibi: ['🟢 알리바이 증명', 'var(--green)'],
};

function renderHostIntel() {
  const box = $('#host-intel-detail');
  if (!box) return;

  // <details>를 다시 그리면 열림 상태가 풀리므로, 열려 있던 항목을 기억해 둔다
  const openKeys = new Set($$('#host-intel-detail details[open]').map(d => d.dataset.key));

  const suspectsHtml = state.hostView.suspects.map(s => {
    const player = state.players.find(p => p.suspectKey === s.key);
    const culprit = !!s.isCulprit;
    return `
      <details data-key="sus-${s.key}" ${openKeys.has('sus-' + s.key) ? 'open' : ''} style="margin-bottom:8px;">
        <summary style="cursor:pointer; color:${s.color}; font-weight:700;">
          ${s.emoji} ${s.name} ${culprit ? '<span class="red-t">★범인</span>' : ''} ${player ? `<span class="dim">— ${player.name}</span>` : ''}
        </summary>
        <div style="padding:8px 4px 4px 12px;">
          <div><b class="cyan">알리바이:</b> "${s.alibi}"</div>
          ${culprit
            ? `<div style="margin-top:6px;"><b class="red-t">진실:</b><ul style="padding-left:16px;">${(s.truth || []).map(t => `<li>${t}</li>`).join('')}</ul></div>
               <div style="margin-top:6px;"><b class="red-t">거짓말 가이드:</b><ul style="padding-left:16px;">${(s.lieGuide || []).map(t => `<li>${t}</li>`).join('')}</ul></div>`
            : `<div style="margin-top:6px;"><b class="yellow-t">숨겨진 진실:</b><ul style="padding-left:16px;">${(s.hiddenTruth || []).map(t => `<li>${t}</li>`).join('')}</ul></div>`}
        </div>
      </details>`;
  }).join('');

  let cluesHtml = '<div class="dim">게임 시작 후 형사별 단서 분배가 표시됩니다.</div>';
  if (state.started) {
    const detectives = state.players.filter(p => p.role === 'detective');
    cluesHtml = detectives.map(p => {
      const clueIds = state.hostView.clueAssign[p.id] || [];
      const clues = state.hostView.allClues.filter(c => clueIds.includes(c.id));
      return `
        <details data-key="det-${p.id}" ${openKeys.has('det-' + p.id) ? 'open' : ''} style="margin-bottom:8px;">
          <summary style="cursor:pointer; font-weight:700;">🕵️ ${p.name} <span class="dim">(단서 ${clues.length}개)</span></summary>
          <div style="padding:8px 4px 4px 12px;">
            ${clues.map(c => {
              const [label, color] = CLUE_TYPE_LABELS[c.type] || ['단서', 'var(--cyan)'];
              return `
                <div style="margin-bottom:10px; border-left:3px solid ${color}; padding-left:8px;">
                  <b>No.${String(c.id).padStart(2, '0')} ${c.emoji} ${c.title}</b>
                  <span style="color:${color}; font-size:0.78rem;">${label}</span><br/>
                  <span class="dim">${c.desc}</span><br/>
                  <span class="yellow-t">🔍 힌트: ${c.hint}</span>
                </div>`;
            }).join('')}
          </div>
        </details>`;
    }).join('') || '<div class="dim">형사가 없습니다.</div>';
  }

  box.innerHTML = `
    <details data-key="all-sus" ${openKeys.has('all-sus') ? 'open' : ''} style="margin-bottom:10px;">
      <summary style="cursor:pointer; font-weight:700;" class="purple-t">🎭 용의자 비밀 시트 4종</summary>
      <div style="padding-top:8px;">${suspectsHtml}</div>
    </details>
    <details data-key="all-clues" ${openKeys.has('all-clues') ? 'open' : ''}>
      <summary style="cursor:pointer; font-weight:700;" class="cyan">🧩 형사별 단서·힌트 분배표</summary>
      <div style="padding-top:8px;">${cluesHtml}</div>
    </details>`;
}

function renderPhaseNav() {
  const container = $('#phase-nav-container');
  container.innerHTML = PHASES.map(p => `
    <button class="nav-btn" data-phase="${p}">
      ${PHASE_LABELS[p]}
    </button>
  `).join('');

  // 이벤트 위임 연결
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    const phase = btn.dataset.phase;
    socket.emit('host:phase', { phase }, (res) => {
      if (!res.ok) toast(res.error, true);
    });
  });
}

function renderPlayers() {
  const botCount = state.players.filter(p => p.isBot).length;
  $('#player-count-badge').textContent = botCount > 0
    ? `${state.players.length} / 20명 · 봇 ${botCount}`
    : `${state.players.length} / 20명`;
  const list = $('#host-players-list');
  
  if (state.players.length === 0) {
    list.innerHTML = `<div class="dim center" style="padding: 10px;">참가한 플레이어가 없습니다.</div>`;
    return;
  }

  list.innerHTML = state.players.map(p => {
    let roleTag = '';
    if (p.role === 'suspect') {
      const sus = state.hostView.suspects.find(x => x.key === p.suspectKey);
      roleTag = `<span style="color:${sus.color}; font-weight:700;">[용의자:${sus.name}]</span>`;
    } else if (p.role === 'detective') {
      roleTag = `<span class="cyan">[형사]</span>`;
    }

    return `
      <div class="player-row ${p.connected ? '' : 'off'} ${p.isBot ? 'bot' : ''}">
        <div>
          <span>${p.isBot ? '🤖' : (p.connected ? '🟢' : '⚪')} <b>${p.name}</b></span>
          ${p.isBot ? '<span class="bot-chip">BOT</span>' : ''}
          <span style="font-size:0.82rem; margin-left: 5px;">${roleTag}</span>
        </div>
        <button class="kick-btn" data-kick-id="${p.id}">${p.isBot ? '정리' : '추방'}</button>
      </div>`;
  }).join('');

  // 강퇴 이벤트 위임 연결
  list.onclick = (e) => {
    const btn = e.target.closest('.kick-btn');
    if (!btn) return;
    const playerId = btn.dataset.kickId;
    const p = state.players.find(x => x.id === playerId);
    const message = p.isBot ? `${p.name} 봇을 대기실에서 정리하시겠습니까?` : `진짜로 ${p.name} 참가자를 내보내시겠습니까?`;
    if (confirm(message)) {
      socket.emit('host:kick', { playerId }, (res) => {
        if (!res.ok) toast(res.error, true);
      });
    }
  };
}

function renderRoleSummary() {
  const box = $('#role-assign-detail');
  if (!state.started) {
    box.innerHTML = `대기 단계입니다. 참가자가 충분히 들어오면 아래 버튼을 눌러 역할을 무작위로 배정해 주십시오. (최소 5명 필요)`;
    return;
  }

  const suspectsList = state.players
    .filter(p => p.role === 'suspect')
    .map(p => {
      const s = state.hostView.suspects.find(x => x.key === p.suspectKey);
      return `<li style="color:${s.color}"><b>${s.name} (${s.title}):</b> ${p.name} ${s.isCulprit ? '⚠️범인' : '정직'}</li>`;
    }).join('');

  const detectivesCount = state.players.filter(p => p.role === 'detective').length;

  box.innerHTML = `
    <ul style="padding-left:15px; margin-bottom: 10px;">
      ${suspectsList}
    </ul>
    <div><b>형사 인원:</b> ${detectivesCount}명</div>
    <div style="margin-top: 5px; font-size: 0.8rem;" class="yellow-t">※ 형사들에게는 24개의 단서가 고루 분배되었습니다.</div>`;
}

// ----- 단계별 세부 컨트롤 패널 동적 렌더링 -------------------------------------
function renderPhaseDetail() {
  const title = $('#phase-content-panel h2');
  const ctrl = $('#phase-detail-ctrl');
  
  title.textContent = PHASE_LABELS[state.phase] || state.phase;
  ctrl.innerHTML = '';

  switch (state.phase) {
    case 'lobby':
      let startDisabled = state.started ? 'disabled' : '';
      let assignText = state.started ? '역할 재배정' : '역할 임의 배정 (Role Randomize)';
      let warningsHtml = '';
      const botCount = state.players.filter(p => p.isBot).length;
      const humanCount = state.players.length - botCount;
      const seatsLeft = Math.max(0, 20 - state.players.length);
      const needToStart = Math.max(0, 5 - state.players.length);
      const botInputDefault = needToStart > 0 ? needToStart : Math.min(1, seatsLeft || 1);
      
      if (state.players.length < 5) {
        warningsHtml = `<p class="red-t" style="font-size:0.9rem; margin-bottom:12px;">⚠️ 원활한 게임 진행을 위해 최소 5명(용의자 4 + 형사 1) 이상의 대원이 필요합니다. (현재: ${state.players.length}명)</p>`;
      }

      ctrl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap: 15px;">
          ${warningsHtml}
          <div class="control-section bot-lab-panel">
            <div class="bot-lab-head">
              <div>
                <h3>🤖 수사 보조 봇 충원</h3>
                <p class="dim">학생 수가 부족할 때 네온 수사 봇을 참가자 명단에 넣어 인원을 채웁니다.</p>
              </div>
              <span class="label-chip">실제 ${humanCount} · 봇 ${botCount}</span>
            </div>
            <div class="row wrap" style="margin-top:14px; gap:10px;">
              <input class="input bot-count-input" id="bot-count-input" type="number" min="1" max="${Math.max(1, seatsLeft)}" value="${botInputDefault}" ${seatsLeft === 0 ? 'disabled' : ''}/>
              <button class="btn purple grow" id="btn-add-bots" ${seatsLeft === 0 ? 'disabled' : ''}>봇 추가</button>
              <button class="btn cyan grow" id="btn-fill-bots" ${needToStart === 0 || seatsLeft === 0 ? 'disabled' : ''}>부족 인원 자동 충원 (${needToStart})</button>
              <button class="btn ghost grow" id="btn-remove-bots" ${botCount === 0 ? 'disabled' : ''}>대기 봇 모두 정리</button>
            </div>
            <p class="dim" style="font-size:0.82rem; margin-top:10px;">
              역할 배정 시 용의자 4명은 가능한 실제 참가자에게 먼저 배정됩니다. 봇은 투표 필수 인원에는 포함되지 않습니다.
            </p>
          </div>
          <button class="btn purple" id="btn-assign-roles" ${startDisabled}>${assignText}</button>
          <button class="btn big" id="btn-start-game" ${startDisabled}>인물 프로필 및 사건 브리핑 개시 (Start)</button>
        </div>`;

      $('#btn-add-bots').addEventListener('click', () => {
        const inputCount = parseInt($('#bot-count-input').value || '1', 10);
        addBotPlayers(Math.max(1, Math.min(inputCount, seatsLeft)));
      });

      $('#btn-fill-bots').addEventListener('click', () => {
        if (needToStart > 0) addBotPlayers(needToStart, `부족한 ${needToStart}자리를 수사 봇으로 채웠습니다.`);
      });

      $('#btn-remove-bots').addEventListener('click', () => {
        if (botCount === 0) return;
        if (!confirm('대기 중인 봇 참가자를 모두 정리하시겠습니까?')) return;
        socket.emit('host:removeBots', {}, (res) => {
          if (!res.ok) return toast(res.error, true);
          toast(`봇 ${res.removed}명을 대기실에서 정리했습니다.`);
        });
      });

      $('#btn-assign-roles').addEventListener('click', () => {
        socket.emit('host:assignRoles', {}, (res) => {
          if (res.ok) toast('수사관 역할이 고루 배정되었습니다!');
          else toast(res.error, true);
        });
      });

      $('#btn-start-game').addEventListener('click', () => {
        socket.emit('host:start', {}, (res) => {
          if (res.ok) toast('사건이 공식적으로 브리핑됩니다.');
          else toast(res.error, true);
        });
      });
      break;

    case 'briefing':
      const currentSlideName = BRIEFING_SLIDES[state.slide] || '알 수 없는 슬라이드';
      const prevDisabled = state.slide === 0 ? 'disabled' : '';
      const nextDisabled = state.slide === 8 ? 'disabled' : '';

      const slideGridHtml = BRIEFING_SLIDES.map((name, idx) => `
        <button class="zone-ctrl-btn ${state.slide === idx ? 'active' : ''}" data-slide-jump="${idx}">
          ${name}
        </button>
      `).join('');

      ctrl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
          <div class="row justify-between" style="font-size:1.15rem;">
            <span>현재 슬라이드: <b>${currentSlideName}</b></span>
            <span>(${state.slide + 1} / 9)</span>
          </div>
          <div class="row" style="gap:15px; width:100%;">
            <button class="btn grow" id="btn-slide-prev" ${prevDisabled}>◀ 이전 장</button>
            <button class="btn grow" id="btn-slide-next" ${nextDisabled}>다음 장 ▶</button>
          </div>
          <div class="control-section">
            <h3>🎯 특정 슬라이드로 바로 이동</h3>
            <div class="zone-btn-grid" style="grid-template-columns: repeat(3, 1fr);">
              ${slideGridHtml}
            </div>
          </div>
        </div>`;

      $('#btn-slide-prev').addEventListener('click', () => {
        socket.emit('host:slide', { delta: -1 }, (res) => { if (!res.ok) toast(res.error, true); });
      });
      $('#btn-slide-next').addEventListener('click', () => {
        socket.emit('host:slide', { delta: 1 }, (res) => { if (!res.ok) toast(res.error, true); });
      });
      
      // 슬라이드 그리드 바로가기 리스너 위임
      ctrl.onclick = (e) => {
        const jumpBtn = e.target.closest('[data-slide-jump]');
        if (!jumpBtn) return;
        const set = parseInt(jumpBtn.dataset.slideJump, 10);
        socket.emit('host:slide', { set }, (res) => { if (!res.ok) toast(res.error, true); });
      };
      break;

    case 'roles':
      ctrl.innerHTML = `
        <div class="center" style="padding:40px 0;">
          <p style="font-size:1.2rem; line-height:1.8;">
            현재 수사단원 전원이 스마트폰을 통해 자신의 비공개 역할 및 단서를 개별적으로 확인 중입니다.<br/>
            모두 확인을 마쳤다면 좌측 네비게이션에서 <b class="cyan">"4. 단서 공유 토론"</b> 단계로 이동하십시오.
          </p>
        </div>`;
      break;

    case 'investigation':
      const zoneGridHtml = Object.entries(ZONE_METADATA_HOST).map(([key, label]) => {
        const isActive = state.activeZone === key;
        const isSuspect = key.startsWith('bag-');
        return `
          <button class="zone-ctrl-btn ${isSuspect ? 'suspect-btn' : ''} ${isActive ? 'active' : ''}" data-zone-key="${key}">
            ${label}
          </button>
        `;
      }).join('');

      ctrl.innerHTML = `
        <div>
          <p class="dim" style="font-size:1.05rem; margin-bottom: 15px;">
            진행자가 선택한 구역의 현장 세부 단서가 공유 화면(Display)에 대형 돋보기 마커와 함께 노출됩니다.
          </p>
          <button class="btn ${!state.activeZone ? 'active' : 'ghost'}" id="btn-show-hub" style="width:100%; font-size:1.15rem; margin-bottom: 20px;">
            🖥️ 공유 스크린에 전체 지도(조사 허브) 노출하기
          </button>
          
          <div class="control-section">
            <h3>🔬 현장 구역 선택 노출</h3>
            <div class="zone-btn-grid">
              ${zoneGridHtml}
            </div>
          </div>
        </div>`;

      $('#btn-show-hub').addEventListener('click', () => {
        socket.emit('host:investigationZone', { zoneKey: null }, (res) => { if (!res.ok) toast(res.error, true); });
      });

      ctrl.onclick = (e) => {
        const zBtn = e.target.closest('[data-zone-key]');
        if (!zBtn) return;
        const zoneKey = zBtn.dataset.zoneKey;
        socket.emit('host:investigationZone', { zoneKey }, (res) => { if (!res.ok) toast(res.error, true); });
      };
      break;

    case 'questioning':
      const suspectSpotlightHtml = state.hostView.suspects.map(s => {
        const isActive = state.spotlight === s.key;
        return `
          <button class="zone-ctrl-btn ${isActive ? 'active' : ''}" data-sus-key="${s.key}" style="border-color:${s.color};">
            ${s.emoji} ${s.name} (${s.title})
          </button>
        `;
      }).join('');

      ctrl.innerHTML = `
        <div>
          <p class="dim" style="font-size:1.05rem; margin-bottom: 15px;">
            특정 용의자를 스포트라이트 지정하면 공유 화면에서 해당 인물의 프로필 및 진술(알리바이)이 확대 표시됩니다.
          </p>
          <button class="btn ${!state.spotlight ? 'active' : 'ghost'}" id="btn-clear-spot" style="width:100%; margin-bottom: 20px;">
            스포트라이트 해제
          </button>
          
          <div class="control-section">
            <h3>👤 심문 대상 집중 조명</h3>
            <div class="zone-btn-grid">
              ${suspectSpotlightHtml}
            </div>
          </div>
        </div>`;

      $('#btn-clear-spot').addEventListener('click', () => {
        socket.emit('host:spotlight', { suspectKey: null }, (res) => { if (!res.ok) toast(res.error, true); });
      });

      ctrl.onclick = (e) => {
        const sBtn = e.target.closest('[data-sus-key]');
        if (!sBtn) return;
        const suspectKey = sBtn.dataset.susKey;
        socket.emit('host:spotlight', { suspectKey }, (res) => { if (!res.ok) toast(res.error, true); });
      };
      break;

    case 'final':
      ctrl.innerHTML = `
        <div class="center" style="padding:40px 0;">
          <p style="font-size:1.25rem; line-height:1.8; margin-bottom: 20px;">
            최종 토론을 독려하십시오. 용의자들과 수사관들에게 최후 변론 기회를 부여하십시오.<br/>
            토론이 완료되면 좌측 메뉴의 <b class="cyan">"7. 범인 투표"</b> 단계로 전환해 투표 용지를 열어주십시오.
          </p>
        </div>`;
      break;

    case 'vote':
      const openBtnClass = state.voteOpen ? 'disabled' : '';
      const closeBtnClass = state.voteClosed ? 'disabled' : '';

      // 투표 집계 확인용 UI 생성
      const tally = state.hostView.voteResult || {};
      const votesRows = state.hostView.suspects.map(s => {
        const count = tally[s.key] || 0;
        return `<div style="font-size:1.2rem; margin-bottom: 10px;">${s.emoji} <b>${s.name}:</b> <span class="cyan" style="font-weight:700;">${count} 표</span></div>`;
      }).join('');

      ctrl.innerHTML = `
        <div>
          <div class="row" style="gap:15px; margin-bottom: 25px;">
            <button class="btn grow green" id="btn-vote-open" ${openBtnClass}>🗳️ 투표용지 배포 (열기)</button>
            <button class="btn grow red" id="btn-vote-close" ${closeBtnClass}>🔒 투표용지 회수 (마감)</button>
          </div>
          
          <button class="btn ghost small" id="btn-vote-reset" style="width:100%; margin-bottom:25px;">투표 리셋 및 재생성</button>

          <div class="control-section">
            <h3>📊 진행자 실시간 투표 집계 현황 (공유화면엔 마감 후 진상공개 시 노출)</h3>
            <div style="padding: 10px 0;">
              ${votesRows}
            </div>
          </div>
        </div>`;

      $('#btn-vote-open').addEventListener('click', () => {
        socket.emit('host:voteControl', { action: 'open' }, (res) => { if (res.ok) toast('대원들에게 투표창이 오픈되었습니다.'); });
      });

      $('#btn-vote-close').addEventListener('click', () => {
        socket.emit('host:voteControl', { action: 'close' }, (res) => { if (res.ok) toast('투표가 조기 마감되었습니다.'); });
      });

      $('#btn-vote-reset').addEventListener('click', () => {
        if (confirm('투표 데이터를 전부 초기화하고 처음부터 다시 투표하게 하시겠습니까?')) {
          socket.emit('host:voteControl', { action: 'resetVotes' }, (res) => { if (res.ok) toast('투표가 초기화되었습니다.'); });
        }
      });
      break;

    case 'reveal':
      const currentRevealName = REVEAL_STEPS[state.revealStep] || '대기 중';
      const prevRevDisabled = state.revealStep <= 0 ? 'disabled' : '';
      const nextRevDisabled = state.revealStep >= REVEAL_STEPS.length - 1 ? 'disabled' : '';

      const revealGridHtml = REVEAL_STEPS.map((name, idx) => `
        <button class="zone-ctrl-btn ${state.revealStep === idx ? 'active' : ''}" data-reveal-jump="${idx}" style="text-align:left; font-size: 0.88rem; padding: 10px 14px;">
          ${name}
        </button>
      `).join('');

      ctrl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
          <div class="row justify-between" style="font-size:1.15rem;">
            <span>현재 진상 공개 단계: <b class="red-t">${currentRevealName}</b></span>
            <span>(${state.revealStep + 1} / ${REVEAL_STEPS.length})</span>
          </div>
          <div class="row" style="gap:15px; width:100%;">
            <button class="btn grow" id="btn-reveal-prev" ${prevRevDisabled}>◀ 이전 장</button>
            <button class="btn grow red" id="btn-reveal-next" ${nextRevDisabled}>진상 다음 공개 ▶</button>
          </div>
          
          <div class="control-section">
            <h3>🎯 특정 사건 전말 단계 바로가기</h3>
            <div class="zone-btn-grid" style="grid-template-columns: repeat(2, 1fr);">
              ${revealGridHtml}
            </div>
          </div>
        </div>`;

      $('#btn-reveal-prev').addEventListener('click', () => {
        socket.emit('host:revealStep', { delta: -1 }, (res) => { if (!res.ok) toast(res.error, true); });
      });
      $('#btn-reveal-next').addEventListener('click', () => {
        socket.emit('host:revealStep', { delta: 1 }, (res) => { if (!res.ok) toast(res.error, true); });
      });

      // 리빌 직접 점프 리스너 위임
      ctrl.onclick = (e) => {
        const revBtn = e.target.closest('[data-reveal-jump]');
        if (!revBtn) return;
        const set = parseInt(revBtn.dataset.revealJump, 10);
        socket.emit('host:revealStep', { delta: set - state.revealStep }, (res) => { if (!res.ok) toast(res.error, true); });
      };
      break;

    case 'end':
      ctrl.innerHTML = `
        <div class="center" style="padding:40px 0;">
          <h2 class="green-t" style="font-size: 2.2rem; border-bottom: none; padding:0; margin-bottom:10px;">🏆 수사 완료</h2>
          <p style="font-size: 1.25rem; line-height: 1.8;">
            "과학실의 소동" 사건이 모두 종결되었습니다. 수사 수고하셨습니다!<br/>
            재경기를 원하시면 상단의 [방 폭파/초기화] 버튼을 눌러 새 세션을 시작해 주십시오.
          </p>
        </div>`;
      break;
  }
}

const ZONE_METADATA_HOST = {
  'science': '🧪 과학실 내부',
  'art': '🎨 미술실 내부',
  'broadcast': '🎙️ 방송실 내부',
  'garden': '🌿 체육관 뒤 화단',
  'bag-odeokhu': '🎒 오덕후 소지품',
  'bag-parkcheyuk': '👟 박체육 소지품',
  'bag-nabeomin': '🖌️ 나범인 소지품',
  'bag-leemobeom': '📱 이모범 소지품'
};

// 시작
window.onload = () => {
  init();
};
