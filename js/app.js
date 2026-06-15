// =====================================================================
// 참가자 (모바일) 클라이언트
// =====================================================================
/* global io */
const socket = io();

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  code: null,
  playerId: null,
  name: null,
  pub: null,        // 서버 공개 상태
  priv: null,       // 내 비공개 정보 (role, clues / suspect sheet)
  caseRef: null,    // 사건 공개 자료
  tab: 'me',
  selectedZone: null,
  roleSeen: false,
  myVote: null,
};

const PHASE_NAMES = {
  lobby: '대기실', briefing: '사건 브리핑', roles: '역할 확인',
  investigation: '단서 공유 토론', questioning: '용의자 심문',
  final: '최종 토론', vote: '범인 투표', reveal: '진상 공개', end: '사건 종결',
};

const INVESTIGATION_ZONES = {
  science: { emoji: '🧪', name: '과학실', desc: '강하늘이 쓰러진 사고 구역' },
  art: { emoji: '🎨', name: '미술실', desc: '미술부장 나범인의 부실' },
  broadcast: { emoji: '🎙️', name: '방송실', desc: '이모범이 대본을 쓴 장소' },
  garden: { emoji: '🌿', name: '체육관 뒤 화단', desc: '배수관과 적토 화단 구역' },
  'bag-odeokhu': { emoji: '🎒', name: '오덕후 소지품', desc: '오덕후의 개인 가방과 지갑' },
  'bag-parkcheyuk': { emoji: '👟', name: '박체육 소지품', desc: '박체육의 농구 가방과 캐비닛' },
  'bag-nabeomin': { emoji: '🖌️', name: '나범인 소지품', desc: '나범인의 화구 파우치와 사물함' },
  'bag-leemobeom': { emoji: '📱', name: '이모범 소지품', desc: '이모범의 교재 가방과 서랍' },
};

// ----- 유틸 -----------------------------------------------------------
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = isError ? 'show error' : 'show';
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = ''), 2600);
}

function show(id) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  $(id).classList.add('active');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ----- 세션 저장/복원 ---------------------------------------------------
const SKEY = 'crimescene_session';
function saveSession(data) { localStorage.setItem(SKEY, JSON.stringify(data)); }
function loadSession() { try { return JSON.parse(localStorage.getItem(SKEY)); } catch { return null; } }

// ----- 입장 ------------------------------------------------------------
const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) $('#inp-code').value = urlRoom.toUpperCase();

$('#btn-join').addEventListener('click', () => {
  const code = $('#inp-code').value.trim().toUpperCase();
  const name = $('#inp-name').value.trim();
  if (code.length !== 4) return toast('방 코드 4자리를 입력해 주세요.', true);
  if (!name) return toast('이름을 입력해 주세요.', true);
  socket.emit('player:join', { code, name }, (res) => {
    if (!res.ok) return toast(res.error, true);
    state.code = res.code; state.playerId = res.playerId; state.name = name;
    saveSession({ code: res.code, token: res.token });
    fetchCase();
  });
});

function tryRejoin() {
  const sess = loadSession();
  if (!sess) return;
  socket.emit('player:rejoin', { code: sess.code, token: sess.token }, (res) => {
    if (!res.ok) { localStorage.removeItem(SKEY); return; }
    state.code = sess.code; state.playerId = res.playerId; state.name = res.name;
    state.roleSeen = sessionStorage.getItem('roleSeen') === '1';
    fetchCase();
    toast('다시 연결되었습니다.');
  });
}

socket.on('connect', () => { if (state.code) tryRejoin(); });
tryRejoin();

async function fetchCase() {
  if (state.caseRef) return;
  try { state.caseRef = await (await fetch('/api/case')).json(); } catch { /* 다음 렌더에서 재시도 */ }
  render();
}

socket.on('kicked', () => {
  localStorage.removeItem(SKEY);
  toast('진행자가 퇴장 처리했습니다.', true);
  setTimeout(() => location.reload(), 1500);
});

// ----- 서버 상태 수신 ----------------------------------------------------
socket.on('state', (pub) => {
  const prevActiveZone = state.pub && state.pub.activeZone;
  state.pub = pub;
  if (pub.phase !== 'investigation') {
    state.selectedZone = null;
  } else if (pub.activeZone && pub.activeZone !== prevActiveZone) {
    state.selectedZone = pub.activeZone;
  } else if (!pub.activeZone && prevActiveZone) {
    state.selectedZone = null;
  }
  render();
});
socket.on('private', (priv) => {
  const hadRole = state.priv && state.priv.role;
  state.priv = priv;
  if (!hadRole && priv.role) { state.roleSeen = false; sessionStorage.removeItem('roleSeen'); }
  render();
});

