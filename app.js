// 토닥 쉼터 — 화면 움직임 · 여러 사람 동시 접속 · 말풍선
import * as THREE from 'three';
import { createClient } from '@supabase/supabase-js';
import { SCENES } from './world.js';
import { CHARS, makeAvatar, preload } from './avatar.js';
import { startMusic, stopMusic, setVolume, musicOn } from './music.js';

// 전시관 앱들과 같은 Supabase 프로젝트의 "실시간 중계" 기능만 씁니다(표·파일 저장 없음).
// publishable key는 공개용 키라 코드에 넣어도 됩니다.
const SUPABASE_URL = 'https://pgywpdodatjfpivxmymn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FeO3LdfFBB6KEwblcZPa2w_sW9dVuUg';
const ROOM_MAX = 50;
const CH = 'todak-v3';

const $ = (id) => document.getElementById(id);
const ADJ = ['다정한', '씩씩한', '포근한', '꼼꼼한', '느긋한', '상냥한', '노래하는', '산책하는', '햇살같은', '별빛같은', '차분한', '든든한', '빙그레', '토닥토닥', '반가운', '말랑한', '싱그러운', '도란도란'];
const randName = () => ADJ[Math.floor(Math.random() * ADJ.length)] + '선생님';
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

const me = {
  id: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).slice(0, 12),
  name: '', char: CHARS[Math.floor(Math.random() * CHARS.length)].id, room: 'garden', x: 0, z: 0, ry: 0, sit: null,
};

// ───────── 3D 기본 틀
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8e5d8');
scene.fog = new THREE.Fog('#e8e5d8', 45, 90);
const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 200);

scene.add(new THREE.HemisphereLight('#fffaf0', '#b8c4a0', 1.35));
const sun = new THREE.DirectionalLight('#fff3dc', 2.1);
sun.position.set(-12, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 });
sun.shadow.bias = -0.0005;
sun.shadow.radius = 4;
scene.add(sun);
const actors = new THREE.Group();
scene.add(actors);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', () => { resize(); if (S && !cam.close) cam.distT = baseDist(); });
resize();

// ───────── 장면(마당/방)
const built = {};
let S = null;
function showScene(id) {
  if (S) scene.remove(S.group);
  const def = SCENES.find((s) => s.id === id);
  if (!built[id]) built[id] = def.build();
  S = built[id];
  scene.add(S.group);
  $('sceneTitle').textContent = S.title;
  $('sceneSub').textContent = S.sub;
  cam.distT = baseDist();
  if (!cam.close) cam.focusT.copy(S.center);
}
// 화면이 좁거나 세로로 길면 조금 더 멀리서 봐서 공간 전체가 들어오게
const baseDist = () => S.dist * Math.min(2.3, Math.max(1, 1.75 / (innerWidth / innerHeight)));

// ───────── 카메라
const cam = { yaw: 0.62, yawT: 0.62, pitch: 0.82, dist: 31, distT: 31, focus: new THREE.Vector3(), focusT: new THREE.Vector3(), close: false };
function updateCamera(dt) {
  const k = 1 - Math.exp(-dt * 5);
  cam.yaw += (cam.yawT - cam.yaw) * k;
  cam.dist += (cam.distT - cam.dist) * k;
  if (cam.close && myActor) cam.focusT.set(me.x, 0.8, me.z);
  cam.focus.lerp(cam.focusT, k);
  const cp = Math.cos(cam.pitch);
  camera.position.set(
    cam.focus.x + Math.sin(cam.yaw) * cp * cam.dist,
    cam.focus.y + Math.sin(cam.pitch) * cam.dist,
    cam.focus.z + Math.cos(cam.yaw) * cp * cam.dist,
  );
  camera.lookAt(cam.focus);
}
function setClose(v) {
  cam.close = v;
  $('closeBtn').classList.toggle('on', v);
  $('closeBtn').textContent = v ? '전체 보기' : '가까이 보기';
  cam.distT = v ? 13 : baseDist();
  if (!v) cam.focusT.copy(S.center);
}
$('closeBtn').onclick = () => setClose(!cam.close);
$('rotL').onclick = () => (cam.yawT -= Math.PI / 4);
$('rotR').onclick = () => (cam.yawT += Math.PI / 4);
$('homeBtn').onclick = () => { cam.yawT = 0.62; setClose(false); };
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.distT = Math.max(8, Math.min(46, cam.distT * (e.deltaY > 0 ? 1.1 : 0.9)));
}, { passive: false });

