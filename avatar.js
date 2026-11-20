// 선생님 캐릭터 — VRoid 견본 애니 인형(VRoid 프로젝트, 누구나·상업용·수정 허용, 출처표시 불필요)
// 걷기·서 있기·앉기·끄덕이기는 몸의 뼈를 직접 움직여 만들고, 머리카락 흔들림·눈 깜빡임은 VRM 기능을 씁니다.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export const CHARS = [
  { id: 'e', file: 'e' },
  { id: 'g', file: 'g' },
  { id: 'shino', file: 'shino' },
  { id: 'd', file: 'd' },
  { id: 'fumiriya', file: 'fumiriya' },
];
const HEIGHT = 1.5;

const loader = new GLTFLoader();
loader.register((p) => new VRMLoaderPlugin(p));
const files = new Map();
const fileOf = (id) => (CHARS.find((c) => c.id === id) || CHARS[0]).file;
function getFile(id) {
  const f = fileOf(id);
  if (!files.has(f)) files.set(f, fetch(`models/vrm/${f}.vrm`).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }));
  return files.get(f);
}
async function loadVRM(id) {
  const buf = await getFile(id);
  const gltf = await loader.parseAsync(buf, '');
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.rotateVRM0(vrm); // 앞을 +z로
  vrm.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return vrm;
}
export const preload = (id) => getFile(id).catch(() => {});

const ease = (a, b, k) => a + (b - a) * k;

