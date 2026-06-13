// =====================================================================
// 과학실의 소동 — 멀티플레이어 크라임씬 서버
// Node.js + Express + Socket.IO. 방 상태는 메모리에 보관한다.
// =====================================================================
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const { CASE, distributeClues } = require('./data/caseData');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// 공개 사건 자료 (비밀 정보 제거: 숨겨진 진실, 범인 정보, 단서 힌트 제외)
const PUBLIC_CASE = {
  title: CASE.title,
  subtitle: CASE.subtitle,
  overview: CASE.overview,
  rules: CASE.rules,
  victim: CASE.victim,
  timeline: CASE.timeline,
  locations: CASE.locations,
  suspects: CASE.suspects.map((s) => ({
    key: s.key, name: s.name, age: s.age, title: s.title,
    emoji: s.emoji, color: s.color,
    publicProfile: s.publicProfile, alibi: s.alibi, motive: s.motive,
    timelineLabel: s.timelineLabel,
  })),
  clues: CASE.clues.map((c) => ({
    id: c.id, loc: c.loc, title: c.title, emoji: c.emoji, desc: c.desc
  })),
};
app.get('/api/case', (_req, res) => res.json(PUBLIC_CASE));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || process.argv[2] || 3000;
const ROOM_TTL_MS = 1000 * 60 * 60 * 6; // 6시간 후 빈 방 정리
const MAX_PLAYERS = 20;
const MIN_START_PLAYERS = 5;

const BOT_NAMES = [
  '증거분석 봇', '알리바이 봇', '현장스캔 봇', '타임라인 봇',
  '분광분석 봇', '지문대조 봇', '기록정리 봇', '논리검증 봇',
  '단서분류 봇', '추론보조 봇', '랩메이트 봇', '탐문보조 봇',
];

const INVESTIGATION_ZONE_KEYS = new Set(CASE.clues.map((c) => c.loc));

const PHASES = [
  'lobby',          // 입장 대기
  'briefing',       // 사건 브리핑 (슬라이드)
  'roles',          // 비공개 역할/단서 확인
  'investigation',  // 단서 공유 토론
  'questioning',    // 용의자 심문
  'final',          // 최종 토론
  'vote',           // 투표
  'reveal',         // 진상 공개 (단계별)
  'end',            // 종료
];

const rooms = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 헷갈리는 글자 제외
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function token() {
  return crypto.randomBytes(12).toString('hex');
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function nextBotName(room) {
  const used = new Set([...room.players.values()].map((p) => p.name));
  const pooled = BOT_NAMES.find((name) => !used.has(name));
  if (pooled) return pooled;
  let n = 1;
  while (used.has(`수사봇 ${String(n).padStart(2, '0')}`)) n++;
  return `수사봇 ${String(n).padStart(2, '0')}`;
}

function makeBotPlayer(room) {
  return {
    id: `bot_${token()}`,
    token: null,
    name: nextBotName(room),
    role: null,
    suspectKey: null,
    socketId: null,
    connected: true,
    isBot: true,
  };
}

function invalidatePendingRoles(room) {
  if (room.started) return;
  room.rolesAssigned = false;
  room.clueAssign = {};
  for (const p of room.players.values()) {
    p.role = null;
    p.suspectKey = null;
  }
}

function createRoom() {
  const code = makeCode();
  const room = {
    code,
    hostToken: token(),
    createdAt: Date.now(),
    phase: 'lobby',
    slide: 0,          // briefing 슬라이드 인덱스
    revealStep: -1,    // reveal 단계 인덱스
    spotlight: null,   // 심문 중 강조할 용의자 key
    activeZone: null,  // 조사 단계 상세 구역 key
    revealedZones: new Set(), // 진행자가 한 번이라도 공개한 조사 구역
    started: false,
    rolesAssigned: false,
    players: new Map(), // playerId -> player
    clueAssign: {},     // playerId -> [clueId]
    voteOpen: false,
    voteClosed: false,
    votes: new Map(),   // playerId -> suspectKey
    timer: { running: false, endsAt: 0, remaining: 0 },
  };
  rooms.set(code, room);
  return room;
}

// ----- 상태 직렬화 ----------------------------------------------------
function timerState(room) {
  const t = room.timer;
  return {
    running: t.running,
    remaining: t.running ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) : t.remaining,
  };
}

function publicPlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    role: room.started ? p.role : null,            // 'suspect' | 'detective'
    suspectKey: room.started ? p.suspectKey : null, // 어떤 용의자를 연기하는지는 공개 정보
    connected: p.connected,
    isBot: !!p.isBot,
    voted: room.votes.has(p.id),
  }));
}

function voteTally(room) {
  const tally = {};
  for (const s of CASE.suspects) tally[s.key] = 0;
  for (const [playerId, v] of room.votes.entries()) {
    const player = room.players.get(playerId);
    if (player && !player.isBot && tally[v] !== undefined) tally[v]++;
  }
  return tally;
}

function votingPlayers(room) {
  return [...room.players.values()].filter((p) => !p.isBot);
}

function publicState(room) {
  return {
    code: room.code,
    phase: room.phase,
    slide: room.slide,
    revealStep: room.revealStep,
    spotlight: room.spotlight,
    activeZone: room.activeZone,
    revealedZones: [...room.revealedZones],
    started: room.started,
    players: publicPlayers(room),
    timer: timerState(room),
    voteOpen: room.voteOpen,
    voteClosed: room.voteClosed,
    votesSubmitted: votingPlayers(room).filter((p) => room.votes.has(p.id)).length,
    votesEligible: votingPlayers(room).length,
    // 투표가 마감되고 공개 단계에 들어간 뒤에만 집계 공개
    voteResult: room.voteClosed && room.phase === 'reveal' ? voteTally(room) : null,
    // 진상 공개 단계에 들어가야만 전말/범인 정보가 공개 채널에 실린다
    revealSteps: room.phase === 'reveal' || room.phase === 'end' ? CASE.reveal.steps : null,
    culpritKey: room.phase === 'reveal' || room.phase === 'end' ? CASE.reveal.culpritKey : null,
  };
}

function privateState(room, player) {
  if (!room.started) return { role: null };
  if (player.role === 'suspect') {
    const s = CASE.suspects.find((x) => x.key === player.suspectKey);
    return { role: 'suspect', suspect: s, isCulprit: !!s.isCulprit };
  }
  const clueIds = room.clueAssign[player.id] || [];
  const clues = CASE.clues.filter((c) => clueIds.includes(c.id));
  return { role: 'detective', clues };
}

function hostState(room) {
  return {
    ...publicState(room),
    // 진행자는 게임 시작 전에도 배정된 역할을 모두 볼 수 있다
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      suspectKey: p.suspectKey,
      connected: p.connected,
      isBot: !!p.isBot,
      voted: room.votes.has(p.id),
    })),
    hostView: {
      culpritKey: CASE.reveal.culpritKey,
      suspects: CASE.suspects,
      clueAssign: Object.fromEntries(
        [...room.players.values()]
          .filter((p) => p.role === 'detective')
          .map((p) => [p.id, room.clueAssign[p.id] || []])
      ),
      allClues: CASE.clues,
      voteResult: voteTally(room),
      votesDetail: Object.fromEntries(room.votes),
    },
  };
}

// ----- 브로드캐스트 ----------------------------------------------------
function syncRoom(room) {
  io.to(`pub:${room.code}`).emit('state', publicState(room));
  io.to(`host:${room.code}`).emit('hostState', hostState(room));
}

function syncPlayer(room, player) {
  if (player.socketId) {
    io.to(player.socketId).emit('private', privateState(room, player));
  }
}

function syncAllPlayers(room) {
  for (const p of room.players.values()) syncPlayer(room, p);
}