// ───────── 사람(나 + 다른 선생님들)
const labels = $('labels');
const people = new Map(); // id -> actor
let myActor = null;

function makeActor(id, info, isMe = false) {
  const av = makeAvatar(info.char || CHARS[0].id);
  actors.add(av.root);
  const tag = document.createElement('div');
  tag.className = 'tag' + (isMe ? ' me' : '');
  tag.textContent = info.name || '선생님';
  labels.appendChild(tag);
  const a = {
    id, av, tag, bubble: null, bubbleTimer: 0, name: info.name, isMe, char: info.char,
    x: info.x ?? 0, z: info.z ?? 0, ry: info.ry ?? 0, sit: info.sit || null,
    t: { x: info.x ?? 0, z: info.z ?? 0, ry: info.ry ?? 0, sit: info.sit || null, w: false },
    walking: false,
  };
  av.root.position.set(a.x, 0, a.z);
  return a;
}
function removeActor(a) {
  actors.remove(a.av.root);
  a.av.dispose();
  a.tag.remove();
  if (a.bubble) a.bubble.remove();
}
function say(a, text, gesture = 'emote-yes') {
  if (!a) return;
  a.av.gesture(gesture);
  if (a.bubble) a.bubble.remove();
  const b = document.createElement('div');
  b.className = 'bubble';
  b.textContent = text;
  labels.appendChild(b);
  a.bubble = b;
  a.bubbleTimer = 6;
}
function clearPeers() {
  for (const a of people.values()) removeActor(a);
  people.clear();
}

// ───────── 내 움직임
const keys = new Set();
let moveTarget = null, pendingSeat = null, stuckTime = 0;
const SPEED = 3.3, R = 0.3;
addEventListener('keydown', (e) => {
  if (document.activeElement === $('sayInput')) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
    keys.add(k); e.preventDefault(); moveTarget = null; pendingSeat = null;
  }
  if (k === 'enter' && myActor) { $('sayInput').focus(); e.preventDefault(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

function blocked(x, z) {
  const b = S.bounds;
  if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return true;
  for (const o of S.obstacles) {
    if (o.r !== undefined) { if (Math.hypot(x - o.cx, z - o.cz) < o.r + R) return true; }
    else if (x > o.x0 - R && x < o.x1 + R && z > o.z0 - R && z < o.z1 + R) return true;
  }
  return false;
}
function standUp() {
  if (!me.sit) return;
  const s = me.sit;
  me.sit = null;
  let nx = s.x + Math.sin(s.f) * 0.7, nz = s.z + Math.cos(s.f) * 0.7;
  if (blocked(nx, nz)) { nx = s.x; nz = s.z; }
  me.x = nx; me.z = nz;
  sendMove(true);
}
function sitOn(seat) {
  me.sit = { x: seat.x, z: seat.z, f: seat.facing, y: seat.y };
  me.x = seat.x; me.z = seat.z; me.ry = seat.facing;
  moveTarget = null; pendingSeat = null;
  sendMove(true);
}
function stepMe(dt) {
  let dx = 0, dz = 0;
  const f = keys.has('arrowup') || keys.has('w') ? 1 : 0, bk = keys.has('arrowdown') || keys.has('s') ? 1 : 0;
  const l = keys.has('arrowleft') || keys.has('a') ? 1 : 0, r = keys.has('arrowright') || keys.has('d') ? 1 : 0;
  if (f || bk || l || r) {
    const fwd = f - bk, side = r - l;
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    dx = -sy * fwd + cy * side;
    dz = -cy * fwd - sy * side;
  } else if (moveTarget) {
    dx = moveTarget.x - me.x; dz = moveTarget.z - me.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) {
      moveTarget = null; dx = dz = 0;
      if (pendingSeat) sitOn(pendingSeat);
    }
  }
  const len = Math.hypot(dx, dz);
  let moved = false;
  if (len > 0.001) {
    if (me.sit) standUp();
    const step = Math.min(SPEED * dt, moveTarget ? Math.hypot(moveTarget.x - me.x, moveTarget.z - me.z) : 99);
    const vx = (dx / len) * step, vz = (dz / len) * step;
    const ox = me.x, oz = me.z;
    if (!blocked(me.x + vx, me.z)) me.x += vx;
    if (!blocked(me.x, me.z + vz)) me.z += vz;
    moved = Math.hypot(me.x - ox, me.z - oz) > 0.0005;
    const want = Math.atan2(dx, dz);
    let diff = want - me.ry;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    me.ry += diff * Math.min(1, dt * 12);
    if (!moved && moveTarget) {
      stuckTime += dt;
      if (stuckTime > 0.25) {
        if (pendingSeat && Math.hypot(pendingSeat.x - me.x, pendingSeat.z - me.z) < 2.2) sitOn(pendingSeat);
        moveTarget = null; pendingSeat = null; stuckTime = 0;
      }
    } else stuckTime = 0;
  }
  myActor.walking = moved;
  myActor.x = me.x; myActor.z = me.z; myActor.ry = me.ry; myActor.sit = me.sit;
  if (moved) sendMove(false);
  else if (wasMoving) sendMove(true);
  wasMoving = moved;
}
let wasMoving = false;

// ───────── 누르기 / 끌기
const ray = new THREE.Raycaster();
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, yaw: cam.yawT, drag: false }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!down) return;
  const dx = e.clientX - down.x;
  if (!down.drag && Math.hypot(dx, e.clientY - down.y) > 7) { down.drag = true; canvas.classList.add('drag'); }
  if (down.drag) cam.yawT = down.yaw - dx * 0.006;
});
canvas.addEventListener('pointerup', (e) => {
  if (down && !down.drag) tapAt(e.clientX, e.clientY);
  down = null; canvas.classList.remove('drag');
});
function tapAt(cx, cy) {
  if (!myActor || !S) return;
  ray.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  const hit = ray.intersectObjects(S.group.children, true)[0];
  if (!hit) return;
  const ud = hit.object.userData;
  if (ud.seat) {
    const s = ud.seat;
    pendingSeat = s;
    moveTarget = { x: s.x + Math.sin(s.facing) * 0.75, z: s.z + Math.cos(s.facing) * 0.75 };
    if (blocked(moveTarget.x, moveTarget.z)) moveTarget = { x: s.x, z: s.z };
    return;
  }
  pendingSeat = null;
  if (ud.act) { say(myActor, ud.act, 'interact-right'); sendSay(ud.act, 'interact-right'); }
  const b = S.bounds;
  moveTarget = { x: Math.max(b.x0, Math.min(b.x1, hit.point.x)), z: Math.max(b.z0, Math.min(b.z1, hit.point.z)) };
}