// ----- 타이머 틱 ---------------------------------------------------------
let tickBase = null; // {remaining, at, running}
setInterval(() => {
  if (!tickBase || !tickBase.running) return;
  const el = $('#main-timer');
  if (!el) return;
  const passed = Math.floor((Date.now() - tickBase.at) / 1000);
  const r = Math.max(0, tickBase.remaining - passed);
  el.textContent = r > 0 ? fmtTime(r) : '00:00';
  el.classList.toggle('danger', r > 0 && r <= 60);
}, 500);

// ----- 렌더 --------------------------------------------------------------
function render() {
  const pub = state.pub;
  if (!state.code || !pub) return;

  if (pub.phase === 'lobby') { renderLobby(); return; }

  if (pub.phase === 'briefing') {
    renderHostPacedScreen({
      icon: '📺',
      title: '사건 브리핑 진행 중',
      body: '공유 화면과 진행자의 안내를 따라가세요. 개인 역할은 진행자가 역할 확인 단계로 넘긴 뒤 열립니다.',
    });
    return;
  }

  // 역할 확인 단계부터 개인 역할을 열 수 있다. 조사 단계 이후 재접속한 학생도 여기서 복구한다.
  if (state.priv && state.priv.role && !state.roleSeen) { renderRoleCard(); return; }

  if (pub.phase === 'roles') {
    renderHostPacedScreen({
      icon: '🪪',
      title: '역할 확인 대기',
      body: state.roleSeen
        ? '역할 확인이 끝났습니다. 진행자가 단서 공유 토론 단계로 넘길 때까지 기다려 주세요.'
        : '진행자가 역할 확인을 준비 중입니다. 잠시 뒤 개인 역할 카드가 열립니다.',
    });
    return;
  }

  if (pub.phase === 'investigation') {
    show('#scr-main');
    $('#tabbar').style.display = 'none';
    $('#main-phase').textContent = PHASE_NAMES[pub.phase] || pub.phase;

    tickBase = { remaining: pub.timer.remaining, at: Date.now(), running: pub.timer.running };
    $('#main-timer').textContent = pub.timer.running || pub.timer.remaining > 0 ? fmtTime(pub.timer.remaining) : '';
    $('#main-timer').classList.remove('danger');

    $('#tab-content').innerHTML = renderSharedInvestigationPanel();
    bindTabContent();
    return;
  }

  show('#scr-main');
  $('#tabbar').style.display = 'flex';
  $('#main-phase').textContent = PHASE_NAMES[pub.phase] || pub.phase;

  tickBase = { remaining: pub.timer.remaining, at: Date.now(), running: pub.timer.running };
  $('#main-timer').textContent = pub.timer.running || pub.timer.remaining > 0 ? fmtTime(pub.timer.remaining) : '';
  $('#main-timer').classList.remove('danger');

  // 투표 탭 알림
  const voteBtn = $$('.tabbar button').find((b) => b.dataset.tab === 'vote');
  voteBtn.classList.toggle('alert', pub.voteOpen && !pub.players.find((p) => p.id === state.playerId)?.voted);

  // 투표가 열리면 자동으로 투표 탭으로
  if (pub.voteOpen && !render._autoVoteTab) { state.tab = 'vote'; render._autoVoteTab = true; }
  if (!pub.voteOpen) render._autoVoteTab = false;

  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  const c = $('#tab-content');
  const sharedInvestigation = renderSharedInvestigationPanel();
  if (state.tab === 'me') c.innerHTML = sharedInvestigation + renderMeTab();
  else if (state.tab === 'case') c.innerHTML = sharedInvestigation + renderCaseTab();
  else c.innerHTML = sharedInvestigation + renderVoteTab();
  bindTabContent();
}