// ----- 소켓 ------------------------------------------------------------
io.on('connection', (socket) => {
  let ctx = { room: null, playerId: null, isHost: false };

  const getRoom = (code) => rooms.get(String(code || '').toUpperCase());

  // 진행자: 방 생성
  socket.on('host:create', (cb) => {
    const room = createRoom();
    cb && cb({ ok: true, code: room.code, hostToken: room.hostToken });
  });

  // 진행자: 접속/재접속
  socket.on('host:attach', ({ code, hostToken }, cb) => {
    const room = getRoom(code);
    if (!room || room.hostToken !== hostToken) return cb && cb({ ok: false, error: '방을 찾을 수 없거나 진행자 키가 틀립니다.' });
    ctx = { room, playerId: null, isHost: true };
    socket.join(`pub:${room.code}`);
    socket.join(`host:${room.code}`);
    cb && cb({ ok: true, case: { title: CASE.title, subtitle: CASE.subtitle, suspects: CASE.suspects, clues: CASE.clues, phases: PHASES } });
    socket.emit('hostState', hostState(room));
  });

  // 공유 디스플레이: 접속 (공개 정보만 수신)
  socket.on('display:attach', ({ code }, cb) => {
    const room = getRoom(code);
    if (!room) return cb && cb({ ok: false, error: '방을 찾을 수 없습니다.' });
    ctx = { room, playerId: null, isHost: false };
    socket.join(`pub:${room.code}`);
    cb && cb({ ok: true });
    socket.emit('state', publicState(room));
  });

  // 참가자: 입장
  socket.on('player:join', ({ code, name }, cb) => {
    const room = getRoom(code);
    if (!room) return cb && cb({ ok: false, error: '방 코드를 확인해 주세요.' });
    if (room.started) return cb && cb({ ok: false, error: '이미 게임이 시작된 방입니다.' });
    name = String(name || '').trim().slice(0, 12);
    if (!name) return cb && cb({ ok: false, error: '이름을 입력해 주세요.' });
    if ([...room.players.values()].some((p) => p.name === name)) {
      return cb && cb({ ok: false, error: '같은 이름의 참가자가 있습니다.' });
    }
    if (room.players.size >= MAX_PLAYERS) return cb && cb({ ok: false, error: `정원(${MAX_PLAYERS}명)이 가득 찼습니다.` });

    const player = {
      id: token(), token: token(), name,
      role: null, suspectKey: null,
      socketId: socket.id, connected: true,
      isBot: false,
    };
    room.players.set(player.id, player);
    invalidatePendingRoles(room);
    ctx = { room, playerId: player.id, isHost: false };
    socket.join(`pub:${room.code}`);
    cb && cb({ ok: true, playerId: player.id, token: player.token, code: room.code });
    socket.emit('state', publicState(room));
    syncRoom(room);
  });

  // 참가자: 재접속
  socket.on('player:rejoin', ({ code, token: t }, cb) => {
    const room = getRoom(code);
    const player = room && [...room.players.values()].find((p) => p.token === t);
    if (!player) return cb && cb({ ok: false, error: '재접속 정보를 찾을 수 없습니다.' });
    player.socketId = socket.id;
    player.connected = true;
    ctx = { room, playerId: player.id, isHost: false };
    socket.join(`pub:${room.code}`);
    cb && cb({ ok: true, playerId: player.id, name: player.name });
    socket.emit('state', publicState(room));
    syncPlayer(room, player);
    syncRoom(room);
  });

  // ----- 진행자 전용 명령 ---------------------------------------------
  const requireHost = (fn) => (payload, cb) => {
    if (!ctx.isHost || !ctx.room) return cb && cb({ ok: false, error: '권한이 없습니다.' });
    fn(ctx.room, payload || {}, cb);
  };

  socket.on('host:addBots', requireHost((room, { count }, cb) => {
    if (room.started) return cb && cb({ ok: false, error: '게임 시작 후에는 봇을 추가할 수 없습니다.' });
    const n = Math.max(1, Math.min(MAX_PLAYERS, Number(count) || 1));
    const available = MAX_PLAYERS - room.players.size;
    if (available <= 0) return cb && cb({ ok: false, error: `정원(${MAX_PLAYERS}명)이 가득 찼습니다.` });

    const added = [];
    for (let i = 0; i < Math.min(n, available); i++) {
      const bot = makeBotPlayer(room);
      room.players.set(bot.id, bot);
      added.push({ id: bot.id, name: bot.name });
    }
    invalidatePendingRoles(room);
    cb && cb({ ok: true, added });
    syncRoom(room);
  }));

  socket.on('host:removeBots', requireHost((room, _p, cb) => {
    if (room.started) return cb && cb({ ok: false, error: '게임 시작 후에는 봇을 일괄 정리할 수 없습니다.' });
    const botIds = [...room.players.values()].filter((p) => p.isBot).map((p) => p.id);
    for (const id of botIds) {
      room.players.delete(id);
      room.votes.delete(id);
      delete room.clueAssign[id];
    }
    if (botIds.length > 0) invalidatePendingRoles(room);
    cb && cb({ ok: true, removed: botIds.length });
    syncRoom(room);
  }));

  socket.on('host:assignRoles', requireHost((room, _p, cb) => {
    const ids = [...room.players.keys()];
    if (ids.length < MIN_START_PLAYERS) return cb && cb({ ok: false, error: '최소 5명(용의자 4 + 형사 1)이 필요합니다.' });
    const suspectKeys = CASE.suspects.map((s) => s.key);
    [...room.players.values()].forEach((p) => { p.role = null; p.suspectKey = null; });
    const humanIds = shuffle(ids.filter((id) => !room.players.get(id).isBot));
    const botIds = shuffle(ids.filter((id) => room.players.get(id).isBot));
    const suspectIds = humanIds.slice(0, 4);
    if (suspectIds.length < 4) suspectIds.push(...botIds.slice(0, 4 - suspectIds.length));
    const suspectSet = new Set(suspectIds);
    const detectiveIds = [...humanIds.slice(4), ...botIds.filter((id) => !suspectSet.has(id))];

    suspectIds.forEach((id, i) => {
      const p = room.players.get(id);
      p.role = 'suspect';
      p.suspectKey = suspectKeys[i];
    });
    detectiveIds.forEach((id) => { room.players.get(id).role = 'detective'; });
    room.rolesAssigned = true;
    cb && cb({ ok: true });
    syncRoom(room);
  }));

  socket.on('host:start', requireHost((room, _p, cb) => {
    if (!room.rolesAssigned) return cb && cb({ ok: false, error: '먼저 역할을 배정해 주세요.' });
    const detectives = [...room.players.values()].filter((p) => p.role === 'detective').map((p) => p.id);
    room.clueAssign = distributeClues(detectives);
    room.started = true;
    room.phase = 'briefing';
    room.slide = 0;
    room.activeZone = null;
    room.revealedZones.clear();
    cb && cb({ ok: true });
    syncRoom(room);
    syncAllPlayers(room);
  }));

  socket.on('host:phase', requireHost((room, { phase }, cb) => {
    if (!PHASES.includes(phase)) return cb && cb({ ok: false, error: '알 수 없는 단계입니다.' });
    room.phase = phase;
    room.activeZone = null; // 단계 변경 시 상세 구역 초기화
    if (phase === 'briefing') room.slide = 0;
    if (phase === 'reveal') { room.revealStep = 0; room.voteOpen = false; if (room.votes.size > 0) room.voteClosed = true; }
    if (phase === 'vote') { room.voteOpen = true; room.voteClosed = false; }
    if (phase !== 'questioning') room.spotlight = null;
    // 단계 전환 시 타이머 정지
    room.timer = { running: false, endsAt: 0, remaining: 0 };
    cb && cb({ ok: true });
    syncRoom(room);
  }));

  socket.on('host:investigationZone', requireHost((room, { zoneKey }, cb) => {
    if (zoneKey && !INVESTIGATION_ZONE_KEYS.has(zoneKey)) {
      return cb && cb({ ok: false, error: '알 수 없는 조사 구역입니다.' });
    }
    room.activeZone = zoneKey || null;
    if (zoneKey) room.revealedZones.add(zoneKey);
    cb && cb({ ok: true });
    syncRoom(room);
  }));

  socket.on('host:slide', requireHost((room, { delta, set }, cb) => {
    const max = 8; // 브리핑 슬라이드 0~8 (display.js의 슬라이드 정의와 일치)
    if (typeof set === 'number') room.slide = Math.min(max, Math.max(0, set));
    else room.slide = Math.min(max, Math.max(0, room.slide + (delta || 0)));
    cb && cb({ ok: true });
    syncRoom(room);
  }));

  socket.on('host:revealStep', requireHost((room, { delta }, cb) => {
    const max = CASE.reveal.steps.length - 1;
    room.revealStep = Math.min(max, Math.max(0, room.revealStep + (delta || 0)));
    cb && cb({ ok: true });
    syncRoom(room);
  }));

  socket.on('host:spotlight', requireHost((room, { suspectKey }, cb) => {
    room.spotlight = suspectKey || null;
    cb && cb({ ok: true });
    syncRoom(room);
  }));

  socket.on('host:timer', requireHost((room, { action, seconds }, cb) => {
    const t = room.timer;
    if (action === 'start') {
      const s = Math.max(10, Math.min(3600, seconds || 600));
      room.timer = { running: true, endsAt: Date.now() + s * 1000, remaining: 0 };
    } else if (action === 'pause' && t.running) {
      room.timer = { running: false, endsAt: 0, remaining: Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) };
    } else if (action === 'resume' && !t.running && t.remaining > 0) {
      room.timer = { running: true, endsAt: Date.now() + t.remaining * 1000, remaining: 0 };
    } else if (action === 'add') {
      if (t.running) t.endsAt += (seconds || 60) * 1000;
      else t.remaining += seconds || 60;
    } else if (action === 'reset') {
      room.timer = { running: false, endsAt: 0, remaining: 0 };
    }
    cb && cb({ ok: true });
    syncRoom(room);
  }));

  socket.on('host:voteControl', requireHost((room, { action }, cb) => {
    if (action === 'open') { room.voteOpen = true; room.voteClosed = false; }
    if (action === 'close') { room.voteOpen = false; room.voteClosed = true; }
    if (action === 'resetVotes') { room.votes.clear(); room.voteClosed = false; }
    cb && cb({ ok: true });
    syncRoom(room);
  }));

  socket.on('host:kick', requireHost((room, { playerId }, cb) => {
    const p = room.players.get(playerId);
    if (p) {
      if (p.socketId) io.to(p.socketId).emit('kicked');
      room.players.delete(playerId);
      room.votes.delete(playerId);
      delete room.clueAssign[playerId];
      invalidatePendingRoles(room);
    }
    cb && cb({ ok: true });
    syncRoom(room);
  }));

  // ----- 참가자: 투표 --------------------------------------------------
  socket.on('player:vote', ({ suspectKey }, cb) => {
    const room = ctx.room;
    const player = room && room.players.get(ctx.playerId);
    if (!room || !player) return cb && cb({ ok: false, error: '방 정보가 없습니다.' });
    if (!room.voteOpen) return cb && cb({ ok: false, error: '지금은 투표 시간이 아닙니다.' });
    if (!CASE.suspects.some((s) => s.key === suspectKey)) return cb && cb({ ok: false, error: '잘못된 대상입니다.' });
    room.votes.set(player.id, suspectKey);
    cb && cb({ ok: true, voted: suspectKey });
    syncRoom(room);
  });

  socket.on('disconnect', () => {
    const room = ctx.room;
    if (!room) return;
    const player = room.players.get(ctx.playerId);
    if (player && player.socketId === socket.id) {
      player.connected = false;
      player.socketId = null;
      syncRoom(room);
    }
  });
});

// 오래된 방 정리
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS) rooms.delete(code);
  }
}, 1000 * 60 * 10);

server.listen(PORT, () => {
  console.log(`🕵️  과학실의 소동 서버 실행 중: http://localhost:${PORT}`);
});