// ───────── 실시간 중계(Supabase Realtime: 표 저장 없이 소식만 전달)
let sb = null, lobby = null, roomCh = null, online = false, lastSend = 0, trackTimer = 0;
const myState = () => ({ name: me.name, char: me.char, x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), sit: me.sit });

function lobbyCounts() {
  const counts = Object.fromEntries(SCENES.map((s) => [s.id, 0]));
  let total = 0;
  if (lobby && online) {
    for (const metas of Object.values(lobby.presenceState())) {
      const m = metas[0];
      if (m && counts[m.room] !== undefined) { counts[m.room]++; total++; }
    }
  }
  if (!online) { counts[me.room] = 1; total = 1; }
  return { counts, total };
}
function refreshCounts() {
  const { counts, total } = lobbyCounts();
  $('totalPill').textContent = `함께 쉬는 선생님 ${Math.max(1, total)}명`;
  for (const b of $('roomBar').children) b.querySelector('small').textContent = `${counts[b.dataset.id]} / ${ROOM_MAX}명`;
  $('myStatus').textContent = online ? `${Math.max(1, counts[me.room])} / ${ROOM_MAX}명 · 연결됨` : '혼자 둘러보는 중';
}

function connect() {
  try {
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 20 } } });
  } catch (e) { console.warn(e); refreshCounts(); return; }
  lobby = sb.channel(`${CH}-lobby`, { config: { presence: { key: me.id } } });
  lobby.on('presence', { event: 'sync' }, refreshCounts);
  lobby.subscribe(async (st) => {
    if (st === 'SUBSCRIBED') { online = true; await lobby.track({ room: me.room, name: me.name }); refreshCounts(); }
    else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { online = false; refreshCounts(); }
  });
  joinRoomChannel(me.room);
}
async function joinRoomChannel(room) {
  if (!sb) return;
  if (roomCh) { const old = roomCh; roomCh = null; await sb.removeChannel(old); }
  clearPeers();
  const ch = sb.channel(`${CH}-room-${room}`, { config: { presence: { key: me.id }, broadcast: { self: false } } });
  roomCh = ch;
  ch.on('presence', { event: 'sync' }, () => {
    if (roomCh !== ch) return;
    const st = ch.presenceState();
    for (const [id, metas] of Object.entries(st)) {
      if (id === me.id) continue;
      const m = metas[metas.length - 1];
      let a = people.get(id);
      if (!a) { a = makeActor(id, m); people.set(id, a); }
      else {
        a.t = { ...a.t, x: m.x, z: m.z, ry: m.ry, sit: m.sit, w: false };
        if (m.char && m.char !== a.char) { a.char = m.char; a.av.setChar(m.char); }
      }
    }
    for (const [id, a] of people) if (!st[id]) { removeActor(a); people.delete(id); }
  });
  ch.on('broadcast', { event: 'm' }, ({ payload: p }) => {
    const a = people.get(p.id);
    if (a) a.t = { x: p.x, z: p.z, ry: p.ry, sit: p.sit, w: p.w };
  });
  ch.on('broadcast', { event: 's' }, ({ payload: p }) => say(people.get(p.id), p.text, p.g));
  ch.on('broadcast', { event: 'a' }, ({ payload: p }) => { const a = people.get(p.id); if (a && p.char !== a.char) { a.char = p.char; a.av.setChar(p.char); } });
  ch.subscribe(async (st) => { if (st === 'SUBSCRIBED' && roomCh === ch) await ch.track(myState()); });
}
function sendMove(final) {
  if (!roomCh || !online) return;
  const now = performance.now();
  if (!final && now - lastSend < 120) return;
  lastSend = now;
  roomCh.send({ type: 'broadcast', event: 'm', payload: { id: me.id, ...myState(), w: !final } });
  if (final) { clearTimeout(trackTimer); trackTimer = setTimeout(() => roomCh && roomCh.track(myState()), 400); }
}
function sendSay(text, g) { if (roomCh && online) roomCh.send({ type: 'broadcast', event: 's', payload: { id: me.id, text, g } }); }

