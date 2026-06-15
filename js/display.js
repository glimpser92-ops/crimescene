// =====================================================================
// 공유 디스플레이 (대형 화면) 클라이언트
// =====================================================================
/* global io */
const socket = io();

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let state = {
  code: null,
  phase: null,
  slide: 0,
  revealStep: -1,
  spotlight: null,
  activeZone: null,
  started: false,
  players: [],
  timer: { running: false, remaining: 0 },
  voteOpen: false,
  voteClosed: false,
  votesSubmitted: 0,
  votesEligible: 0,
  voteResult: null,
  revealSteps: null,
  culpritKey: null
};

let caseRef = null;

// ----- 16:9 컨테이너 반응형 스케일링 ----------------------------------------
function scaleContainer() {
  const container = $('#display-container');
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scale = Math.min(w / 1920, h / 1080);
  container.style.transform = `scale(${scale})`;
  container.style.transformOrigin = 'center center';
}
window.addEventListener('resize', scaleContainer);
scaleContainer();

// ----- 초기화 및 사건 자료 데이터 Fetch ---------------------------------------
async function init() {
  try {
    caseRef = await (await fetch('/api/case')).json();
  } catch (err) {
    console.error('사건 정보를 가져오는데 실패했습니다:', err);
  }

  const urlCode = new URLSearchParams(location.search).get('room');
  if (urlCode) {
    state.code = urlCode.toUpperCase();
    socket.emit('display:attach', { code: state.code }, (res) => {
      if (!res.ok) {
        alert(res.error);
      }
    });
  } else {
    // 코드가 없을 때 대기 처리
    renderWelcome();
  }
}

function renderWelcome() {
  $('#scr-lobby').classList.add('active');
  $('#lobby-code-val').textContent = 'LOBBY';
  $('#lobby-players-list').innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; font-size: 1.5rem;" class="dim">
      진행자 화면에서 방을 생성한 후,<br/>발급된 주소로 이 화면을 열어주십시오.
    </div>`;
}

// ----- 소켓 연동 -----------------------------------------------------------
socket.on('state', (pub) => {
  state = { ...state, ...pub };
  render();
});

// ----- 타이머 동기화 --------------------------------------------------------
let tickBase = null;
setInterval(() => {
  if (!tickBase || !tickBase.running) return;
  const passed = Math.floor((Date.now() - tickBase.at) / 1000);
  const r = Math.max(0, tickBase.remaining - passed);
  
  const timerElements = $$('.timer-display');
  timerElements.forEach(el => {
    el.textContent = r > 0 ? fmtTime(r) : '00:00';
    el.classList.toggle('danger', r > 0 && r <= 60);
  });
}, 500);

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ----- 메인 렌더 함수 -------------------------------------------------------
function render() {
  if (!caseRef) return;

  // 모든 화면 비활성화
  $$('.display-screen').forEach((s) => s.classList.remove('active'));
  $('#invest-zone-view').style.display = 'none';
  $('#invest-hub-view').style.display = 'none';

  // 상단바 업데이트
  updateTopBar();

  // 페이즈별 분기
  switch (state.phase) {
    case 'lobby':
      renderLobby();
      break;
    case 'briefing':
      renderBriefing();
      break;
    case 'roles':
      renderRoles();
      break;
    case 'investigation':
      renderInvestigation();
      break;
    case 'questioning':
      renderQuestioning();
      break;
    case 'final':
      renderFinal();
      break;
    case 'vote':
      renderVote();
      break;
    case 'reveal':
      renderReveal();
      break;
    case 'end':
      renderEnd();
      break;
  }
}

// ----- 상단바 업데이트 ------------------------------------------------------
const PHASE_NAMES = {
  lobby: '대기실', briefing: '사건 브리핑', roles: '역할 확인',
  investigation: '단서 공유 토론', questioning: '용의자 심문',
  final: '최종 토론', vote: '범인 투표', reveal: '진상 공개', end: '사건 종결'
};

function updateTopBar() {
  const bar = $('#top-status-bar');
  // 대기실·종결 화면은 상단 바 불필요, 조사 단계는 허브 자체 헤더가 있어 겹침 방지
  if (state.phase === 'lobby' || state.phase === 'end' || state.phase === 'investigation') {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  $('#bar-room-code').textContent = state.code;
  $('#bar-phase-name').textContent = PHASE_NAMES[state.phase] || state.phase;
  
  // 타이머 동기화 설정
  tickBase = { remaining: state.timer.remaining, at: Date.now(), running: state.timer.running };
  const timerText = state.timer.running || state.timer.remaining > 0 ? fmtTime(state.timer.remaining) : '';
  $('#bar-timer').textContent = timerText;
  $('#bar-timer').classList.remove('danger');
}

// ----- 1. 대기실 (Lobby) 렌더링 --------------------------------------------
function renderLobby() {
  const scr = $('#scr-lobby');
  scr.classList.add('active');
  $('#lobby-code-val').textContent = state.code;
  $('#lobby-host-url').textContent = location.host;
  $('#lobby-joined-count').textContent = state.players.length;

  if (state.players.length === 0) {
    $('#lobby-players-list').innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; font-size: 1.5rem;" class="dim">
        참가자 입장을 기다리는 중...
      </div>`;
  } else {
    $('#lobby-players-list').innerHTML = state.players
      .map(p => `
        <div class="lobby-player-card ${p.connected ? 'connected' : 'disconnected'} ${p.isBot ? 'bot' : ''}">
          ${p.isBot ? '🤖 ' : ''}${p.name}
        </div>
      `).join('');
  }
}