function renderHostPacedScreen({ icon, title, body }) {
  show('#scr-main');
  $('#tabbar').style.display = 'none';
  $('#main-phase').textContent = PHASE_NAMES[state.pub.phase] || state.pub.phase;
  tickBase = { remaining: state.pub.timer.remaining, at: Date.now(), running: state.pub.timer.running };
  $('#main-timer').textContent = state.pub.timer.running || state.pub.timer.remaining > 0 ? fmtTime(state.pub.timer.remaining) : '';
  $('#main-timer').classList.remove('danger');
  $('#tab-content').innerHTML = `
    <div class="panel frame host-paced">
      <div class="paced-icon">${icon}</div>
      <div class="label-chip">진행자 제어 화면</div>
      <h2 class="display-font">${esc(title)}</h2>
      <p>${esc(body)}</p>
    </div>`;
}

// ----- 대기실 -----
function renderLobby() {
  show('#scr-lobby');
  $('#tabbar').style.display = 'none';
  $('#lobby-code').textContent = state.code;
  const ps = state.pub.players;
  $('#lobby-count').textContent = ps.length;
  $('#lobby-players').innerHTML = ps
    .map((p) => `<span class="player-tag ${p.id === state.playerId ? 'me' : ''} ${p.connected ? '' : 'off'} ${p.isBot ? 'bot' : ''}">${p.isBot ? '🤖 ' : ''}${esc(p.name)}</span>`)
    .join('');
}

// ----- 역할 카드 -----
function renderRoleCard() {
  show('#scr-role');
  $('#tabbar').style.display = 'none';
  const priv = state.priv;
  const back = $('#flip-back');
  if (priv.role === 'detective') {
    back.innerHTML = `
      <div style="font-size:3rem">🕵️</div>
      <div class="display-font cyan" style="font-size:1.7rem; margin:10px 0 4px">형사</div>
      <div class="center dim" style="font-size:.92rem; line-height:1.6">
        당신만 아는 단서 <b class="cyan">${priv.clues.length}개</b>를 가지고 있습니다.<br/>
        토론에서 단서를 공유하고 범인을 찾아내세요!
      </div>`;
  } else {
    const s = priv.suspect;
    back.innerHTML = `
      <div style="font-size:3rem">${s.emoji}</div>
      <div class="display-font" style="font-size:1.7rem; margin:10px 0 4px; color:${s.color}">${esc(s.name)}</div>
      <div class="label-chip" style="margin-bottom:10px">${priv.isCulprit ? '⚠️ 당신이 범인입니다' : '용의자 — 진실만 말하세요'}</div>
      <div class="center dim" style="font-size:.9rem; line-height:1.6">
        ${esc(s.title)} 역할입니다.<br/>자세한 내용은 다음 화면에서 확인하세요.
      </div>`;
  }
  const card = $('#flip-card');
  card.classList.remove('flipped');
  card.onclick = () => {
    card.classList.add('flipped');
    $('#btn-role-done').disabled = false;
  };
  $('#btn-role-done').onclick = () => {
    state.roleSeen = true;
    sessionStorage.setItem('roleSeen', '1');
    render();
  };
}