// ───────── 방 옮기기
const SPAWNS = { garden: { x: 2, z: 3 } };
function goRoom(id, first = false) {
  if (!first && id === me.room) return;
  const { counts } = lobbyCounts();
  if (!first && online && counts[id] >= ROOM_MAX) { toast('이 방은 가득 찼어요. 조금 뒤에 다시 와 주세요.'); return; }
  me.room = id;
  showScene(id);
  me.sit = null; moveTarget = null; pendingSeat = null;
  const sp = SPAWNS[id] || S.spawn;
  me.x = sp.x + (Math.random() - 0.5) * 2; me.z = sp.z + (Math.random() - 0.5) * 1.2; me.ry = cam.yawT;
  if (blocked(me.x, me.z)) { me.x = sp.x; me.z = sp.z; }
  if (myActor) { myActor.x = me.x; myActor.z = me.z; myActor.av.root.position.set(me.x, 0, me.z); }
  for (const b of $('roomBar').children) b.classList.toggle('on', b.dataset.id === id);
  if (cam.close) cam.focus.set(me.x, 0.8, me.z);
  if (!first) {
    joinRoomChannel(id);
    if (lobby && online) lobby.track({ room: id, name: me.name });
  }
  refreshCounts();
}
$('roomBar').innerHTML = SCENES.map((s) => `<button data-id="${s.id}"><i>${s.icon}</i><span><b>${s.label}</b><small>0 / ${ROOM_MAX}명</small></span></button>`).join('');
for (const b of $('roomBar').children) b.onclick = () => goRoom(b.dataset.id);

// ───────── 말하기
$('sayInput').addEventListener('input', () => ($('sayCount').textContent = `${$('sayInput').value.length}/12`));
$('sayForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('sayInput').value.trim().slice(0, 12);
  if (!text) return;
  say(myActor, text);
  sendSay(text);
  $('sayInput').value = '';
  $('sayCount').textContent = '0/12';
  $('sayInput').blur();
});

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 2600);
}

// ───────── 음악
$('musicBtn').onclick = () => { if (musicOn()) { stopMusic(); $('musicBtn').classList.add('off'); } else { startMusic(); $('musicBtn').classList.remove('off'); } };
$('vol').oninput = (e) => setVolume(+e.target.value);