// ----- 2. 사건 브리핑 (Briefing) 렌더링 -------------------------------------
function renderBriefing() {
  const scr = $('#scr-briefing');
  scr.classList.add('active');
  
  const container = $('#briefing-slide-content');
  const slideIndex = state.slide;

  let html = '';

  switch (slideIndex) {
    case 0: // Cover
      html = `
        <div class="briefing-cover-wrapper">
          <div class="label-chip" style="margin-bottom: 25px;">DETECTIVE MYSTERY ROLEPLAY</div>
          <h1 class="neon-title" style="font-size: 7.5rem;">과학실의 소동</h1>
          <p class="display-font" style="letter-spacing: 0.1em; color: var(--cyan); font-size: 2.2rem; text-shadow: var(--glow-c);">
            '슈퍼 로봇' 파손 및 설계도 도난 사건
          </p>
        </div>`;
      break;

    case 1: // 사건 개요
      html = `
        <div class="slide-header">
          <div class="slide-number">01</div>
          <h2>사건 개요</h2>
        </div>
        <div class="split-layout">
          <div class="split-left">
            <div class="img-frame">
              <img src="/images/cover.png" alt="사건 현장 복도"/>
            </div>
          </div>
          <div class="split-right">
            <div class="panel frame" style="padding: 30px;">
              <h3 class="cyan" style="font-size: 1.7rem; margin-bottom: 15px;">🔍 발생 상황</h3>
              <p style="font-size: 1.35rem; line-height: 1.8;">
                <b>일시:</b> ${caseRef.overview.when}<br/>
                <b>장소:</b> ${caseRef.overview.where}<br/>
                <b>피해:</b> ${caseRef.overview.damage}
              </p>
            </div>
            <div class="panel purple frame" style="padding: 30px;">
              <h3 class="purple-t" style="font-size: 1.7rem; margin-bottom: 15px;">🗣️ 피해자 강하늘의 진술</h3>
              <p style="font-size: 1.3rem; line-height: 1.75; font-style: italic;">
                ${caseRef.overview.victimStatement}
              </p>
            </div>
          </div>
        </div>`;
      break;

    case 2: // 피해자 강하늘 프로필 (Photo 2)
      html = renderSuspectBriefing({
        ...caseRef.victim,
        title: caseRef.victim.role,
        color: '#7da7ff',
        publicProfile: [caseRef.victim.desc, caseRef.victim.timeline],
      }, '피해자', true);
      break;

    case 3: // 용의자 1 오덕후 프로필
      html = renderSuspectBriefing(caseRef.suspects[0], '용의자 1', false);
      break;

    case 4: // 용의자 2 박체육 프로필
      html = renderSuspectBriefing(caseRef.suspects[1], '용의자 2', false);
      break;

    case 5: // 용의자 3 나범인 프로필
      html = renderSuspectBriefing(caseRef.suspects[2], '용의자 3 (범인)', false);
      break;

    case 6: // 용의자 4 이모범 프로필 (Photo 4)
      html = renderSuspectBriefing(caseRef.suspects[3], '용의자 4', false);
      break;

    case 7: // 알리바이 타임라인 (Photo 1)
      html = renderTimelineBriefing();
      break;

    case 8: // 조사 규칙 (Photo 3)
      html = `
        <div class="slide-header">
          <div class="slide-number">08</div>
          <h2>조사 규칙 및 안내</h2>
        </div>
        <div class="rules-grid">
          <div class="rules-card">
            <div class="icon-box">🔍</div>
            <h3>단서 수집</h3>
            <p>8곳의 장소 및 소지품을 조사하여 총 24개의 단서를 모두 수집하세요.</p>
          </div>
          <div class="rules-card">
            <div class="icon-box">🧩</div>
            <h3>단서 연결</h3>
            <p>형사들은 스마트폰의 비공개 단서를 활용해 정보를 조각맞춤하십시오.</p>
          </div>
          <div class="rules-card">
            <div class="icon-box">👤</div>
            <h3>범인 지목</h3>
            <p>모든 토론이 완료되면 진짜 범인을 지목하여 사건을 해결하십시오!</p>
          </div>
        </div>`;
      break;
  }

  container.innerHTML = html;
}

