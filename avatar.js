// 선생님 캐릭터(작고 동글동글한 사람 모양)
import * as THREE from 'three';

export const APRONS = [
  { id: 'leaf',  name: '연두 앞치마', color: '#a9bf8e', mark: '🍃' },
  { id: 'pink',  name: '분홍 앞치마', color: '#e9a7b6', mark: '♡' },
  { id: 'sky',   name: '하늘 앞치마', color: '#86afc4', mark: '☁' },
  { id: 'sun',   name: '노랑 앞치마', color: '#efcf6b', mark: '✿' },
];
export const apronColor = (id) => (APRONS.find((a) => a.id === id) || APRONS[0]).color;

const HAIRS = ['#4a3426', '#2f2420', '#6b4a33', '#3b2b25'];
const std = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: false });

function cast(m) { m.castShadow = true; m.receiveShadow = false; return m; }

export function makeAvatar(apronId, seed = 0) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = std('#f3d3bb');
  const hair = std(HAIRS[Math.abs(seed) % HAIRS.length]);
  const apron = std(apronColor(apronId));
  const dress = std('#f6f1e6');
  const shoe = std('#7a6556');

  // 다리 (엉덩이 높이 0.36에서 돌아감)
  const legs = [];
  for (const sx of [-0.1, 0.1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.36, 0);
    const leg = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.32, 10), skin));
    leg.position.y = -0.17;
    const foot = cast(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.17), shoe));
    foot.position.set(0, -0.33, 0.03);
    pivot.add(leg, foot);
    body.add(pivot);
    legs.push(pivot);
  }
  // 원피스(안쪽) + 앞치마(겉)
  const skirt = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.33, 0.58, 14), dress));
  skirt.position.y = 0.64;
  body.add(skirt);
  const apronMesh = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.335, 0.5, 14, 1, true, -1.25, 2.5), apron));
  apronMesh.material.side = THREE.DoubleSide;
  apronMesh.position.y = 0.62;
  body.add(apronMesh);
  const bib = cast(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.03), apron));
  bib.position.set(0, 0.9, 0.17);
  body.add(bib);
  const pocket = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), std('#fffaf0'));
  pocket.position.set(0, 0.62, 0.3);
  pocket.rotation.x = -0.2;
  body.add(pocket);

  // 팔
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.21, 0.9, 0);
    const arm = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 4, 8), skin));
    arm.position.y = -0.15;
    pivot.rotation.z = sx * 0.18;
    pivot.add(arm);
    body.add(pivot);
    arms.push(pivot);
  }
  // 머리
  const head = new THREE.Group();
  head.position.y = 1.22;
  body.add(head);
  head.add(cast(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), skin)));
  const cap = cast(new THREE.Mesh(new THREE.SphereGeometry(0.318, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), hair));
  cap.rotation.x = -0.12;
  head.add(cap);
  const back = cast(new THREE.Mesh(new THREE.SphereGeometry(0.315, 20, 14, Math.PI, Math.PI, 0, Math.PI * 0.78), hair));
  head.add(back);
  const bun = cast(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), hair));
  bun.position.set(0, 0.24, -0.17);
  head.add(bun);
  const eyeM = std('#2a201c');
  for (const sx of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeM);
    eye.position.set(sx, -0.01, 0.275);
    eye.scale.set(1, 1.3, 0.6);
    head.add(eye);
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), new THREE.MeshBasicMaterial({ color: '#f2a9a2', transparent: true, opacity: 0.75 }));
    cheek.position.set(sx * 1.7, -0.08, 0.262);
    cheek.rotation.y = sx * 1.6;
    head.add(cheek);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), eyeM);
  smile.position.set(0, -0.08, 0.288);
  smile.rotation.z = Math.PI;
  head.add(smile);

  let phase = Math.random() * 6;
  return {
    root,
    setApron(id) { apron.color.set(apronColor(id)); },
    update(dt, walking, sitting) {
      if (sitting) {
        body.position.y = 0.06;
        legs.forEach((l) => (l.rotation.x = -1.45));
        arms.forEach((a) => (a.rotation.x = -0.5));
        head.rotation.z = Math.sin(phase * 0.6) * 0.04;
        phase += dt;
        return;
      }
      if (walking) {
        phase += dt * 9;
        const s = Math.sin(phase);
        legs[0].rotation.x = s * 0.6;
        legs[1].rotation.x = -s * 0.6;
        arms[0].rotation.x = -s * 0.55;
        arms[1].rotation.x = s * 0.55;
        body.position.y = Math.abs(Math.cos(phase)) * 0.05;
        head.rotation.z = 0;
      } else {
        phase += dt * 1.6;
        legs.forEach((l) => (l.rotation.x *= 0.8));
        arms.forEach((a) => (a.rotation.x *= 0.8));
        body.position.y = Math.sin(phase) * 0.012;
        head.rotation.z = Math.sin(phase * 0.5) * 0.03;
      }
    },
    dispose() {
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    },
  };
}

// 고르는 화면에 쓰는 앞치마 그림
export function apronSvg(color, mark) {
  return `<svg viewBox="0 0 46 62"><path d="M15 4 h16 v10 l9 44 a3 3 0 0 1-3 3 H9 a3 3 0 0 1-3-3 l9-44z" fill="${color}"/>
  <text x="23" y="40" text-anchor="middle" font-size="13" fill="#fff">${mark}</text></svg>`;
}