export function makeAvatar(charId) {
  const root = new THREE.Group();
  let vrm = null, bones = {}, hipsY = 0.8, wantId = charId, alive = true;
  let phase = Math.random() * 10, blinkT = 2 + Math.random() * 3, blink = 0;
  let nodT = 0, smileT = 0, talkT = 0, interactT = 0;
  const pose = { walk: 0, sit: 0 }; // 0~1 로 부드럽게 바뀜

  async function attach(id) {
    wantId = id;
    let v;
    try { v = await loadVRM(id); } catch (e) { console.warn('캐릭터 불러오기 실패', e); return; }
    if (!alive || wantId !== id) { VRMUtils.deepDispose(v.scene); return; }
    if (vrm) { root.remove(vrm.scene); VRMUtils.deepDispose(vrm.scene); }
    vrm = v;
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const s = HEIGHT / (box.max.y - box.min.y);
    vrm.scene.scale.setScalar(s);
    root.add(vrm.scene);
    const names = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm', 'leftHand', 'rightHand',
      'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot'];
    bones = {};
    for (const n of names) bones[n] = vrm.humanoid.getNormalizedBoneNode(n);
    root.updateMatrixWorld(true);
    const hp = new THREE.Vector3(); bones.hips.getWorldPosition(hp);
    hipsY = hp.y - root.getWorldPosition(new THREE.Vector3()).y;
    bones._hipsBase = bones.hips.position.y;
    vrm.springBoneManager?.reset();
  }
  attach(charId);

  function setExpr(name, v) { try { vrm.expressionManager?.setValue(name, v); } catch (e) { /* 없는 표정은 넘어감 */ } }

  function animate(dt, walking, sitting) {
    const B = bones;
    pose.walk = ease(pose.walk, walking ? 1 : 0, Math.min(1, dt * 8));
    pose.sit = ease(pose.sit, sitting ? 1 : 0, Math.min(1, dt * 7));
    const w = pose.walk * (1 - pose.sit), st = pose.sit;
    phase += dt * (walking ? 7.5 : 1.4);
    const sw = Math.sin(phase), cw = Math.cos(phase);
    const breathe = Math.sin(phase * (walking ? 0.2 : 1) * 1.1) * 0.025;

    // VRoid(VRM0) 뼈는 모델 안쪽 기준으로 앞이 -z 라서 앞뒤(x) 회전과 팔 내리기(z)의 부호가 반대
    const X = -1;
    // 다리
    const legSwing = 0.55 * w;
    B.leftUpperLeg.rotation.set(X * (-sw * legSwing - st * 1.55), 0, 0.02);
    B.rightUpperLeg.rotation.set(X * (sw * legSwing - st * 1.55), 0, -0.02);
    B.leftLowerLeg.rotation.set(X * (Math.max(0, sw) * 0.9 * w + st * 1.5), 0, 0);
    B.rightLowerLeg.rotation.set(X * (Math.max(0, -sw) * 0.9 * w + st * 1.5), 0, 0);
    if (B.leftFoot) B.leftFoot.rotation.x = X * -Math.max(0, sw) * 0.3 * w;
    if (B.rightFoot) B.rightFoot.rotation.x = X * -Math.max(0, -sw) * 0.3 * w;

    // 엉덩이 들썩임·몸 기울기
    B.hips.position.y = bones._hipsBase + Math.abs(cw) * 0.035 * w - 0.015 * w;
    B.hips.rotation.set(0, sw * 0.12 * w, sw * 0.03 * w);
    B.spine.rotation.set(X * (0.06 * w + breathe * 0.3 - st * 0.05), -sw * 0.1 * w, 0);
    if (B.chest) B.chest.rotation.set(X * breathe, 0, 0);

    // 팔: 내려 두고, 걸을 때 앞뒤로, 앉으면 무릎 위로
    const armDown = 1.2;
    const armSwing = 0.45 * w;
    const iw = interactT > 0 ? Math.sin(Math.min(1, interactT) * Math.PI) : 0;
    B.leftUpperArm.rotation.set(X * (sw * armSwing - st * 0.55), 0, armDown - 0.05 * Math.sin(phase * 0.7) * (1 - w));
    B.rightUpperArm.rotation.set(X * (-sw * armSwing - st * 0.55 - iw * 1.1), 0, -armDown + 0.05 * Math.sin(phase * 0.7) * (1 - w) + iw * 0.3);
    B.leftLowerArm.rotation.set(0, 0.25 + st * 0.9, 0);
    B.rightLowerArm.rotation.set(0, -0.25 - st * 0.9 - iw * 0.6, 0);

    // 고개: 가끔 둘러보기 + 끄덕이기
    const look = Math.sin(phase * 0.23) * 0.18 * (1 - w);
    const nod = nodT > 0 ? Math.sin((1 - nodT) * Math.PI * 4) * 0.22 * nodT : 0;
    B.head.rotation.set(X * (nod + 0.04), look, Math.sin(phase * 0.31) * 0.04);
    if (B.neck) B.neck.rotation.set(X * 0.03 * w, 0, 0);

    // 표정: 눈 깜빡임, 웃음, 말할 때 입
    blinkT -= dt;
    if (blinkT <= 0) { blink = 1; blinkT = 2.5 + Math.random() * 3.5; }
    blink = Math.max(0, blink - dt * 7);
    setExpr('blink', Math.sin(blink * Math.PI));
    setExpr('happy', smileT > 0 ? Math.min(1, smileT * 2) * 0.8 : 0.15);
    setExpr('aa', talkT > 0 ? (Math.sin(talkT * 22) * 0.5 + 0.5) * 0.6 : 0);
    nodT = Math.max(0, nodT - dt * 1.1);
    smileT = Math.max(0, smileT - dt);
    talkT = Math.max(0, talkT - dt);
    interactT = Math.max(0, interactT - dt * 0.9);
  }

  return {
    root,
    get hipsY() { return hipsY; },
    setChar(id) { attach(id); },
    gesture(name = 'emote-yes') {
      smileT = 2.5;
      if (name === 'interact-right') interactT = 1.2;
      else { nodT = 1; talkT = 1.1; }
    },
    update(dt, walking, sitting) {
      if (!vrm) return;
      animate(dt, walking, sitting);
      vrm.update(dt);
    },
    dispose() { alive = false; if (vrm) VRMUtils.deepDispose(vrm.scene); },
  };
}