function renderSuspectBriefing(s, label, isVictim = false) {
  const color = s.color || varSuspectColor(s.key);
  const tagClass = isVictim ? 'red' : 'purple';
  const imgHtml = (s.key === 'science' || s.key === 'sky' || isVictim)
    ? `<div class="img-frame"><img src="/images/cover.png" alt="강하늘"/></div>` // 피해자 강하늘은 제공된 스산한 과학실 배경 사용
    : `<div class="profile-avatar-container" style="border-color: ${color};"><span class="big-emoji">${s.emoji}</span></div>`;

  return `
    <div class="slide-header">
      <div class="slide-number">${isVictim ? '02' : '0' + (caseRef.suspects.findIndex(x => x.key === s.key) + 3)}</div>
      <h2>인물 소개</h2>
    </div>
    <div class="split-layout">
      <div class="split-left">
        ${imgHtml}
      </div>
      <div class="split-right">
        <div class="panel ${tagClass} frame" style="padding: 40px; height: 80%; justify-content: center; display: flex; flex-direction: column;">
          <div class="label-chip" style="margin-bottom: 20px; border-color: ${color}; background: rgba(255,255,255,0.02); color: ${color};">${label}</div>
          <h2 style="font-size: 3.5rem; margin-bottom: 10px; color: ${color}">${s.name} (${s.age}세)</h2>
          <p class="display-font" style="font-size: 1.8rem; color: var(--text-dim); margin-bottom: 25px;">${s.title}</p>
          <ul class="bullet-list">
            ${(s.publicProfile || []).map(p => `<li>${p}</li>`).join('')}
            ${!isVictim ? `<li>알리바이: "${s.alibi}"</li>` : ''}
          </ul>
        </div>
      </div>
    </div>`;
}

function varSuspectColor(key) {
  const map = { odeokhu: '#b44cff', parkcheyuk: '#ff8a3c', nabeomin: '#28e0ff', leemobeom: '#3cff9e' };
  return map[key] || '#28e0ff';
}

