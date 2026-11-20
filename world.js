// 마당과 방 4곳을 그리는 곳
import * as THREE from 'three';

const mats = new Map();
export function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts }));
  return mats.get(k);
}
function mesh(geo, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, opts) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w, h, d, c, x, y, z, o) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y, z, o);
const cyl = (rt, rb, h, c, x, y, z, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z);
const ball = (r, c, x, y, z, seg = 14) => mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), c, x, y, z);

function textTex(text, { w = 512, h = 128, bg = '#f7f2e4', fg = '#5b6b5e', size = 54, border = '#d9d1bb' } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = fg;
  g.font = `600 ${size}px "Pretendard Variable", Pretendard, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function sign(text, w, h, opts) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textTex(text, opts), roughness: 0.9 }));
  return m;
}
function plankTex(base = '#e2c79a', line = '#cdae7d') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,.06)' : 'rgba(120,80,30,.04)';
    g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = line; g.fillRect(0, i * 64, 512, 3);
    const off = (i * 157) % 512;
    g.fillRect(off, i * 64, 3, 64);
    g.fillRect((off + 256) % 512, i * 64, 3, 64);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ───────── 공통 구조
function makeScene(def) {
  return { group: new THREE.Group(), obstacles: [], seats: [], ...def };
}
function block(S, x, z, w, d) { S.obstacles.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); }
function round(S, x, z, r) { S.obstacles.push({ cx: x, cz: z, r }); }

// 앉을 수 있는 의자: facing = 앉은 사람이 바라보는 방향(라디안)
function chair(S, x, z, facing, color = '#c9b8a6', cushion = '#b9c7a8') {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  const wood = '#b8916a';
  for (const [lx, lz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) g.add(cyl(0.03, 0.03, 0.45, wood, lx, 0.225, lz, 8));
  g.add(box(0.56, 0.07, 0.56, color, 0, 0.47, 0));
  g.add(box(0.5, 0.06, 0.5, cushion, 0, 0.53, 0));
  g.add(box(0.56, 0.5, 0.07, color, 0, 0.78, -0.26));
  const seat = { x, z, facing, y: 0.5 };
  g.traverse((o) => (o.userData.seat = seat));
  S.seats.push(seat);
  S.group.add(g);
  return g;
}
function act(obj, text) { obj.traverse((o) => (o.userData.act = text)); return obj; }

function tree(S, x, z, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(cyl(0.16 * s, 0.24 * s, 1.8 * s, '#8a6446', 0, 0.9 * s, 0, 8));
  const leaf = ['#9dbb78', '#8fb06d', '#a8c487'];
  const blobs = [[0, 2.5, 0, 1.25], [0.75, 2.1, 0.3, 0.9], [-0.7, 2.2, -0.2, 0.95], [0.1, 3.2, -0.1, 0.85], [-0.3, 2.0, 0.65, 0.8]];
  blobs.forEach(([bx, by, bz, r], i) => {
    const m = mesh(new THREE.IcosahedronGeometry(r * s, 1), leaf[i % 3], bx * s, by * s, bz * s, { flatShading: true });
    g.add(m);
  });
  S.group.add(g);
  round(S, x, z, 0.45 * s);
}

// ───────── 햇살 텃밭 마당
export function buildGarden() {
  const S = makeScene({
    id: 'garden', title: '햇살 텃밭 마당', sub: '천천히 걸으며 숨을 골라 보세요.',
    bounds: { x0: -13.4, x1: 13.4, z0: -10.4, z1: 10.4 }, spawn: { x: 2, z: 3 }, dist: 31, center: new THREE.Vector3(0, 0, 0),
  });
  const G = S.group;
  const ground = box(29, 0.6, 23, '#bcd59b', 0, -0.3, 0);
  G.add(ground);
  G.add(box(29.4, 0.5, 23.4, '#9fbd80', 0, -0.62, 0));

  // 집
  const H = new THREE.Group();
  H.position.set(2, 0, -6.2);
  G.add(H);
  H.add(box(10.6, 0.35, 6.6, '#e6d6b8', 0, 0.17, 0));
  H.add(box(10, 3.2, 6, '#f1e7d2', 0, 1.95, 0));
  H.add(box(10.1, 0.25, 6.1, '#d9c7a3', 0, 0.45, 0));
  const roofM = '#d7957a';
  const r1 = box(11.2, 0.28, 4.3, roofM, 0, 4.55, 1.55); r1.rotation.x = 0.62; H.add(r1);
  const r2 = box(11.2, 0.28, 4.3, roofM, 0, 4.55, -1.55); r2.rotation.x = -0.62; H.add(r2);
  H.add(box(11.3, 0.2, 0.3, '#c27f66', 0, 5.83, 0));
  for (let i = -5; i <= 5; i++) { const l = box(0.04, 0.3, 4.2, '#c98670', i, 4.62, 1.57); l.rotation.x = 0.62; H.add(l); }
  const gable = new THREE.Shape(); gable.moveTo(-3, 0); gable.lineTo(3, 0); gable.lineTo(0, 2.3); gable.lineTo(-3, 0);
  for (const sx of [-5.001, 5.001]) {
    const gm = mesh(new THREE.ShapeGeometry(gable), '#efe3cb', sx, 3.55, 0);
    gm.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; gm.material.side = THREE.DoubleSide;
    H.add(gm);
  }
  // 문·창문·간판
  H.add(box(1.8, 2.4, 0.15, '#7d9e86', 0, 1.65, 3.02));
  H.add(box(0.06, 2.3, 0.18, '#5f7d68', 0, 1.65, 3.05));
  H.add(ball(0.06, '#e8c979', -0.25, 1.6, 3.12, 8)); H.add(ball(0.06, '#e8c979', 0.25, 1.6, 3.12, 8));
  H.add(box(2.4, 0.2, 1.2, '#e1d3b5', 0, 0.42, 3.6));
  const s1 = sign('토닥 쉼터', 2.6, 0.62); s1.position.set(0, 3.2, 3.02); H.add(s1);
  for (const wx of [-3.3, 3.3]) {
    H.add(box(2.2, 1.5, 0.12, '#cfe0de', wx, 2.0, 3.0, { roughness: 0.3 }));
    H.add(box(2.4, 0.12, 0.2, '#c8b28b', wx, 2.8, 3.04));
    H.add(box(2.4, 0.12, 0.2, '#c8b28b', wx, 1.2, 3.04));
    H.add(box(0.08, 1.5, 0.16, '#c8b28b', wx, 2.0, 3.06));
    H.add(box(2.3, 0.35, 0.45, '#a77c5a', wx, 1.05, 3.25));
    for (const px of [-0.7, 0, 0.7]) H.add(ball(0.24, '#8fae6f', wx + px, 1.42, 3.25, 10));
  }
  block(S, 2, -6.2, 10.8, 6.8);

  // 돌길
  const stone = mat('#e8dfcd');
  const pathPts = [[2, -2.2], [2.3, -1], [1.8, 0.4], [2.2, 1.8], [1.7, 3.2], [2.1, 4.6], [1.6, 6], [2, 7.4], [1.7, 8.8], [3.4, 1], [4.8, 1.4], [6.2, 1.1], [0.4, 2.6], [-1, 2.3]];
  pathPts.forEach(([x, z], i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55 + (i % 3) * 0.08, 0.6, 0.08, 9), stone);
    m.position.set(x, 0.04, z); m.rotation.y = i; m.scale.z = 0.75; m.receiveShadow = true;
    G.add(m);
  });
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 13), mat('#e2d6bc'));
  dirt.rotation.x = -Math.PI / 2; dirt.position.set(2, 0.01, 3.4); dirt.receiveShadow = true;
  G.add(dirt);

  // 텃밭 3줄
  const crops = [
    (g, x, z) => { g.add(cyl(0.02, 0.02, 0.5, '#6f9a52', x, 0.55, z, 5)); g.add(ball(0.12, '#e0644f', x + 0.08, 0.6, z, 8)); g.add(ball(0.1, '#e57a5b', x - 0.08, 0.72, z, 8)); g.add(ball(0.16, '#7aa45a', x, 0.85, z, 7)); },
    (g, x, z) => { g.add(ball(0.26, '#a6cc7d', x, 0.5, z, 9)); g.add(ball(0.18, '#c6e29c', x, 0.6, z, 8)); },
    (g, x, z) => { const c = cyl(0.07, 0.0, 0.22, '#ee9447', x, 0.42, z, 6); c.rotation.x = Math.PI; g.add(c); for (let k = 0; k < 3; k++) { const l = cyl(0.01, 0.03, 0.35, '#5f9748', x + (k - 1) * 0.05, 0.7, z, 4); l.rotation.z = (k - 1) * 0.35; g.add(l); } },
  ];
  [-9.6, -7.2, -4.8].forEach((bx, i) => {
    G.add(box(2, 0.4, 5, '#a47b57', bx, 0.2, 2.4));
    G.add(box(1.8, 0.1, 4.8, '#6e4f39', bx, 0.38, 2.4));
    const tag = sign(['토마토', '양배추', '당근'][i], 0.9, 0.3, { size: 60 }); tag.position.set(bx, 0.3, 4.92); G.add(tag);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) crops[i](G, bx - 0.45 + c * 0.9, 0.7 + r * 1.15);
    block(S, bx, 2.4, 2, 5);
  });
  const can = new THREE.Group();
  can.position.set(-3.2, 0, 5.6);
  can.add(cyl(0.22, 0.25, 0.42, '#86a8a8', 0, 0.21, 0, 14));
  const spout = cyl(0.03, 0.05, 0.45, '#86a8a8', 0.3, 0.38, 0, 8); spout.rotation.z = -0.9; can.add(spout);
  const handle = mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 12, Math.PI), '#7698a0', 0, 0.45, 0); can.add(handle);
  act(can, '💧 물 주는 중'); G.add(can);

  // 벤치
  const bench = new THREE.Group();
  bench.position.set(7.4, 0, 5.2); bench.rotation.y = -0.5;
  for (const lx of [-0.8, 0.8]) { bench.add(box(0.08, 0.45, 0.5, '#4f6f5b', lx, 0.23, 0)); bench.add(box(0.08, 0.6, 0.08, '#4f6f5b', lx, 0.7, -0.24)); }
  for (let i = 0; i < 3; i++) bench.add(box(2, 0.06, 0.15, '#c99b67', 0, 0.48, -0.17 + i * 0.17));
  for (let i = 0; i < 2; i++) bench.add(box(2, 0.12, 0.05, '#c99b67', 0, 0.75 + i * 0.2, -0.27));
  G.add(bench);
  for (const off of [-0.5, 0.5]) {
    const seat = { x: 7.4 + Math.cos(-0.5) * off, z: 5.2 - Math.sin(-0.5) * off, facing: -0.5, y: 0.5 };
    bench.traverse((o) => { if (!o.userData.seat || Math.abs(off) > 0) o.userData.seat = o.userData.seat || seat; });
    S.seats.push(seat);
  }
  bench.traverse((o) => (o.userData.seat = S.seats[S.seats.length - 2]));

  // 나무·울타리·꽃
  [[-11.5, -8.2, 1.15], [-12, 6.8, 1], [10.8, -7.5, 1.2], [12, 8.5, 1.05], [-6, -9.2, 0.95], [9.2, 9.4, 0.85]].forEach(([x, z, s]) => tree(S, x, z, s));
  const post = mat('#efe9dc');
  const addFence = (x0, z0, x1, z1) => {
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.2);
    for (let i = 0; i <= n; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), post);
      p.position.set(x0 + ((x1 - x0) * i) / n, 0.4, z0 + ((z1 - z0) * i) / n); p.castShadow = true; G.add(p);
    }
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (const y of [0.35, 0.62]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.05), post);
      rail.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0); G.add(rail);
    }
  };
  addFence(-14, -11, 14, -11); addFence(-14, -11, -14, 11); addFence(14, -11, 14, 11);
  const flowerCols = ['#f4b6c2', '#ffffff', '#f6d77a', '#c9b6ea'];
  for (let i = 0; i < 70; i++) {
    const x = -13 + ((i * 7.31) % 26), z = -10 + ((i * 4.77) % 20);
    if (S.obstacles.some((o) => o.x0 !== undefined && x > o.x0 - 0.3 && x < o.x1 + 0.3 && z > o.z0 - 0.3 && z < o.z1 + 0.3)) continue;
    if (Math.abs(x - 2) < 1.6 && z > -2.5) continue;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mat(flowerCols[i % 4]));
    f.position.set(x, 0.1, z); G.add(f);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 4), mat('#7ea35c')); st.position.set(x, 0.05, z); G.add(st);
  }
  return S;
}

// ───────── 방 공통 (뒤쪽 벽 + 왼쪽 벽 + 나무 바닥)
function roomBase(def, wall = '#f0eadb', trim = '#a9b99a') {
  const S = makeScene({ bounds: { x0: -8.5, x1: 8.6, z0: -6.4, z1: 6.6 }, spawn: { x: 0, z: 5.2 }, dist: 22, center: new THREE.Vector3(0, 0, 0.2), ...def });
  const G = S.group;
  const tex = plankTex();
  tex.repeat.set(3, 2.4);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 14), [mat('#d4b483'), mat('#d4b483'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), mat('#d4b483'), mat('#d4b483'), mat('#d4b483')]);
  floor.position.set(0, -0.2, 0); floor.receiveShadow = true;
  G.add(floor);
  G.add(box(18.4, 0.3, 14.4, '#c9a676', 0, -0.5, 0));
  G.add(box(18, 3.4, 0.3, wall, 0, 1.7, -7.15));
  G.add(box(0.3, 3.4, 14, wall, -9.15, 1.7, 0));
  G.add(box(18, 0.35, 0.36, trim, 0, 0.17, -7));
  G.add(box(0.36, 0.35, 14, trim, -9, 0.17, 0));
  G.add(box(18.2, 0.15, 0.5, '#e2d7bf', 0, 3.45, -7.15));
  G.add(box(0.5, 0.15, 14.2, '#e2d7bf', -9.15, 3.45, 0));
  return S;
}
function windowOn(G, x, z, rotY = 0, w = 2.4) {
  const g = new THREE.Group(); g.position.set(x, 1.9, z); g.rotation.y = rotY;
  g.add(box(w, 1.5, 0.08, '#cfe2df', 0, 0, 0, { roughness: 0.25 }));
  g.add(box(w + 0.2, 0.12, 0.16, '#c4ab83', 0, 0.78, 0.02)); g.add(box(w + 0.2, 0.12, 0.2, '#c4ab83', 0, -0.78, 0.04));
  g.add(box(0.1, 1.5, 0.14, '#c4ab83', 0, 0, 0.02));
  for (const sx of [-1, 1]) g.add(box(0.35, 1.9, 0.08, '#a9bf98', sx * (w / 2 + 0.25), 0, 0.12));
  G.add(g);
}
function plant(G, S, x, z, s = 1) {
  G.add(cyl(0.28 * s, 0.22 * s, 0.5 * s, '#c98b66', x, 0.25 * s, z, 12));
  for (let i = 0; i < 6; i++) {
    const l = mesh(new THREE.SphereGeometry(0.28 * s, 8, 6), '#6f9b5a', x + Math.cos(i) * 0.22 * s, (0.75 + (i % 3) * 0.22) * s, z + Math.sin(i) * 0.22 * s, { flatShading: true });
    l.scale.set(0.6, 1.3, 0.6); l.rotation.z = Math.cos(i) * 0.5; G.add(l);
  }
  round(S, x, z, 0.35 * s);
}
function shelf(G, S, x, z, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  g.add(box(1.8, 2.1, 0.45, '#c9a27a', 0, 1.05, 0));
  const bookCols = ['#e8a5a5', '#a6c1d9', '#efd58a', '#9fc29a', '#c9b3e0', '#f2c39b'];
  for (let r = 0; r < 3; r++) {
    g.add(box(1.7, 0.05, 0.42, '#b48b62', 0, 0.35 + r * 0.62, 0.02));
    for (let b = 0; b < 9; b++) g.add(box(0.14, 0.42 + (b % 3) * 0.05, 0.3, bookCols[(b + r) % 6], -0.7 + b * 0.17, 0.6 + r * 0.62 + (b % 3) * 0.025, 0.05));
  }
  G.add(g);
}

// ───────── 수다방
export function buildChat() {
  const S = roomBase({ id: 'chat', title: '마음 나누는 수다방', sub: '동그랗게 앉아 짧은 말로 마음을 나눠요.' });
  const G = S.group;
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.04, 40), mat('#cfdbc2')); rug.position.set(0, 0.02, 0.4); rug.receiveShadow = true; G.add(rug);
  const rug2 = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 0.045, 40), mat('#dbe5cf')); rug2.position.set(0, 0.025, 0.4); G.add(rug2);
  G.add(cyl(1.25, 1.25, 0.12, '#ead6b4', 0, 0.75, 0.4, 32)); G.add(cyl(0.15, 0.3, 0.7, '#c9a27a', 0, 0.35, 0.4, 12));
  round(S, 0, 0.4, 1.35);
  G.add(cyl(0.08, 0.07, 0.16, '#fff', 0.35, 0.89, 0.2, 10)); G.add(cyl(0.08, 0.07, 0.16, '#a7c4b5', -0.4, 0.89, 0.6, 10));
  const plate = cyl(0.3, 0.26, 0.04, '#ffffff', 0, 0.83, 0.75, 18); G.add(plate);
  for (let i = 0; i < 5; i++) G.add(ball(0.08, '#d9a35e', Math.cos(i * 1.3) * 0.13, 0.88, 0.75 + Math.sin(i * 1.3) * 0.13, 8));
  act(plate, '🍪 쿠키 하나 집었어요');
  const cols = [['#c9b8a6', '#d9b7c1'], ['#b8c4ad', '#a9bf98'], ['#c9b8a6', '#b9c7a8']];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const x = Math.sin(a) * 2.4, z = 0.4 + Math.cos(a) * 2.4;
    chair(S, x, z, a + Math.PI, ...cols[i % 3]);
  }
  windowOn(G, 4.5, -6.98);
  windowOn(G, -8.98, 0.5, Math.PI / 2);
  shelf(G, S, -5.5, -6.6); block(S, -5.5, -6.6, 1.8, 0.6);
  plant(G, S, -8.1, -6.1, 1.2); plant(G, S, 7.9, -6.1, 1.1);
  const board = sign('오늘 하루 어땠어요?', 3.4, 0.8, { size: 46 }); board.position.set(0.3, 2.3, -6.98); G.add(board);
  // 소파
  const sofa = new THREE.Group(); sofa.position.set(0.3, 0, -5.9);
  sofa.add(box(3.4, 0.45, 1, '#a9bf98', 0, 0.3, 0)); sofa.add(box(3.4, 0.7, 0.3, '#a9bf98', 0, 0.75, -0.38));
  sofa.add(box(0.3, 0.6, 1, '#9cb38b', -1.75, 0.45, 0)); sofa.add(box(0.3, 0.6, 1, '#9cb38b', 1.75, 0.45, 0));
  G.add(sofa);
  for (const sx of [-0.9, 0.9]) { const seat = { x: 0.3 + sx, z: -5.75, facing: 0, y: 0.5 }; S.seats.push(seat); }
  sofa.traverse((o) => (o.userData.seat = S.seats[S.seats.length - 1]));
  block(S, 0.3, -5.9, 3.8, 1.1);
  return S;
}

// ───────── 서류업무방
export function buildDesk() {
  const S = roomBase({ id: 'desk', title: '조용한 서류방', sub: '밀린 일지도 함께하면 덜 외로워요.' }, '#eef0e8', '#a7b8c4');
  const G = S.group;
  const desks = [[-4.5, -2.6], [0, -2.6], [4.5, -2.6], [-4.5, 1.6], [0, 1.6], [4.5, 1.6]];
  desks.forEach(([x, z], i) => {
    G.add(box(2.6, 0.08, 1.2, '#e3cfac', x, 0.78, z));
    for (const [lx, lz] of [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]]) G.add(box(0.07, 0.76, 0.07, '#b9a07c', x + lx, 0.38, z + lz));
    const lap = new THREE.Group(); lap.position.set(x - 0.3, 0.83, z - 0.1);
    lap.add(box(0.8, 0.04, 0.55, '#c9ced3', 0, 0, 0));
    const scr = box(0.8, 0.52, 0.03, '#b7bec6', 0, 0.27, -0.27); scr.rotation.x = -0.18; lap.add(scr);
    const glow = box(0.72, 0.44, 0.01, '#dcebf0', 0, 0.27, -0.25, { emissive: '#bfe0e8', emissiveIntensity: 0.25 }); glow.rotation.x = -0.18; lap.add(glow);
    act(lap, '⌨️ 일지 쓰는 중'); G.add(lap);
    const papers = box(0.45, 0.06, 0.6, '#ffffff', x + 0.75, 0.85, z + 0.05); act(papers, '📄 서류 정리 중'); G.add(papers);
    G.add(cyl(0.06, 0.05, 0.14, ['#e9a7b6', '#86afc4', '#efcf6b'][i % 3], x + 0.95, 0.89, z - 0.35, 10));
    block(S, x, z, 2.7, 1.25);
    chair(S, x, z + 1.05, Math.PI, '#b9c4cc', '#d4dde3');
  });
  shelf(G, S, -6.8, -6.6); shelf(G, S, -4.8, -6.6); block(S, -5.8, -6.6, 4, 0.6);
  windowOn(G, 3.5, -6.98, 0, 3);
  windowOn(G, -8.98, 2.5, Math.PI / 2);
  const clock = cyl(0.45, 0.45, 0.08, '#ffffff', -1.2, 2.5, -6.95, 24); clock.rotation.x = Math.PI / 2; G.add(clock);
  const h1 = box(0.04, 0.3, 0.02, '#333', -1.2, 2.6, -6.89); G.add(h1); const h2 = box(0.04, 0.22, 0.02, '#333', -1.12, 2.5, -6.89); h2.rotation.z = -1.2; G.add(h2);
  const s = sign('천천히, 하나씩', 2.6, 0.6, { size: 48 }); s.position.set(-1.2, 1.6, -6.98); G.add(s);
  plant(G, S, 8, -6.1, 1.1); plant(G, S, -8.1, 5.8, 1);
  const water = new THREE.Group(); water.position.set(7.8, 0, 3.8);
  water.add(box(0.6, 1.1, 0.6, '#e9edf0', 0, 0.55, 0)); water.add(cyl(0.25, 0.25, 0.6, '#bcdfee', 0, 1.4, 0, 14));
  act(water, '🥤 물 한 잔 마셨어요'); G.add(water); block(S, 7.8, 3.8, 0.7, 0.7);
  return S;
}

// ───────── 교구제작방
export function buildCraft() {
  const S = roomBase({ id: 'craft', title: '알록달록 교구 만들기방', sub: '자르고 붙이며 내일 놀이를 준비해요.' }, '#f3ece0', '#e0b5a3');
  const G = S.group;
  const tables = [[-3.2, -0.6], [3.2, -0.6]];
  const paperCols = ['#f4a6a6', '#a6d0f4', '#f8e08a', '#b5e0a7', '#d7b8f0', '#ffc796'];
  tables.forEach(([x, z], t) => {
    G.add(box(4, 0.1, 2.2, '#f2e3c6', x, 0.78, z));
    for (const [lx, lz] of [[-1.85, -0.95], [1.85, -0.95], [-1.85, 0.95], [1.85, 0.95]]) G.add(box(0.1, 0.76, 0.1, '#c9a27a', x + lx, 0.38, z + lz));
    for (let i = 0; i < 6; i++) {
      const p = box(0.45, 0.012, 0.45, paperCols[(i + t) % 6], x - 1.4 + i * 0.55, 0.84, z - 0.4 + (i % 2) * 0.35);
      p.rotation.y = i * 0.4; G.add(p);
    }
    const sc = new THREE.Group(); sc.position.set(x + 0.9, 0.86, z + 0.45);
    for (const s of [-1, 1]) { const b = box(0.04, 0.02, 0.4, '#b9c0c6', 0, 0, 0); b.rotation.y = s * 0.3; sc.add(b); const r = mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), '#e0645a', s * 0.08, 0, 0.25); r.rotation.x = Math.PI / 2; sc.add(r); }
    act(sc, '✂️ 오리는 중'); G.add(sc);
    const cup = new THREE.Group(); cup.position.set(x - 1.2, 0.83, z + 0.55);
    cup.add(cyl(0.14, 0.12, 0.25, '#86afc4', 0, 0.12, 0, 12));
    for (let i = 0; i < 5; i++) { const c = cyl(0.02, 0.02, 0.35, paperCols[i], Math.cos(i) * 0.06, 0.32, Math.sin(i) * 0.06, 6); c.rotation.z = Math.cos(i) * 0.15; cup.add(c); }
    act(cup, '🖍️ 색칠하는 중'); G.add(cup);
    const glue = cyl(0.07, 0.07, 0.22, '#f5f0e2', x + 0.2, 0.94, z + 0.6, 10); act(glue, '🧴 풀칠하는 중'); G.add(glue);
    block(S, x, z, 4.1, 2.3);
    chair(S, x - 1.2, z - 1.4, 0, '#e0c3b0', '#f2d7c8'); chair(S, x + 1.2, z - 1.4, 0, '#e0c3b0', '#f2d7c8');
    chair(S, x - 1.2, z + 1.4, Math.PI, '#e0c3b0', '#f2d7c8'); chair(S, x + 1.2, z + 1.4, Math.PI, '#e0c3b0', '#f2d7c8');
  });
  // 바구니 선반
  const rack = new THREE.Group(); rack.position.set(-5.6, 0, -6.6);
  rack.add(box(3.2, 1.6, 0.6, '#d8b98f', 0, 0.8, 0));
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) rack.add(box(0.65, 0.45, 0.5, paperCols[(r * 4 + c) % 6], -1.15 + c * 0.77, 0.4 + r * 0.75, 0.08));
  act(rack, '🧺 재료 찾는 중'); G.add(rack); block(S, -5.6, -6.6, 3.2, 0.7);
  // 벽에 붙인 아이들 그림
  for (let i = 0; i < 5; i++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#fffdf6'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = paperCols[i]; g.beginPath(); g.arc(64, 58, 30, 0, 7); g.fill();
    g.strokeStyle = '#7ba35b'; g.lineWidth = 6; g.beginPath(); g.moveTo(64, 88); g.lineTo(64, 118); g.stroke();
    if (i % 2) { g.fillStyle = '#f6c54a'; g.beginPath(); g.arc(104, 22, 14, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ map: t }));
    p.position.set(0.5 + i * 1.3, 2.2 + (i % 2) * 0.25, -6.98); p.rotation.z = (i % 3 - 1) * 0.06; G.add(p);
  }
  const s = sign('내일 놀이, 오늘 준비', 3, 0.6, { size: 44 }); s.position.set(3.1, 1.25, -6.98); G.add(s);
  windowOn(G, -8.98, 0.5, Math.PI / 2, 3);
  plant(G, S, 8, -6.1, 1.1); plant(G, S, 8, 5.8, 0.9);
  return S;
}

// ───────── 간식방
export function buildSnack() {
  const S = roomBase({ id: 'snack', title: '따뜻한 간식방', sub: '차 한 잔, 쿠키 한 조각의 여유.' }, '#f5ecdc', '#d6b98c');
  const G = S.group;
  // 부엌 조리대
  G.add(box(8, 1, 0.9, '#f1e8d6', -3.6, 0.5, -6.5)); G.add(box(8.1, 0.08, 1, '#d9c3a0', -3.6, 1.04, -6.5));
  for (let i = 0; i < 5; i++) G.add(box(1.5, 0.8, 0.02, '#e9dcc3', -6.8 + i * 1.6, 0.5, -6.04));
  const mach = new THREE.Group(); mach.position.set(-6, 1.08, -6.55);
  mach.add(box(0.6, 0.7, 0.5, '#5e6b63', 0, 0.35, 0)); mach.add(box(0.3, 0.06, 0.25, '#9aa59e', 0, 0.12, 0.2)); mach.add(cyl(0.07, 0.06, 0.12, '#fff', 0, 0.2, 0.2, 10));
  act(mach, '☕ 커피 내리는 중'); G.add(mach);
  const kettle = new THREE.Group(); kettle.position.set(-4, 1.08, -6.5);
  kettle.add(ball(0.22, '#e7a37e', 0, 0.2, 0, 14)); kettle.add(cyl(0.05, 0.05, 0.08, '#c98261', 0, 0.42, 0, 8));
  act(kettle, '🍵 차 우리는 중'); G.add(kettle);
  const jar = new THREE.Group(); jar.position.set(-2.2, 1.08, -6.5);
  jar.add(cyl(0.2, 0.2, 0.4, '#e7f0ee', 0, 0.2, 0, 14)); for (let i = 0; i < 4; i++) jar.add(ball(0.07, '#c98a4f', Math.cos(i * 1.6) * 0.09, 0.12 + i * 0.07, Math.sin(i * 1.6) * 0.09, 8));
  act(jar, '🍪 쿠키 꺼내는 중'); G.add(jar);
  G.add(box(3, 0.06, 0.4, '#d9c3a0', -3.6, 2.4, -6.85)); for (let i = 0; i < 6; i++) G.add(cyl(0.1, 0.08, 0.2, ['#fff', '#e9a7b6', '#86afc4'][i % 3], -4.6 + i * 0.4, 2.53, -6.85, 10));
  block(S, -3.6, -6.5, 8.1, 1.1);
  windowOn(G, 4.6, -6.98, 0, 3);
  // 식탁 2개
  [[-2.5, 0.6], [3.5, 0.6]].forEach(([x, z], t) => {
    G.add(cyl(1.05, 1.05, 0.08, '#e9d4b0', x, 0.76, z, 28)); G.add(cyl(0.1, 0.35, 0.74, '#c9a27a', x, 0.37, z, 10));
    const fruit = new THREE.Group(); fruit.position.set(x, 0.8, z);
    fruit.add(cyl(0.32, 0.22, 0.12, '#ffffff', 0, 0.06, 0, 16));
    [['#e85f55', 0.1, 0], ['#f0a33c', -0.1, 0.05], ['#9fc35a', 0, -0.12]].forEach(([c, fx, fz]) => fruit.add(ball(0.1, c, fx, 0.18, fz, 10)));
    act(fruit, t ? '🍊 귤 까는 중' : '🍎 사과 한 입'); G.add(fruit);
    G.add(cyl(0.07, 0.06, 0.14, '#fff', x + 0.55, 0.87, z + 0.2, 10)); G.add(cyl(0.07, 0.06, 0.14, '#a7c4b5', x - 0.5, 0.87, z - 0.3, 10));
    round(S, x, z, 1.15);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; chair(S, x + Math.sin(a) * 1.75, z + Math.cos(a) * 1.75, a + Math.PI, '#d6b98c', '#f0d9b5'); }
  });
  // 창가 푹신 의자
  const nook = new THREE.Group(); nook.position.set(-7.6, 0, 3.6); nook.rotation.y = Math.PI / 2;
  nook.add(box(3, 0.45, 1.1, '#e7b9a3', 0, 0.3, 0)); nook.add(box(3, 0.7, 0.3, '#e7b9a3', 0, 0.75, -0.42));
  for (const px of [-0.9, 0.9]) nook.add(box(0.7, 0.5, 0.18, '#f3d9c6', px, 0.85, -0.25));
  G.add(nook);
  for (const sz of [2.8, 4.4]) S.seats.push({ x: -7.45, z: sz, facing: Math.PI / 2, y: 0.5 });
  nook.traverse((o) => (o.userData.seat = S.seats[S.seats.length - 1]));
  block(S, -7.6, 3.6, 1.2, 3.1);
  windowOn(G, -8.98, 3.6, Math.PI / 2, 2.6);
  plant(G, S, 8, -6.1, 1.2); plant(G, S, 8, 5.8, 1);
  return S;
}

export const SCENES = [
  { id: 'garden', icon: '🌱', label: '텃밭 · 마당', build: buildGarden },
  { id: 'desk', icon: '💻', label: '서류방', build: buildDesk },
  { id: 'chat', icon: '💬', label: '수다방', build: buildChat },
  { id: 'craft', icon: '✂️', label: '교구 만들기', build: buildCraft },
  { id: 'snack', icon: '☕', label: '간식방', build: buildSnack },
];