// ───────── 처음 화면(앞치마 고르기)
let changing = false;
let thumbs = {};
function renderAprons() {
  $('aprons').innerHTML = CHARS.map((c) => `<button data-id="${c.id}" class="${c.id === me.char ? 'on' : ''}" title="캐릭터 고르기"><img src="models/thumbs/${c.id}.png" alt=""></button>`).join('');
  for (const b of $('aprons').children) b.onclick = () => { me.char = b.dataset.id; preload(me.char); renderAprons(); };
}
renderAprons();
preload(me.char);
$('apronBtn').onclick = () => {
  changing = true;
  $('goBtn').textContent = '이 캐릭터로 바꾸기';
  $('welcome').querySelector('.note').hidden = true;
  $('welcome').hidden = false;
};
$('goBtn').onclick = () => {
  $('welcome').hidden = true;
  if (changing) {
    myActor.av.setChar(me.char);
    if (roomCh && online) { roomCh.send({ type: 'broadcast', event: 'a', payload: { id: me.id, char: me.char } }); roomCh.track(myState()); }
    return;
  }
  me.name = randName();
  $('myName').textContent = me.name;
  document.querySelectorAll('.hud').forEach((el) => (el.hidden = false));
  goRoom('garden', true);
  myActor = makeActor(me.id, myState(), true);
  setClose(false);
  try { startMusic(); setVolume(+$('vol').value); } catch (e) { /* 음악이 막혀도 계속 */ }
  connect();
  setTimeout(() => toast(`오늘 이름은 「${me.name}」이에요 🌷`), 400);
};

// ───────── 매 순간 그리기
const tmp = new THREE.Vector3();
const clock = new THREE.Clock();
function placeLabel(a) {
  const h = a.sit ? 1.35 : 1.62;
  tmp.set(a.av.root.position.x, h, a.av.root.position.z).project(camera);
  const vis = tmp.z < 1;
  const sx = (tmp.x * 0.5 + 0.5) * innerWidth, sy = (-tmp.y * 0.5 + 0.5) * innerHeight;
  a.tag.style.display = vis ? '' : 'none';
  a.tag.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
  if (a.bubble) {
    a.bubble.style.display = vis ? '' : 'none';
    a.bubble.style.transform = `translate(${sx}px, ${sy - 30}px) translate(-50%, -100%)`;
  }
}
function updateActor(a, dt) {
  if (!a.isMe) {
    const k = 1 - Math.exp(-dt * 9);
    const t = a.t;
    const ox = a.x, oz = a.z;
    if (t.sit) { a.x = t.sit.x; a.z = t.sit.z; a.ry = t.sit.f; }
    else { a.x += (t.x - a.x) * k; a.z += (t.z - a.z) * k; let d = t.ry - a.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); a.ry += d * k; }
    a.sit = t.sit;
    a.walking = !t.sit && (Math.hypot(a.x - ox, a.z - oz) > 0.004 || (t.w && Math.hypot(t.x - a.x, t.z - a.z) > 0.05));
  }
  const p = a.av.root.position;
  // 앉기 동작은 엉덩이를 바닥 쪽으로 0.28 내리므로, 몸 전체를 의자 높이만큼 올려 엉덩이가 방석에 닿게 함
  if (a.sit) { p.set(a.sit.x + Math.sin(a.sit.f) * 0.08, a.sit.y + 0.2 - a.av.hipsY, a.sit.z + Math.cos(a.sit.f) * 0.08); a.av.root.rotation.y = a.sit.f; }
  else { p.set(a.x, 0, a.z); a.av.root.rotation.y = a.ry; }
  a.av.update(dt, a.walking, !!a.sit);
  if (a.bubble) { a.bubbleTimer -= dt; if (a.bubbleTimer <= 0) { a.bubble.remove(); a.bubble = null; } }
  placeLabel(a);
}
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (myActor) stepMe(dt); else cam.yawT += dt * 0.04;
  updateCamera(dt);
  if (myActor) updateActor(myActor, dt);
  for (const a of people.values()) updateActor(a, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

showScene('garden');
cam.dist = cam.distT;
cam.focus.copy(cam.focusT);
$('loadMsg').textContent = '방마다 최대 50명 · 캐릭터는 언제든 바꿀 수 있어요';
loop();

// 시험용(화면 확인할 때만 씀)
window.__todak = { me, people, goRoom, tapAt, cam, get myActor() { return myActor; }, get online() { return online; } };