function renderTimelineBriefing() {
  const rows = caseRef.timeline.rows;
  
  // 타임라인 그리기 함수
  const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };
  const startLimit = timeToMinutes('18:00');
  const endLimit = timeToMinutes('19:00');
  const totalDuration = endLimit - startLimit; // 60 mins

  const rowHtml = rows.map((row) => {
    const s = caseRef.suspects.find(x => x.key === row.suspect);
    const color = s.color;
    
    const segmentsHtml = row.segments.map(seg => {
      const left = ((timeToMinutes(seg.from) - startLimit) / totalDuration) * 100;
      const width = ((timeToMinutes(seg.to) - timeToMinutes(seg.from)) / totalDuration) * 100;
      // 이미지 슬라이드 9 재현: 오덕후만 보라색, 나머지는 하늘색 바(또는 원래 캐릭터 색상 적용)
      // 여기서는 캐릭터 톤과 디자인 퀄리티를 위해 개별 캐릭터 색상 적용
      return `
        <div class="timeline-bar" style="left: ${left}%; width: ${width}%; background: ${color}; box-shadow: 0 0 15px ${color}80;">
          ${seg.label}
        </div>`;
    }).join('');

    return `
      <div class="timeline-row">
        <div class="timeline-label">
          <div class="timeline-avatar" style="border-color: ${color}; color: ${color};">${s.emoji}</div>
          <span style="color: ${color}">${s.name}</span>
        </div>
        <div class="timeline-track">
          ${segmentsHtml}
        </div>
      </div>`;
  }).join('');

  // 18:30 사건 발생 점선 표시
  const incidentLeft = ((timeToMinutes('18:30') - startLimit) / totalDuration) * 100;

  return `
    <div class="slide-header">
      <div class="slide-number">07</div>
      <h2>알리바이 타임라인</h2>
    </div>
    <div class="timeline-container">
      <div class="timeline-grid-lines">
        ${Array.from({ length: 13 }).map((_, i) => `<div class="timeline-grid-line"></div>`).join('')}
      </div>
      <div class="timeline-grid">
        <!-- 사건 발생 세로 점선 -->
        <div class="timeline-incident-line" style="left: calc(200px + (100% - 200px) * ${incidentLeft / 100} - 1px);">
          <div class="timeline-incident-tag">사건 발생 (18:30)</div>
        </div>
        
        ${rowHtml}
        
        <div class="timeline-time-labels">
          <span>18:00</span>
          <span>18:05</span>
          <span>18:10</span>
          <span>18:15</span>
          <span>18:20</span>
          <span>18:25</span>
          <span>18:30</span>
          <span>18:35</span>
          <span>18:40</span>
          <span>18:45</span>
          <span>18:50</span>
          <span>18:55</span>
          <span>19:00</span>
        </div>
      </div>
    </div>
    <p class="center dim" style="margin-top: 15px; font-size: 1.15rem;">ℹ️ 표시된 시간은 용의자들의 최초 알리바이 진술을 바탕으로 도식화한 내용입니다.</p>`;
}

// ----- 3. 역할 확인 (Roles) 렌더링 ------------------------------------------
function renderRoles() {
  const scr = $('#scr-roles');
  scr.classList.add('active');
}

// ----- 4. 조사 단계 (Investigation) 렌더링 ------------------------------------
const ZONE_METADATA = {
  'science': { emoji: '🧪', name: '과학실', desc: '강하늘이 쓰러진 사고 구역', bg: '/images/robot.png' },
  'art': { emoji: '🎨', name: '미술실', desc: '미술부장 나범인의 부실', bg: 'art' },
  'broadcast': { emoji: '🎙️', name: '방송실', desc: '이모범이 대본을 쓴 장소', bg: 'broadcast' },
  'garden': { emoji: '🌿', name: '체육관 뒤 화단', desc: '배수관과 적토 화단 구역', bg: 'garden' },
  'bag-odeokhu': { emoji: '🎒', name: '오덕후의 가방/소지품', desc: '오덕후의 개인 가방과 지갑', bg: 'bag' },
  'bag-parkcheyuk': { emoji: '👟', name: '박체육의 가방/락커', desc: '박체육의 농구 가방과 캐비닛', bg: 'bag' },
  'bag-nabeomin': { emoji: '🖌️', name: '나범인의 가방/사물함', desc: '나범인의 화구 파우치와 사물함', bg: 'bag' },
  'bag-leemobeom': { emoji: '📱', name: '이모범의 가방/책상', desc: '이모범의 교재 가방과 서랍', bg: 'bag' }
};