// ----- 내 정보 탭 -----
function renderMeTab() {
  const priv = state.priv;
  if (!priv || !priv.role) {
    return `<div class="panel section center"><p class="dim">아직 역할이 배정되지 않았습니다.<br/>공유 화면을 봐 주세요.</p></div>`;
  }
  if (priv.role === 'detective') {
    return `
      <div class="panel frame role-banner">
        <div class="emoji">🕵️</div>
        <h2 class="cyan display-font">형사 — ${esc(state.name)}</h2>
        <p class="dim" style="font-size:.88rem">아래 단서는 <b>당신만</b> 볼 수 있습니다.<br/>토론에서 말로 공유하세요. (화면을 직접 보여줘도 됩니다)</p>
      </div>
      ${priv.clues.map((cl) => `
        <div class="clue-card frame" style="margin-bottom:14px">
          <div class="clue-no">단서 No.${String(cl.id).padStart(2, '0')} · ${esc(locName(cl.loc))}</div>
          ${renderCluePhoto(cl)}
          <h3>${cl.emoji} ${esc(cl.title)}</h3>
          <div class="clue-desc">${esc(cl.desc)}</div>
          <details class="clue-hint"><summary>보조 힌트 열기</summary>${esc(cl.hint)}</details>
        </div>`).join('')}
      <div class="panel section">
        <h2>📌 수사 수칙</h2>
        <ul>
          <li>단서를 그대로 읽어주기보다, <b>중요한 점</b>을 짚어 이야기하세요.</li>
          <li>다른 형사의 단서와 <b>연결되는 부분</b>을 찾으세요.</li>
          <li>용의자에게 직접 질문하세요. 범인 외에는 거짓말을 못 합니다!</li>
        </ul>
      </div>`;
  }
  // 용의자
  const s = priv.suspect;
  const culprit = priv.isCulprit;
  return `
    <div class="panel frame role-banner ${culprit ? 'culprit-box' : ''}">
      <div class="emoji">${s.emoji}</div>
      <h2 class="display-font" style="color:${s.color}">${esc(s.name)} (${s.age}세)</h2>
      <div class="dim">${esc(s.title)}</div>
      ${culprit ? `<div class="label-chip" style="margin-top:10px; border-color:var(--red); color:#ff9eb0; background:rgba(255,59,92,.1)">⚠️ 극비 — 당신이 범인입니다</div>` : `<div class="label-chip" style="margin-top:10px">선량한 용의자 — 진실만 말하세요</div>`}
    </div>
    <div class="panel section">
      <h2>🗣️ 나의 알리바이 (주장)</h2>
      <p>"${esc(s.alibi)}"</p>
    </div>
    <div class="panel section">
      <h2 class="p">🔥 남들이 의심하는 이유 (동기)</h2>
      <p>${esc(s.motive)}</p>
    </div>
    ${culprit ? `
      <div class="panel section culprit-box">
        <h2 class="red-t">🩸 사건의 진실 (당신만 압니다)</h2>
        <ul>${s.truth.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
      <div class="panel section culprit-box">
        <h2 class="red-t">🎭 거짓말 전략</h2>
        <ul>${s.lieGuide.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
      <div class="panel section culprit-box">
        <h2 class="red-t">⚠️ 위험한 단서들</h2>
        <ul>${s.dangerClues.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <hr class="neon"/>
        <p><b class="yellow-t">승리 조건:</b> ${esc(s.winCondition)}</p>
      </div>` : `
      <div class="panel section">
        <h2>🤫 숨겨진 진실 (먼저 말하지 않아도 됩니다)</h2>
        <ul>${s.hiddenTruth.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <hr class="neon"/>
        <p class="dim" style="font-size:.88rem">⚖️ 규칙: 직접 질문을 받으면 <b>반드시 사실대로</b> 답해야 합니다. 단, 묻지 않은 것까지 먼저 털어놓을 필요는 없습니다.</p>
      </div>`}
    <div class="panel section">
      <h2>🎬 연기 가이드</h2>
      <ul>${s.acting.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>`;
}

function locName(key) {
  const l = state.caseRef && state.caseRef.locations.find((x) => x.key === key);
  return l ? l.name : '';
}

function renderCluePhoto(clue, options = {}) {
  if (window.CrimeSceneVisuals && window.CrimeSceneVisuals.cluePhoto) {
    return window.CrimeSceneVisuals.cluePhoto(clue, options);
  }
  return `<div class="evidence-photo-fallback">${clue.emoji || '🔎'}</div>`;
}

function renderSharedInvestigationPanel() {
  const pub = state.pub;
  const cr = state.caseRef;
  if (!pub || pub.phase !== 'investigation' || !cr) return '';

  const revealedZones = new Set(pub.revealedZones || []);
  if (pub.activeZone) revealedZones.add(pub.activeZone);
  const selectedZone = state.selectedZone && revealedZones.has(state.selectedZone) ? state.selectedZone : null;
  const active = selectedZone ? INVESTIGATION_ZONES[selectedZone] : null;

  const zoneGrid = () => `
    <div class="student-zone-grid">
      ${Object.entries(INVESTIGATION_ZONES).map(([key, z]) => {
        const isBag = key.startsWith('bag-');
        const isRevealed = revealedZones.has(key);
        const isActive = pub.activeZone === key;
        const isSelected = selectedZone === key;
        return `
          <button class="student-zone ${isBag ? 'suspect-zone' : ''} ${isRevealed ? 'open' : 'locked'} ${isActive ? 'live-zone' : ''} ${isSelected ? 'selected' : ''}"
                  ${isRevealed ? `data-zone-nav="${key}"` : 'disabled'}>
            <div class="zone-emoji">${isRevealed ? z.emoji : '🔒'}</div>
            <b>${esc(z.name)}</b>
            <span>${isRevealed ? esc(z.desc) : '진행자가 공개하면 입장 가능'}</span>
            <em>${isActive ? '지금 공개 중' : isRevealed ? '다시 보기 가능' : '잠김'}</em>
          </button>`;
      }).join('')}
    </div>`;

  if (!active) {
    return `
      <div class="panel frame student-map">
        <div class="map-head">
          <div>
            <div class="label-chip">공유 스크린 동기화</div>
            <h2 class="display-font">공개된 현장 지도</h2>
            <p class="dim">진행자가 공개한 구역만 다시 들어갈 수 있습니다.</p>
          </div>
          <div class="map-status">LIVE</div>
        </div>
        ${zoneGrid()}
      </div>`;
  }

  const zoneClues = cr.clues.filter((c) => c.loc === selectedZone);
  return `
    <div class="panel frame student-map active-zone">
      <div class="map-head">
        <div>
          <div class="label-chip">${pub.activeZone === selectedZone ? '현재 조사 구역' : '공개 완료 구역'}</div>
          <h2 class="display-font">${active.emoji} ${esc(active.name)}</h2>
          <p class="dim">${esc(active.desc)}</p>
        </div>
        <div class="map-status">LIVE</div>
      </div>
      <button class="btn ghost small map-back-btn" data-zone-map="1">공개된 지도 보기</button>
      <div class="student-zone-clues">
        ${zoneClues.map((cl, i) => `
          <div class="student-zone-clue">
            <div class="clue-pin">${i + 1}</div>
            ${renderCluePhoto(cl, { mini: true, caption: false })}
            <div>
              <b>${cl.emoji} ${esc(cl.title)}</b>
              <p>${esc(cl.desc)}</p>
            </div>
          </div>`).join('')}
      </div>
      <div class="revealed-strip">
        ${[...revealedZones].map((key) => {
          const z = INVESTIGATION_ZONES[key];
          if (!z) return '';
          return `<button class="${key === selectedZone ? 'selected' : ''}" data-zone-nav="${key}">${z.emoji} ${esc(z.name)}</button>`;
        }).join('')}
      </div>
    </div>`;
}

// ----- 사건 자료 탭 -----
function renderCaseTab() {
  const cr = state.caseRef;
  if (!cr) { fetchCase(); return `<div class="panel section center dim">자료를 불러오는 중...</div>`; }
  return `
    <div class="panel section frame">
      <h2>📋 사건 개요</h2>
      <p><b>일시</b> — ${esc(cr.overview.when)}<br/><b>장소</b> — ${esc(cr.overview.where)}</p>
      <hr class="neon"/>
      <p>${esc(cr.overview.damage)}</p>
    </div>
    <div class="panel section">
      <h2>🗣️ 피해자 ${esc(cr.victim.name)}의 진술</h2>
      <p style="font-style:italic">${esc(cr.overview.victimStatement)}</p>
    </div>
    <div class="panel section">
      <h2>👥 용의자 (탭하여 펼치기)</h2>
      ${cr.suspects.map((s) => `
        <details style="margin-bottom:10px">
          <summary style="cursor:pointer; padding:10px; border:1px solid var(--line-dim); border-radius:10px; list-style:none">
            <span style="font-size:1.3rem">${s.emoji}</span>
            <b style="color:${s.color}">${esc(s.name)}</b>
            <span class="dim" style="font-size:.85rem"> — ${esc(s.title)}</span>
          </summary>
          <div style="padding:12px 10px 4px">
            <ul style="padding-left:18px; line-height:1.7; font-size:.92rem">${s.publicProfile.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
            <p style="margin-top:8px; font-size:.92rem"><b class="cyan">알리바이:</b> "${esc(s.alibi)}"</p>
          </div>
        </details>`).join('')}
    </div>
    <div class="panel section">
      <h2>⏱️ 알리바이 타임라인 <span class="dim" style="font-size:.8rem">(진술 기준)</span></h2>
      <p class="red-t" style="font-size:.88rem; margin-bottom:8px">사건 발생: ${esc(cr.timeline.incidentTime)}</p>
      ${cr.timeline.rows.map((row) => {
        const s = cr.suspects.find((x) => x.key === row.suspect);
        return `<p style="font-size:.92rem; margin-bottom:6px">${s.emoji} <b style="color:${s.color}">${esc(s.name)}</b> — ${row.segments.map((g) => `${g.from}~${g.to} ${esc(g.label)}`).join(' / ')}</p>`;
      }).join('')}
      <p class="dim" style="font-size:.8rem; margin-top:8px">${esc(cr.timeline.note)}</p>
    </div>
    <div class="panel section">
      <h2>📜 게임 규칙</h2>
      <ul>${cr.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    </div>`;
}

// ----- 투표 탭 -----
function renderVoteTab() {
  const pub = state.pub;
  const cr = state.caseRef;
  if (!cr) { fetchCase(); return `<div class="panel section center dim">자료를 불러오는 중...</div>`; }

  // 진상 공개 후: 결과 표시
  if (pub.phase === 'reveal' && pub.revealSteps && pub.revealStep >= 1) {
    const culpritStep = pub.revealSteps.find((s) => s.kind === 'culprit');
    const culprit = cr.suspects.find((s) => s.key === pub.culpritKey);
    const mine = state.myVote ? cr.suspects.find((s) => s.key === state.myVote) : null;
    const correct = mine && mine.key === pub.culpritKey;
    return `
      <div class="panel frame result-banner ${correct ? '' : 'culprit-box'}">
        <div class="big">${culprit ? culprit.emoji : '🩸'}</div>
        <h2 class="display-font ${correct ? 'green-t' : 'red-t'}">${esc(culpritStep ? culpritStep.body : '')}</h2>
        ${mine ? `<p class="dim">당신의 추리: <b style="color:${mine.color}">${esc(mine.name)}</b> — ${correct ? '🎉 정답! 명탐정입니다!' : '아쉽지만 오답입니다.'}</p>` : ''}
      </div>
      <p class="center dim" style="margin-top:16px">자세한 사건의 전말은 공유 화면을 봐 주세요.</p>`;
  }

  if (!pub.voteOpen && !pub.voteClosed) {
    return `<div class="panel section center"><p class="dim" style="padding:20px 0">아직 투표가 열리지 않았습니다.<br/>토론을 계속하세요!</p></div>`;
  }
  if (pub.voteClosed) {
    return `<div class="panel section center"><div class="voted-stamp"><div class="big">🗳️</div><p style="margin-top:10px">투표가 마감되었습니다.<br/>공유 화면에서 결과를 확인하세요!</p></div></div>`;
  }

  const me = pub.players.find((p) => p.id === state.playerId);
  if (me && me.voted && state.myVote) {
    const s = cr.suspects.find((x) => x.key === state.myVote);
    return `
      <div class="panel section center">
        <div class="voted-stamp">
          <div class="big">✅</div>
          <p style="margin-top:10px">투표 완료: <b style="color:${s.color}">${s.emoji} ${esc(s.name)}</b></p>
          <p class="dim" style="font-size:.85rem; margin-top:6px">마감 전까지 다시 투표하면 변경됩니다.</p>
        </div>
      </div>
      ${voteButtons(cr)}`;
  }
  return `
    <div class="panel section center" style="padding:16px">
      <h2 class="red-t display-font" style="font-size:1.3rem">🚨 범인은 누구인가?</h2>
      <p class="dim" style="font-size:.88rem">신중하게 한 명을 지목하세요.</p>
    </div>
    ${voteButtons(cr)}`;
}

function voteButtons(cr) {
  return `<div class="vote-list">
    ${cr.suspects.map((s) => `
      <div class="suspect-chip ${state.myVote === s.key ? 'selected' : ''}" data-vote="${s.key}">
        <div class="suspect-avatar" style="border-color:${s.color}">${s.emoji}</div>
        <div class="grow">
          <b style="color:${s.color}">${esc(s.name)}</b>
          <div class="dim" style="font-size:.82rem">${esc(s.title)}</div>
        </div>
        <span class="dim">지목 ➤</span>
      </div>`).join('')}
  </div>`;
}

function bindTabContent() {
  $$('[data-zone-nav]').forEach((el) => {
    el.addEventListener('click', () => {
      state.selectedZone = el.dataset.zoneNav;
      render();
    });
  });
  $$('[data-zone-map]').forEach((el) => {
    el.addEventListener('click', () => {
      state.selectedZone = null;
      render();
    });
  });
  $$('[data-vote]').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.vote;
      socket.emit('player:vote', { suspectKey: key }, (res) => {
        if (!res.ok) return toast(res.error, true);
        state.myVote = key;
        toast('투표했습니다!');
        render();
      });
    });
  });
}

// 탭 전환
$$('.tabbar button').forEach((b) => {
  b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); });
});