function renderInvestigation() {
  const scr = $('#scr-investigation');
  scr.classList.add('active');

  const hubView = $('#invest-hub-view');
  const zoneView = $('#invest-zone-view');

  if (state.activeZone) {
    // 상세 구역 보기
    hubView.style.display = 'none';
    zoneView.style.display = 'flex';
    zoneView.style.flexDirection = 'column';
    renderZoneDetail(state.activeZone);
  } else {
    // 허브 보기
    hubView.style.display = 'flex';
    zoneView.style.display = 'none';
    renderHub();
  }
}

function renderHub() {
  // 타이머 동기화 설정
  tickBase = { remaining: state.timer.remaining, at: Date.now(), running: state.timer.running };
  $('#invest-hub-timer').textContent = state.timer.running || state.timer.remaining > 0 ? fmtTime(state.timer.remaining) : '';
  
  const grid = $('#invest-hub-grid');
  
  grid.innerHTML = Object.entries(ZONE_METADATA).map(([key, info]) => {
    const isSuspect = key.startsWith('bag-');
    const typeLabel = isSuspect ? '인물 소지품' : '장소 조사';
    const typeClass = isSuspect ? 'purple-t' : 'cyan';
    
    return `
      <div class="investigation-card ${isSuspect ? 'suspect-card' : ''}">
        <span class="icon">${info.emoji}</span>
        <h3>${info.name}</h3>
        <span class="badge-type ${typeClass}" style="background: rgba(255,255,255,0.02); border: 1px solid currentColor;">${typeLabel}</span>
        <p class="dim" style="font-size: 1.1rem; text-align: center;">${info.desc}</p>
      </div>`;
  }).join('');
}

function renderEvidencePhoto(clue, options = {}) {
  if (window.CrimeSceneVisuals && window.CrimeSceneVisuals.cluePhoto) {
    return window.CrimeSceneVisuals.cluePhoto(clue, options);
  }
  return `<div class="profile-avatar-container"><span>${clue ? clue.emoji : '🔎'}</span></div>`;
}

function renderZoneEvidenceBoard(zoneKey, clues, meta) {
  if (window.CrimeSceneVisuals && window.CrimeSceneVisuals.zoneBoard) {
    return window.CrimeSceneVisuals.zoneBoard(zoneKey, clues, meta);
  }
  return `
    <div style="text-align: center; padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 20px;">
      <div style="font-size: 7rem;">${meta.emoji}</div>
      <div style="font-size: 2rem; font-weight: 700; color: var(--cyan);">${meta.name}</div>
      <div class="dim" style="font-size: 1.3rem;">현장 조사가 진행 중입니다. 우측 단서를 파헤치십시오.</div>
    </div>`;
}

function renderZoneDetail(zoneKey) {
  const meta = ZONE_METADATA[zoneKey];
  const zoneClues = caseRef.clues.filter(c => c.loc === zoneKey);
  tickBase = { remaining: state.timer.remaining, at: Date.now(), running: state.timer.running };
  const timerHtml = state.timer.running || state.timer.remaining > 0
    ? `<span class="timer-display" style="float:right; font-size:2.2rem;">${fmtTime(state.timer.remaining)}</span>` : '';
  $('#zone-detail-title').innerHTML = `<span style="color:var(--cyan)">${meta.emoji} ${meta.name}</span> <span class="dim" style="font-size: 1.8rem;">— 현장 세부 단서 확인</span>${timerHtml}`;
  
  // 1) 좌측 비주얼 보드 렌더링
  const visualBox = $('#zone-visual-box');
  visualBox.innerHTML = '';
  visualBox.classList.remove('scan-reveal');
  void visualBox.offsetWidth;
  visualBox.classList.add('scan-reveal');
  visualBox.innerHTML = renderZoneEvidenceBoard(zoneKey, zoneClues, meta);

  // 2) 우측 3가지 단서 상세 내용 렌더링 (비공개 힌트는 노출하지 않고 핵심 제목과 현장 설명만 노출)
  const cluesList = $('#zone-clues-list');

  cluesList.innerHTML = zoneClues.map((cl) => `
    <div class="zone-clue-item evidence-list-item">
      ${renderEvidencePhoto(cl, { mini: true, caption: false, number: cl.id })}
      <div class="zone-clue-copy">
        <h4>${cl.emoji} ${cl.title}</h4>
        <p style="margin-top: 10px;">${cl.desc}</p>
      </div>
    </div>
  `).join('');
}

// ----- 5. 용의자 심문 (Questioning) 렌더링 ------------------------------------
function renderQuestioning() {
  const scr = $('#scr-questioning');
  scr.classList.add('active');

  const container = $('#questioning-suspects-list');
  
  container.innerHTML = caseRef.suspects.map(s => {
    const isSpotlight = state.spotlight === s.key;
    const color = s.color || varSuspectColor(s.key);
    return `
      <div class="suspect-profile-card ${isSpotlight ? 'spotlight' : ''}">
        <div class="spotlight-indicator">심문 중</div>
        <div class="avatar" style="${isSpotlight ? `border-color: ${color}; color: ${color};` : ''}">
          ${s.emoji}
        </div>
        <h3 style="color: ${color}">${s.name}</h3>
        <div class="role">${s.title}</div>
        <div class="alibi-bubble">
          <b class="cyan" style="font-size: 1.1rem; display: block; margin-bottom: 5px;">[주장 알리바이]</b>
          "${s.alibi}"
        </div>
      </div>
    `;
  }).join('');
}

// ----- 6. 최종 토론 (Final) 렌더링 -------------------------------------------
function renderFinal() {
  const scr = $('#scr-final');
  scr.classList.add('active');

  // 대형 타이머 싱크
  tickBase = { remaining: state.timer.remaining, at: Date.now(), running: state.timer.running };
  const timerText = state.timer.running || state.timer.remaining > 0 ? fmtTime(state.timer.remaining) : '00:00';
  $('#final-large-timer').textContent = timerText;
}

// ----- 7. 범인 투표 (Vote) 렌더링 --------------------------------------------
function renderVote() {
  const scr = $('#scr-vote');
  scr.classList.add('active');

  const votedCount = state.votesSubmitted;
  const totalCount = state.votesEligible;
  const pct = totalCount > 0 ? (votedCount / totalCount) * 100 : 0;

  $('#vote-progress-text').textContent = `${votedCount} / ${totalCount} 명`;
  $('#vote-progress-bar').style.width = `${pct}%`;

  const statusList = $('#vote-players-status');
  statusList.innerHTML = state.players.map(p => `
    <div class="lobby-player-card ${p.connected ? '' : 'disconnected'} ${p.voted ? 'connected' : ''} ${p.isBot ? 'bot' : ''}">
      ${p.isBot ? '🤖 보조 ' : (p.voted ? '✅ ' : '⏳ ')} ${p.name}
    </div>
  `).join('');
}

// ----- 8. 진상 공개 (Reveal) 렌더링 -------------------------------------------
function renderReveal() {
  const scr = $('#scr-reveal');
  scr.classList.add('active');

  const container = $('#reveal-content-container');
  const stepIndex = state.revealStep;
  const step = state.revealSteps ? state.revealSteps[stepIndex] : null;

  if (!step) {
    container.innerHTML = `<div class="center dim" style="font-size: 2rem; padding: 100px;">공개 단계를 대기하는 중...</div>`;
    return;
  }

  $('#reveal-title').textContent = step.title;

  let html = '';

  switch (step.kind) {
    case 'votes': // 투표 결과 그래프
      const tally = state.voteResult || {};
      const chartRows = caseRef.suspects.map(s => {
        const count = tally[s.key] || 0;
        const total = Object.values(tally).reduce((a, b) => a + b, 0) || 1;
        const fillPct = (count / total) * 100;
        const color = s.color;

        return `
          <div class="vote-bar-row">
            <div class="vote-bar-label" style="color: ${color};">${s.emoji} ${s.name}</div>
            <div class="vote-bar-track">
              <div class="vote-bar-fill" style="width: ${fillPct}%; background: ${color}; box-shadow: 0 0 15px ${color};"></div>
            </div>
            <div class="vote-bar-count">${count} 표</div>
          </div>`;
      }).join('');

      html = `
        <div class="reveal-card">
          <p style="font-size: 1.4rem; margin-bottom: 30px;" class="dim center">${step.body}</p>
          <div class="vote-chart-container">
            ${chartRows}
          </div>
        </div>`;
      break;

    case 'culprit': // 범인 공개
      const culprit = caseRef.suspects.find(x => x.key === state.culpritKey);
      html = `
        <div class="reveal-card culprit-reveal">
          <div style="font-size: 11rem;">🚨</div>
          <h1 class="red-t" style="font-size: 4.8rem; margin: 20px 0; font-family: 'Black Han Sans', sans-serif;">
            ${step.body}
          </h1>
          <p style="font-size: 1.8rem; line-height: 1.8; max-width: 900px; margin: 20px auto 0;" class="dim">
            ${step.detail}
          </p>
        </div>`;
      break;

    case 'evidence': // 결정적 단서 설명
      const clue = caseRef.clues.find(c => c.id === step.clueId);
      html = `
        <div class="reveal-card">
          <div class="split-layout">
            <div class="split-left" style="flex: 0.8; justify-content: center; display: flex;">
              ${clue ? renderEvidencePhoto(clue, { large: true }) : '<div class="profile-avatar-container"><span>🔎</span></div>'}
            </div>
            <div class="split-right" style="flex: 2;">
              <div class="label-chip" style="border-color: var(--red); color: #ff9eb0; background: rgba(255, 59, 92, 0.1); margin-bottom: 15px;">결정적 증거</div>
              <h2 style="font-size: 2.2rem; margin-bottom: 15px; color: var(--cyan);">${clue ? clue.title : step.title}</h2>
              <p style="font-size: 1.35rem; line-height: 1.8;">${step.body}</p>
              ${clue ? `<hr class="neon"/><p class="dim" style="font-size: 1.2rem;"><b>현장 발견 내용:</b> ${clue.desc}</p>` : ''}
            </div>
          </div>
        </div>`;
      break;

    case 'timeline': // 범행 재구성
      html = `
        <div class="reveal-card">
          <div class="label-chip" style="margin-bottom: 20px;">CRIME RECONSTRUCTION</div>
          <p style="font-size: 1.45rem; line-height: 1.95; white-space: pre-line;">
            ${step.body.replace(/ → /g, '\n➡️ ')}
          </p>
        </div>`;
      break;

    case 'others': // 타 용의자 비밀 해제
      const secretsHtml = step.items.map(item => {
        const s = caseRef.suspects.find(x => x.key === item.key);
        const color = s.color;
        return `
          <div class="zone-clue-item" style="border-left: 4px solid ${color};">
            <h4 style="color: ${color}; font-size: 1.6rem;">${s.emoji} ${s.name}</h4>
            <p style="font-size: 1.25rem; margin-top: 10px; line-height: 1.7; color: var(--text);">${item.text}</p>
          </div>`;
      }).join('');

      html = `
        <div class="reveal-card" style="display: flex; flex-direction: column; gap: 25px;">
          <p class="dim" style="font-size: 1.35rem;">${step.body}</p>
          ${secretsHtml}
        </div>`;
      break;

    case 'ending': // 엔딩
      html = `
        <div class="reveal-card" style="text-align: center; border-color: var(--green); background: rgba(60, 255, 158, 0.02);">
          <div style="font-size: 6rem;">✨🕵️✨</div>
          <h1 class="green-t" style="font-size: 3.5rem; margin: 20px 0; font-family: 'Black Han Sans', sans-serif;">${step.title}</h1>
          <p style="font-size: 1.6rem; line-height: 1.8; max-width: 800px; margin: 0 auto;" class="dim">${step.body}</p>
        </div>`;
      break;
  }

  container.innerHTML = html;
}

// ----- 9. 사건 종결 (End) 렌더링 ---------------------------------------------
function renderEnd() {
  const scr = $('#scr-end');
  scr.classList.add('active');
}

// 페이지 로드 시 시작
window.onload = init;
