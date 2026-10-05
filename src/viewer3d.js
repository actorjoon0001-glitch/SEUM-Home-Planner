// 세움 홈플래너 - 3D 뷰어 (Three.js)
// 2D 도면을 실시간 3D로 변환. 고객 상담 시 회전/줌으로 공간을 보여줍니다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { store } from './store.js';
import { ROOM_TYPES, catalogOf, ATTIC_HEIGHT, EXTERIOR_MATERIALS, ROOF_TYPES, WINDOW_TYPES, outlineShapes, OPEN_ROOM_TYPES, model3dSig } from './data.js';
import { rotateRoomsInDesign, moveRoomsInDesign, syncOutlineToRooms } from './roomops.js';
import * as TEX from './textures.js';
TEX._useThree(THREE);   // textures.js 의 3D 재질 함수가 쓸 three 주입 (2D UI 는 three 의존 제거됨)

const WALL_T = 100; // 벽 두께 mm
const SKY_TOP = '#a9c6e3', SKY_HORIZON = '#e8eef3';   // 하늘 그라데이션 (지평선색 = 안개색)
const HQ_KEY = 'seum_3d_hq';                          // 고화질(구석 음영) 사용 여부 저장
// 실물 모델(GLB) 압축 해제기 위치 — importmap 의 three 와 같은 곳에서 가져옴
const DRACO_PATH = (() => {
  try { return import.meta.resolve('three/addons/libs/draco/gltf/'); }
  catch (e) { return 'https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/'; }
})();

export class Viewer3D {
  constructor(container) {
    this.container = container;
    this.active = false;
    this.dirty = true;

    this.scene = new THREE.Scene();
    this.scene.background = this._skyTexture();

    this.camera = new THREE.PerspectiveCamera(50, 1, 100, 400000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 톤매핑 — 밋밋한 회색 느낌 대신 자연스럽고 화사한 실내 톤
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // 환경광(반사) — 실내 스튜디오 조명을 미리 구워 모든 재질에 반사·간접광으로 입힘.
    //   금속 사이딩·유리·창틀이 단색 플라스틱이 아니라 실제 자재처럼 빛을 받게 됨.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    pmrem.dispose();

    // 고화질 모드: 구석 음영(GTAO) 후처리. 느린 기기에선 자동으로 꺼짐
    this.hq = true;
    try { this.hq = localStorage.getItem(HQ_KEY) !== '0'; } catch { /* noop */ }
    this._setupComposer();

    // 필요할 때만 그리기 — 카메라/도면이 바뀔 때만 렌더해 GPU·배터리 절약
    this._needsRender = true;
    this._lastRender = 0;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener('change', () => { this._needsRender = true; });
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    // 휠 줌: 기본 OrbitControls 줌은 마우스/트랙패드의 deltaY 크기에 비례해
    //   기기에 따라 한 번에 확 튀어(사이즈가 2단계처럼 보임). 직접 처리해
    //   방향만 보고 한 틱당 고정 비율(8%)로 조금씩 당기고 밀어 2D처럼 세밀하게.
    this.controls.enableZoom = false;

    // WebGL 컨텍스트 손실(반복 탭 전환/GPU 상황) → 흰 화면 방지: 복구 시 재빌드
    const cv = this.renderer.domElement;
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, false);
    cv.addEventListener('webglcontextrestored', () => { this.dirty = true; this._appliedW = 0; this._resize(); }, false);

    this._lights();

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    this.showRoof = false;
    this.showExterior = false;
    this.showModel3d = true;    // 도면에 실물 모델(블렌더 GLB)이 있으면 자동 생성 모델 대신 표시
    // ☀️ 햇빛·시간 — 한국(위도 37.5°) 실제 해 위치. 집 방위는 design.northDeg(도면 위쪽 기준 북쪽 각도, 시계방향)
    this.sunHour = 14;          // 시각(태양시) 4~23
    this.season = 'equinox';    // 'summer'(하지) | 'equinox'(봄·가을) | 'winter'(동지)
    this.onDaylight = null;     // (state) => UI 갱신
    this.onModel3dState = null; // (state) => UI 버튼 갱신 — { available, using, loading, failed, mismatch }
    this.wallOpacity = 1;       // 3D 벽 투명도 (1=불투명) — 내부 들여다보기
    this.floorOpacity = 1;      // 3D 바닥 투명도 (1=불투명)

    // 3D 직접 편집 (방 선택·이동·크기조절·회전)
    this.editMode = false;
    this.selRooms = new Set();   // Shift+클릭 다중 선택(건물 통째 이동/회전)
    // 면별 외장재 — 벽 면을 클릭해 재질 칠하기
    this.faceMode = false;
    this.faceBrush = null;   // { material, color } 또는 { material:null }(=기본으로 되돌림)
    this._faceDrag = null;   // 면 위 드래그 상태 { key, u0, u1 }
    this._selBand = null;    // 선택된 색 띠 { key, idx } (클릭해 폭 조절)
    this._bandDrag = null;   // 띠 가장자리 드래그 { key, idx, edge }
    this._raycaster = new THREE.Raycaster();
    this._edrag = null;
    this._gesture = null;   // 클릭↔드래그 판정 상태 (집 선택 vs 화면 회전)
    cv.addEventListener('pointerdown', (e) => this._edDown(e));
    cv.addEventListener('pointermove', (e) => this._edMove(e));
    window.addEventListener('pointerup', () => this._edUp());
    cv.addEventListener('wheel', (e) => this._wheelZoom(e), { passive: false });
    // 라이브러리(제품·창호·방) 카드를 3D 화면에 끌어다 놓기 — 떨어뜨린 바닥 지점에 배치 (실제 배치는 2D 편집기 로직 공유)
    cv.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
    cv.addEventListener('drop', (e) => {
      e.preventDefault();
      const raw = e.dataTransfer && e.dataTransfer.getData('text/plain');
      const g = raw && this._groundHit(e);
      if (g && this.onDropAt) this.onDropAt(raw, g.x, g.y);
    });

    store.subscribe(() => { this.dirty = true; });
    window.addEventListener('resize', () => this._resize());
    // 컨테이너 크기 변화를 직접 감지해 캔버스를 맞춤 (3D 탭 표시/창 크기 변화 등)
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this.container);
    }
    this._buildCompass();
    this._animate();
  }

  _lights() {
    // 하늘빛/잔디 반사광 — 환경광(RoomEnvironment)이 간접광을 대부분 맡으므로 약하게
    this.hemi = new THREE.HemisphereLight('#eaf2ff', '#8a9272', 0.45);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight('#fff0dc', 2.6);   // 따뜻한 햇빛
    sun.position.set(8000, 14000, 6000);
    sun.castShadow = true;
    // 그림자 해상도 — 지원되면 4096 (도면 크기에 맞춰 _fitShadow 가 범위를 좁혀 선명하게)
    const big = (this.renderer.capabilities.maxTextureSize || 0) >= 8192;
    sun.shadow.mapSize.set(big ? 4096 : 2048, big ? 4096 : 2048);
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 12;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    const fill = new THREE.DirectionalLight('#dfe8ff', 0.35);  // 반대편 채움광(그늘이 새까매지지 않게)
    fill.position.set(6000, 8000, -4000);   // 햇빛 반대편(뒤-오른쪽)
    this.scene.add(fill);
    this.fill = fill;
    const under = new THREE.DirectionalLight('#f4efe6', 0);   // 바닥 보기 — 아래에서 비추는 보조광(평소엔 꺼짐)
    under.position.set(3000, -9000, 4000);
    this.scene.add(under);
    this.underLight = under;
  }

  // 햇빛 그림자 범위를 현재 도면 크기에 맞춤 — 작은 집일수록 그림자가 또렷해짐
  _fitShadow(b) {
    const s = Math.max(b.w, b.h) / 2 + 4000;
    const sun = this.sun;
    this._shadowS = s;
    // 해 방향은 실제 계산값(계절·시각·집 방위) — 기본(봄·가을 오후 2시, 정남향)은 앞-왼쪽 위에서 비춤
    this._placeSun();
    const c = sun.shadow.camera;
    c.left = -s; c.right = s; c.top = s; c.bottom = -s;
    c.near = 100; c.far = s * 6;
    c.updateProjectionMatrix();
  }

  // ☀️ 실제 해 위치 — 위도 37.5°(한국), 계절(적위), 시각(시간각), 집 방위(northDeg)
  //   반환: el(고도, rad), azDeg(방위각: 북 0·동 90·남 180·서 270), dir(해를 향하는 월드 단위벡터)
  sunState() {
    const R = Math.PI / 180, lat = 37.5 * R;
    const dec = ({ summer: 23.44, equinox: 0, winter: -23.44 }[this.season] || 0) * R;
    const H = (this.sunHour - 12.5) * 15 * R;   // 한국 표준시 기준 남중 ≈ 12:30 (동경 127°)
    const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
    const east = -Math.sin(H) * Math.cos(dec);
    const north = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H);
    const az = Math.atan2(east, north);
    const [N, E] = this._northEast();
    const hx = N[0] * Math.cos(az) + E[0] * Math.sin(az), hz = N[1] * Math.cos(az) + E[1] * Math.sin(az);
    const dir = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    return { el, elDeg: el / R, azDeg: ((az / R) + 360) % 360, dir };
  }
  // 월드(x,z) 평면에서 북쪽·동쪽 단위벡터 — northDeg: 도면 위쪽에서 시계방향으로 돈 북쪽 각도
  _northEast() {
    const t = ((store.design && store.design.northDeg) || 0) * Math.PI / 180;
    return [[Math.sin(t), -Math.cos(t)], [Math.cos(t), Math.sin(t)]];
  }
  _placeSun() {
    const s = this._shadowS || 8000, st = this.sunState();
    const d = st.dir.clone(); if (d.y < 0.06) { d.y = 0.06; d.normalize(); }   // 해가 아주 낮아도 그림자 계산이 깨지지 않게
    this.sun.position.copy(d.multiplyScalar(s * 2));
    this.sun.target.position.set(0, 0, 0);
  }
  // 시간대 적용 — 해 세기·색, 하늘·안개색, 노출, 밤 실내 조명
  applyDaylight() {
    const st = this.sunState(), el = st.el;
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const day = ss(-0.10, 0.12, el);                    // 0=밤 1=낮 (해 고도 -6°~7° 사이 박명)
    const gold = ss(0.42, 0.06, el) * day;              // 해가 낮을수록 노을빛
    const amb = ss(-0.08, 0.35, el);                    // 주변광 — 해가 낮아지면 서서히 어두워짐(해질녘)
    const C = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
    this._placeSun();
    this.sun.intensity = 2.6 * ss(0.0, 0.16, el);
    this.sun.color.copy(C('#fff0dc', '#ffae6a', gold));
    this.sun.castShadow = el > 0.01;
    this.hemi.intensity = 0.06 + 0.39 * amb;
    this.hemi.color.copy(C('#3a4868', '#eaf2ff', day).lerp(new THREE.Color('#ffc69a'), gold * 0.5));
    this.fill.intensity = 0.04 + 0.31 * amb;
    this.renderer.toneMappingExposure = 0.42 + 0.58 * (0.4 * day + 0.6 * amb);
    const top = C('#08111f', '#a9c6e3', day).lerp(new THREE.Color('#7884ad'), gold * 0.6);
    const hor = C('#1a2639', '#e8eef3', day).lerp(new THREE.Color('#f2ae7b'), gold * 0.75);
    const key = top.getHexString() + hor.getHexString();
    if (key !== this._skyKey) {
      this._skyKey = key;
      if (this.scene.background && this.scene.background.dispose) this.scene.background.dispose();
      this.scene.background = this._skyTexture('#' + top.getHexString(), '#' + hor.getHexString());
    }
    if (this.scene.fog) this.scene.fog.color.copy(hor);
    const lamp = ss(0.03, -0.07, el);                   // 실내등은 해가 진 뒤에 켜짐
    for (const l of this._nightLights || []) { l.intensity = 2.4e6 * lamp; l.visible = lamp > 0.01; }
    // 주변광(환경맵)도 밤엔 줄임 — 안 줄이면 밤에도 집이 낮처럼 밝게 보임
    const envK = 0.06 + 0.94 * amb, seen = new Set();
    this.scene.traverse((o) => {
      for (const m of [].concat(o.material || [])) {
        if (!m || seen.has(m) || !('envMapIntensity' in m)) continue;
        seen.add(m);
        if (m.userData._envI == null) m.userData._envI = m.envMapIntensity;
        m.envMapIntensity = m.userData._envI * envK;
      }
    });
    this._envK = envK;
    this._needsRender = true;
    if (this.onDaylight) this.onDaylight({ ...st, day, hour: this.sunHour, season: this.season });
  }
  // 밤 실내 조명 — 닫힌 방마다 천장 아래 따뜻한 점광원 (낮엔 꺼짐)
  _buildNightLights(d, b, F, H) {
    this._nightLights = [];
    const rooms = d.rooms.filter((r) => !OPEN_ROOM_TYPES.includes(r.type)).slice(0, 10);
    for (const r of rooms) {
      const [x, z] = this._p(r.x + r.w / 2, r.y + r.d / 2, b);
      const l = new THREE.PointLight('#ffd6a0', 0, 0, 2);
      l.position.set(x, F + H - 180, z);
      this.modelGroup.add(l); this._nightLights.push(l);
    }
    for (const v of this._cmpLamps || []) {   // 비교 중인 옆집
      const l = new THREE.PointLight('#ffd6a0', 0, 0, 2);
      l.position.copy(v);
      this.modelGroup.add(l); this._nightLights.push(l);
    }
  }

  // 🧭 나침반 — 3D 화면 구석, 카메라를 돌리면 함께 돌아감
  _buildCompass() {
    const el = document.createElement('div');
    el.className = 'compass compass3d';
    el.innerHTML = `<svg viewBox="-50 -50 100 100" width="76" height="76" aria-label="방위">
      <circle r="44" class="cp-ring"/><g class="cp-needle"><path d="M0,-30 L7,0 L0,4 L-7,0Z" class="cp-n"/><path d="M0,30 L7,0 L0,-4 L-7,0Z" class="cp-s"/></g>
      <text class="cp-l" data-k="N">N</text><text class="cp-l" data-k="E">E</text><text class="cp-l" data-k="S">S</text><text class="cp-l" data-k="W">W</text></svg>`;
    this.container.appendChild(el);
    this._compass = { el, needle: el.querySelector('.cp-needle'), labels: [...el.querySelectorAll('.cp-l')] };
  }
  _updateCompass() {
    if (!this._compass) return;
    const q = this.camera.quaternion;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q), rt = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    let fx = up.x, fz = up.z; let fl = Math.hypot(fx, fz);
    if (fl < 1e-4) { const v = new THREE.Vector3(); this.camera.getWorldDirection(v); fx = v.x; fz = v.z; fl = Math.hypot(fx, fz) || 1; }
    fx /= fl; fz /= fl;
    let rx = rt.x, rz = rt.z; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    const [N, E] = this._northEast();
    const ang = (v) => Math.atan2(v[0] * rx + v[1] * rz, v[0] * fx + v[1] * fz);   // 화면 위쪽 기준 시계방향
    const a = ang(N), key = a.toFixed(3);
    if (key === this._compassKey) return;
    this._compassKey = key;
    this._compass.needle.setAttribute('transform', `rotate(${a * 180 / Math.PI})`);
    const dirs = { N, E, S: [-N[0], -N[1]], W: [-E[0], -E[1]] };
    for (const t of this._compass.labels) {
      const g = ang(dirs[t.dataset.k]);
      t.setAttribute('x', (Math.sin(g) * 38).toFixed(1)); t.setAttribute('y', (-Math.cos(g) * 38 + 4).toFixed(1));
    }
  }

  // 하늘 — 위는 맑은 하늘색, 지평선은 옅은 안개색 (세로 그라데이션)
  _skyTexture(top = SKY_TOP, horizon = SKY_HORIZON) {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(0.75, horizon);
    g.addColorStop(1, horizon);
    x.fillStyle = g; x.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // 후처리 체인: 장면 → 구석 음영(GTAO) → 톤매핑/색공간 출력
  _setupComposer() {
    try {
      const comp = new EffectComposer(this.renderer);
      comp.addPass(new RenderPass(this.scene, this.camera));
      const ao = new GTAOPass(this.scene, this.camera, 1, 1);
      // 단위가 mm 이므로 반경도 mm — 벽 모서리·가구 밑·천장 구석에 은은한 음영
      ao.updateGtaoMaterial({ radius: 700, distanceExponent: 1.5, thickness: 3, scale: 1.5, samples: 16, distanceFallOff: 1 });
      ao.blendIntensity = 1;
      comp.addPass(ao);
      comp.addPass(new OutputPass());
      this.composer = comp;
      this._ao = ao;
    } catch (e) {
      console.warn('[3D] 고화질 후처리 사용 불가 — 기본 렌더로 동작', e);
      this.composer = null;
    }
  }

  // 고화질(구석 음영) on/off — 버튼·자동 성능 판단에서 호출
  setQuality(on) {
    this.hq = !!on;
    this._hqPinned = !!on;   // 사용자가 직접 켠 경우 자동으로 끄지 않음
    try { localStorage.setItem(HQ_KEY, on ? '1' : '0'); } catch { /* noop */ }
    this._slowFrames = 0;
    this._needsRender = true;
  }

  _render() {
    const now = performance.now();
    const gap = now - this._lastRender;   // 연속 회전 중이면 = 한 프레임 걸린 시간(GPU 포함)
    if (this.hq && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this._lastRender = now;
    // 고화질로 돌리는 중 프레임이 계속 70ms(약 14fps) 넘게 걸리면(느린 PC) 자동으로 기본 화질로
    if (this.hq && this.composer && !this._hqPinned && gap < 250) {
      this._slowFrames = gap > 70 ? (this._slowFrames || 0) + 1 : 0;
      if (this._slowFrames >= 20) {
        console.info('[3D] 렌더가 느려 고화질(구석 음영)을 자동으로 끕니다.');
        this.hq = false; this._slowFrames = 0;
        if (this.onQualityChange) this.onQualityChange(false);
      }
    }
  }

  setActive(on) {
    this.active = on;
    if (on) {
      this._appliedW = 0;                     // 숨김 후 복구 시 캔버스 크기 강제 재적용
      if (this.dirty) this._needCam = true;   // 도면이 바뀐 뒤 3D 진입 → 카메라 전체 다시 맞춤(빈 화면 방지)
      this._resize();
      if (this.dirty) this.rebuild();
      // 탭 전환 직후 레이아웃이 아직 안 잡혔을 수 있어 다음 프레임에 한 번 더 맞춤
      requestAnimationFrame(() => this._resize());
    }
  }

  _resize() {
    const r = this.container.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cw = Math.round(r.width), ch = Math.round(r.height);
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    // 이미 같은 크기면 재적용 생략 (매 프레임 호출돼도 비용 없음)
    if (this._appliedW === cw && this._appliedH === ch && this._appliedPR === pr) return;
    this._appliedW = cw; this._appliedH = ch; this._appliedPR = pr;
    // 픽셀비율 상한 2 — 초고해상도에서 드로잉버퍼가 과도하게 커져 흰 화면/느려짐 방지
    this.renderer.setPixelRatio(pr);
    // updateStyle=true: 캔버스 CSS 크기를 컨테이너에 맞춤
    this.renderer.setSize(cw, ch, true);
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(cw, ch); }
    this.camera.aspect = cw / ch;
    this.camera.updateProjectionMatrix();
    this._needsRender = true;
  }

  // 도면 중심/크기 계산
  _bounds() {
    const d = store.design;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of d.rooms) {
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.d);
    }
    for (const { pts } of outlineShapes(d.outline)) for (const [px, py] of pts) {
      minX = Math.min(minX, px); minY = Math.min(minY, py);
      maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 8000; maxY = 8000; }
    return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cz: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
  }

  // 평면 좌표(mm) → 3D 좌표 (중심 원점). x→x, y(plan)→z
  _p(x, y, b) { return [x - b.cx, y - b.cz]; }

  rebuild() {
    this.dirty = false;
    this._needsRender = true;
    // 실물 모델은 캐시해서 계속 재사용 → 아래 일괄 해제에 휩쓸리지 않게 먼저 떼어냄
    for (const e of Object.values(this._m3dCache || {})) if (e.node && e.node.parent) e.node.parent.remove(e.node);
    if (this.compare && this.compare.node && this.compare.node.parent) this.compare.node.parent.remove(this.compare.node);
    // 기존 제거 — 지오메트리는 매번 새로 만들므로 GPU 메모리도 함께 해제 (편집할수록 느려지는 것 방지)
    //   (재질·텍스처는 textures.js 캐시를 공유하므로 해제하지 않음)
    this.modelGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.modelGroup.clear();
    const d = store.design;
    const b = this._bounds();
    const H = d.ceilingHeight || 2400;
    const M = Math.max(b.w, b.h);
    this._fitShadow(b);
    // 먼 곳은 하늘색 안개로 — 지면 끝선이 안 보이고 공기감이 생김 (카메라 최대 거리보다 멀리서 시작)
    this.scene.fog = new THREE.Fog(SKY_HORIZON, M * 3 + 30000, M * 8 + 140000);

    // 바닥 그라운드 — 부지(땅) 이미지가 있으면 위성/항공 지면, 없으면 기본 회색
    const site = d.site;
    let ground;
    if (site && site.image) {
      const wMM = (site.widthM || 20) * 1000;
      const hMM = wMM * (site.aspect || 1);            // aspect = 이미지 세로/가로
      const tex = new THREE.TextureLoader().load(site.image, () => { this._needsRender = true; });
      if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      ground = new THREE.Mesh(new THREE.PlaneGeometry(wMM, hMM),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
      ground.rotation.x = -Math.PI / 2;
      ground.rotation.z = -(site.rot || 0) * Math.PI / 180;   // 지면 회전
      ground.position.set(site.dx || 0, -2, site.dy || 0);
    } else {
      // 부지 이미지가 없으면 잔디 마당 — 지평선까지 넓게 깔고 안개로 자연스럽게 사라지게
      const G = M * 16 + 300000;
      ground = new THREE.Mesh(new THREE.PlaneGeometry(G, G), TEX.groundMaterial(G));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2;
      // (집 둘레 콘크리트 마당은 제거 — 잔디와 1mm 차이로 겹쳐 멀리서 보면 깜빡였음)
    }
    ground.receiveShadow = true;
    ground.userData.isGround = true;   // 3D 내보내기(GLB)에서 제외 — 블렌더에선 자체 바닥 사용
    ground.visible = !this.underside;  // 바닥 보기: 땅을 치우고 기초·데크 하부를 보여줌
    this._ground = ground;
    this.modelGroup.add(ground);

    // 기초 — 집 전체(벽·바닥·데크·포치·지붕)를 기초 높이만큼 올리고, 그 아래를 콘크리트 기초/데크 하부로 채움.
    //   건물 요소는 houseGroup 에 모아 한 번에 올림 (아래 build 함수들은 this.modelGroup 에 add 하므로 잠시 바꿔 끼움)
    const F = Math.max(0, +d.foundationHeight || 0);
    this._foundationH = F;
    // 실물 모델(블렌더 GLB) — 도면에 지정돼 있고 실물 형태 그대로면 자동 생성 모델 대신 사용
    //   불러오는 동안엔 자동 모델을 잠깐 보여주지 않고 비워 둠 (불러오기 실패·구조 편집 시에만 자동 모델)
    const m3d = this._model3dSpec(d);
    const m3dNode = m3d.available && this.showModel3d ? this._model3dNode(m3d.url) : null;
    const m3dEntry = m3d.available && (this._m3dCache || {})[m3d.url];
    const m3dWaiting = !m3dNode && !!(m3dEntry && m3dEntry.loading);
    if (F > 0 && !m3dNode && !m3dWaiting) this._buildFoundation(d, b, F);
    const root = this.modelGroup;
    const house = new THREE.Group();
    house.position.y = F;
    root.add(house);
    this.modelGroup = house;
    try {
      if (m3dNode) {
        // GLB 원점 = 도면 원점(방들의 북서쪽 모서리) → 방을 통째로 옮기면 모델도 따라감. 지면(0)에 바로 놓임
        m3dNode.position.set(m3d.ox - b.cx, -F, m3d.oy - b.cz);
        m3dNode.traverse((o) => { if (o.userData && o.userData.roof) o.visible = this.showRoof; });   // 지붕·천장 토글
        this._applyModel3dOptions(m3dNode, d);  // 제품 옵션(외장·띠·지붕·프레임·창틀·데크 색)
        house.add(m3dNode);
        // 상담 중 추가한 가구는 실물 모델 안에 함께 (모델에 가구가 이미 있는 제품은 도면 기본 가구 제외)
        const baseFurn = new Set((d.model3d && d.model3d.baseFurn) || []);
        for (const f of d.furniture) if (!baseFurn.has(f.id)) this._buildFurniture(f, b, H);
        if (store.selectedRoom) this._buildEditHandles(d, b);
      } else if (m3dWaiting) {
        // 실물 모델 불러오는 중 — 다 받으면 다시 그림
      } else {
        if (d.outline) this._buildOutline(d, b, H); // 집 외벽(외곽)
        for (const room of d.rooms) this._buildRoom(room, b, H);
        this._buildInteriorWalls(d, b, H);          // 방 벽(겹친 벽은 한 겹으로 합침)
        for (const o of (d.openings || [])) this._buildOpening(o, b);
        for (const f of d.furniture) this._buildFurniture(f, b, H);
        this._buildRailings(d, b);                  // 데크·포치 난간 (room.rail 지정 시)

        // 외장재 + 지붕 (토글)
        if (this.showExterior) this._buildExterior(d, b, H);
        if (this.showRoof) this._buildRoof(d, b, H);

        // 집을 클릭해 선택하면 이동·회전·크기조절 핸들 표시 (별도 편집 모드 불필요)
        if (store.selectedRoom) this._buildEditHandles(d, b);
        // 면별 외장재: 선택된 색 띠의 폭 조절 핸들
        if (this.faceMode && this._selBand) this._buildBandHandles(d, b);
      }
    } finally {
      this.modelGroup = root;
    }
    this._buildCompare(root, house, b);
    this._buildNightLights(d, b, F, H);
    this.applyDaylight();
    this.usingModel3d = !!m3dNode;
    if (this.onModel3dState) {
      const e = m3d.url && (this._m3dCache || {})[m3d.url];
      this.onModel3dState({ available: m3d.available, mismatch: m3d.mismatch, reason: m3d.reason || '', using: !!m3dNode,
        loading: !!(e && e.loading), failed: !!(e && e.failed), label: m3d.label });
    }

    if (this._firstFrame === undefined) { this._firstFrame = false; this.resetCamera(b); }
    else if (this._needCam) { this._needCam = false; this.resetCamera(b); }
  }

  // 실물 모델 사용 가능 여부 — 1층이고, 실물이 표현하는 그대로일 때만 (크기·지붕 모양·창문 배치)
  //   2D에서 이런 걸 바꾸면 실물과 달라지므로 자동 생성 모델로 돌아가고, reason 으로 이유를 알림
  _model3dSpec(d) {
    const m = d.model3d;
    if (!m || !m.url || (d.activeFloor || 0) !== 0 || !d.rooms.length) return { available: false };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of d.rooms) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.d); }
    const fit = Array.isArray(m.fit) ? m.fit : null, roof = d.roof || {};
    let reason = '';
    if (fit && (Math.abs(x1 - x0 - fit[0]) > 60 || Math.abs(y1 - y0 - fit[1]) > 60)) reason = '도면 크기';
    else if (m.roofType && roof.type !== m.roofType) reason = '지붕 모양';
    else if (m.roofType && (roof.ridge === 'x' ? 'x' : 'z') !== (m.ridge || 'z')) reason = '용마루 방향';
    else if (m.sig != null && model3dSig(d) !== m.sig) reason = '창·문 배치';
    else if (this.faceMode || (d.exteriorFaces && Object.keys(d.exteriorFaces).length)) reason = '면별 외장재';
    return { available: !reason, mismatch: !!reason, reason, url: m.url, label: m.label || '', ox: x0, oy: y0 };
  }

  // 🏘️ 주택 비교 — 다른 제품(실물 모델)을 지금 집 동쪽에 4m 띄워 나란히 세움. 해·시간·방위는 함께 적용
  //   design: instantiateTemplate 결과, title: 라벨. null 이면 비교 끄기
  setCompare(design, title) {
    this.compare = design ? { design, title: title || design.name || '' } : null;
    this._cmpFrame = !!design;
    if (!design) this._needCam = true;   // 끄면 원래 집 시점으로
    this.dirty = true;
  }
  _buildCompare(root, house, b) {
    this._cmpLabels = null; this._cmpLamps = null;
    const c = this.compare;
    const mainBox = new THREE.Box3().setFromObject(house);
    if (!c || mainBox.isEmpty()) return this._syncCmpLabels();
    const spec = this._model3dSpec(c.design);
    const src = spec.available ? this._model3dNode(spec.url) : null;   // 처음이면 불러오기 시작 → 다 받으면 다시 그림
    if (!src) return this._syncCmpLabels();
    if (!c.node || c.url !== spec.url) { c.node = this._cloneModel3d(src); c.url = spec.url; }
    const node = c.node;
    this._applyModel3dOptions(node, c.design);
    node.traverse((o) => { if (o.userData && o.userData.roof) o.visible = this.showRoof; });
    node.position.set(0, 0, 0); node.updateMatrixWorld(true);
    const cb = new THREE.Box3().setFromObject(node);
    const gap = 4000;
    node.position.set(mainBox.max.x + gap - cb.min.x, 0, (mainBox.min.z + mainBox.max.z) / 2 - (cb.min.z + cb.max.z) / 2);
    root.add(node);
    node.updateMatrixWorld(true);
    const nb = new THREE.Box3().setFromObject(node);
    // 비교 집 밤 실내등 위치 (GLB 원점 = 그 도면 방들의 북서쪽 모서리)
    const cd = c.design, cF = Math.max(0, +cd.foundationHeight || 0), cH = cd.ceilingHeight || 2400;
    this._cmpLamps = cd.rooms.filter((r) => !OPEN_ROOM_TYPES.includes(r.type)).slice(0, 10).map((r) =>
      new THREE.Vector3(node.position.x + r.x + r.w / 2 - spec.ox, cF + cH - 180, node.position.z + r.y + r.d / 2 - spec.oy));
    const top = (bx) => new THREE.Vector3((bx.min.x + bx.max.x) / 2, bx.max.y + 700, (bx.min.z + bx.max.z) / 2);
    this._cmpLabels = [{ pos: top(mainBox), text: (store.design.name || '현재 도면').trim() }, { pos: top(nb), text: c.title }];
    // 두 집이 다 들어오게 그림자 범위·카메라 맞춤
    const all = mainBox.clone().union(nb);
    const ext = Math.max(Math.abs(all.min.x), Math.abs(all.max.x), Math.abs(all.min.z), Math.abs(all.max.z));
    this._fitShadow({ w: Math.max(0, ext * 2 - 5000), h: 0 });   // 반경 ≈ ext + 1.5m
    const ab = { w: all.max.x - all.min.x, h: all.max.z - all.min.z };
    this._aerialZoomLimits(ab);
    if (this._cmpFrame) {
      this._cmpFrame = false;
      const cx = (all.min.x + all.max.x) / 2, cz = (all.min.z + all.max.z) / 2, dist = Math.max(ab.w, ab.h) * 0.95 + 5000;
      this.controls.target.set(cx, 0, cz);
      this.camera.position.set(cx + dist * 0.25, dist * 0.7, cz + dist * 1.0);
      this.controls.update();
    }
    this._syncCmpLabels();
  }
  // 캐시된 실물 모델 복제 — userData.m3dOrig(재질)는 clone 시 JSON 으로 깨지므로 따로 옮김
  _cloneModel3d(src) {
    const meshes = []; src.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const saved = meshes.map((o) => { const m = o.userData.m3dOrig || o.material; delete o.userData.m3dOrig; return m; });
    const node = src.clone();
    meshes.forEach((o, i) => { o.userData.m3dOrig = saved[i]; });
    let i = 0;
    node.traverse((o) => { if (o.isMesh) { o.userData.m3dOrig = saved[i]; o.material = saved[i]; i++; } });
    node.name = 'compare3d';   // 클릭해도 지금 집이 선택되지 않게
    return node;
  }
  // 비교 라벨(집 이름) — 3D 위에 띄우는 HTML
  _syncCmpLabels() {
    const L = this._cmpLabels || [];
    this._cmpEls = this._cmpEls || [];
    while (this._cmpEls.length < L.length) {
      const el = document.createElement('div'); el.className = 'cmp-label';
      this.container.appendChild(el); this._cmpEls.push(el);
    }
    this._cmpEls.forEach((el, i) => { el.style.display = L[i] ? '' : 'none'; if (L[i]) { el.textContent = L[i].text; el.classList.toggle('cmp-b', i === 1); } });
    this._updateCmpLabels();
  }
  _updateCmpLabels() {
    const L = this._cmpLabels; if (!L || !this._cmpEls) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    L.forEach((l, i) => {
      const el = this._cmpEls[i]; if (!el) return;
      const v = l.pos.clone().project(this.camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      el.style.display = vis ? '' : 'none';
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
    });
  }

  // 제품 옵션(model3d.optionSets) → 실물 모델 부품에 적용. 고른 게 없으면(orig) 블렌더 원래 마감 그대로
  _applyModel3dOptions(node, d) {
    const m = d.model3d, sel = m.options || {}, byPart = new Map();
    for (const set of m.optionSets || []) {
      const ch = set.choices.find((c) => c.id === sel[set.key]) || set.choices[0];
      for (const part of set.parts) byPart.set(part, { set, ch });
    }
    node.traverse((o) => {
      if (!o.isMesh) return;
      const u = o.userData;
      if (!u.m3dOrig) u.m3dOrig = o.material;
      const hit = byPart.get(o.name);
      o.material = (!hit || hit.ch.id === 'orig') ? u.m3dOrig
        : this._m3dCached(u.m3dOrig.uuid + '|' + hit.set.key + '|' + hit.ch.id, () => this._m3dVariant(u.m3dOrig, hit.ch));
    });
  }
  _m3dVariant(orig, ch) {
    const m = orig.clone();
    if (ch.dark && ch.light && orig.map) { m.map = this._m3dRemapTex(orig.map, ch.dark, ch.light); m.color.set('#ffffff'); }
    else if (ch.dark && ch.light) m.color.set(ch.dark).lerp(new THREE.Color(ch.light), 0.6);   // 무늬 없는 단색 부품은 중간~밝은 톤
    else if (ch.color) m.color.set(ch.color);
    if (ch.roughness != null) m.roughness = ch.roughness;
    if (ch.metalness != null) m.metalness = ch.metalness;
    return m;
  }
  // 구운 질감의 밝기(나뭇결·판재 이음·그늘)는 그대로 두고 색만 dark→light 계열로 바꾼 새 질감
  _m3dRemapTex(tex, dark, light) {
    const img = tex.image, w = img.width, h = img.height;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h), px = data.data;
    const EMPTY = 6;                          // 아틀라스의 빈 곳(검정)은 그대로
    const hist = new Uint32Array(256); let n = 0;
    for (let i = 0; i < px.length; i += 4) {
      const L = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
      if (L > EMPTY) { hist[L]++; n++; }
    }
    const pct = (q) => { let acc = 0; for (let k = 0; k < 256; k++) { acc += hist[k]; if (acc >= n * q) return k; } return 255; };
    let lo = pct(0.02), hi = pct(0.98);
    if (hi - lo < 24) { const mid = (hi + lo) / 2; lo = mid - 12; hi = mid + 12; }   // 거의 단색인 질감은 과하게 늘리지 않음
    const hex = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
    const A = hex(dark), B = hex(light), span = hi - lo;
    for (let i = 0; i < px.length; i += 4) {
      const L = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
      if (L <= EMPTY) continue;
      const t = Math.min(1, Math.max(0, (L - lo) / span));
      px[i] = A[0] + (B[0] - A[0]) * t; px[i + 1] = A[1] + (B[1] - A[1]) * t; px[i + 2] = A[2] + (B[2] - A[2]) * t;
    }
    ctx.putImageData(data, 0, 0);
    const out = new THREE.CanvasTexture(cv);
    for (const k of ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'anisotropy', 'channel', 'minFilter', 'magFilter']) out[k] = tex[k];
    out.needsUpdate = true;
    return out;
  }
  _m3dCached(key, make) {
    const c = this._m3dMats || (this._m3dMats = new Map());
    if (!c.has(key)) c.set(key, make());
    return c.get(key);
  }

  // 캐시된 실물 모델 노드 (없으면 백그라운드로 불러오기 시작하고 null → 다 받으면 다시 그림)
  _model3dNode(url) {
    const cache = this._m3dCache || (this._m3dCache = {});
    const e = cache[url];
    if (e) return e.node || null;
    cache[url] = { loading: true };
    this._loadModel3d(url).then((node) => {
      cache[url] = { node };
      this.dirty = true; this._needsRender = true;
    }).catch((err) => {
      console.warn('[3D] 실물 모델을 불러오지 못했어요 — 자동 생성 모델로 표시합니다', err);
      cache[url] = { failed: true };
      this.dirty = true;
    });
    return null;
  }

  async _loadModel3d(url) {
    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js')]);
    const draco = new DRACOLoader(); draco.setDecoderPath(DRACO_PATH);
    const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
    try {
      const gltf = await loader.loadAsync(url);
      const node = new THREE.Group();
      node.name = 'model3d';
      gltf.scene.scale.setScalar(1000);   // m → mm
      node.add(gltf.scene);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        const m = o.material;
        if (m.map) m.map.anisotropy = 8;
        // 유리(투과)는 웹에선 무겁고 어둡게 나옴 → 가벼운 반투명 유리로
        if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = 0.3; m.depthWrite = false; }
      });
      return node;
    } finally { draco.dispose(); }
  }

  // 벽 재질 (투명도 < 1 이면 반투명 → 내부 들여다보기)
  _wallMat() {
    const m = TEX.wallMaterial('#f6f5f2');
    if (this.wallOpacity < 1) { m.transparent = true; m.opacity = this.wallOpacity; }
    return m;
  }

  // 휠 줌 — 방향만 보고 한 틱당 8%씩 부드럽게(기기별 deltaY 편차 무시), 범위 클램프
  _wheelZoom(e) {
    if (!this.active) return;
    e.preventDefault();
    const step = e.deltaY > 0 ? 1.08 : 1 / 1.08;   // 아래로 굴리면 축소, 위로 굴리면 확대
    const t = this.controls.target;
    const dir = this.camera.position.clone().sub(t);
    const min = this.controls.minDistance || 1;
    const max = isFinite(this.controls.maxDistance) ? this.controls.maxDistance : dir.length() * 8;
    const dist = Math.max(min, Math.min(max, dir.length() * step));
    this.camera.position.copy(t).add(dir.setLength(dist));
    this.controls.update();
  }

  // 카메라 줌 (하단 줌 버튼) — 타깃 기준 당기기/밀기
  zoom(factor) {
    const t = this.controls.target;
    const dir = this.camera.position.clone().sub(t).multiplyScalar(1 / factor);
    this.camera.position.copy(t).add(dir);
    this.controls.update();
  }

  resetCamera(b) {
    b = b || this._bounds();
    const dist = Math.max(b.w, b.h) * 1.1 + 5000;
    this.camera.position.set(dist * 0.65, dist * 0.8, dist * 0.85);
    this.controls.target.set(0, 0, 0);
    this._aerialZoomLimits(b);        // 휠 줌 범위 제한 → 집 통과·무한 축소로 사라지는 것 방지
    this.controls.update();
  }
  _aerialZoomLimits(b) {              // 조감(외부) 시점 휠 줌 한계
    const m = Math.max(b.w, b.h);
    this.controls.minDistance = m * 0.32 + 2500;   // 가까이 당겨 디테일 확인 (바닥 속으로는 안 들어가게)
    this.controls.maxDistance = m * 2.4 + 18000;   // 멀리 밀어도 집이 점처럼 작아지지 않게
  }

  _buildRoom(room, b, ceilH) {
    const t = ROOM_TYPES[room.type] || ROOM_TYPES.hall;
    const isAttic = room.type === 'attic';
    const isOpen = OPEN_ROOM_TYPES.includes(room.type);
    const wallH = isAttic ? ATTIC_HEIGHT : ceilH;
    const [px, pz] = this._p(room.x, room.y, b);

    // 바닥 (방 종류별 마루/타일 질감) — 3D 는 2D 구분색(파스텔) 대신 실제 마감 색
    //   마루: 밝은 오크 강화마루, 욕실·다용도: 밝은 회색 타일, 현관: 진회색 타일 (도면에서 floorColor 로 지정 가능)
    const FLOOR_COLOR = { bath: '#d9dcdf', utility: '#d9dcdf', entrance: '#8d9298' };
    const floorCol = room.floorColor || FLOOR_COLOR[room.type] || store.design.floorColor || '#cfb087';
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(room.w, 60, room.d),
      TEX.floorMaterial(room.type, floorCol, room.w, room.d)
    );
    floor.position.set(px + room.w / 2, 30, pz + room.d / 2);
    floor.userData.roomId = room.id;   // 3D 편집: 방 선택용
    floor.receiveShadow = true;
    if (this.floorOpacity < 1) { floor.material.transparent = true; floor.material.opacity = this.floorOpacity; }
    this.modelGroup.add(floor);

    if (isOpen) return; // 발코니는 벽 생략(난간 느낌)
    this._buildArtWalls(room, b, wallH);

    // 벽은 방마다 그리지 않고 _buildInteriorWalls 에서 한 번에(겹친 벽 합침).

    // 다락은 경사 지붕 표현
    if (isAttic) {
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(room.w, room.d) * 0.62, 900, 4),
        new THREE.MeshStandardMaterial({ color: '#caa987' })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(px + room.w / 2, wallH + 60 + 450, pz + room.d / 2);
      roof.castShadow = true;
      this.modelGroup.add(roof);
    }
  }

  // 내벽 전체 — 방마다 4면을 각자 그리면 맞닿은 두 방 경계에 벽이 겹쳐(두 겹)
  //   지저분해진다. 모든 방의 벽 세그먼트를 모아 같은 선·같은 높이끼리 구간을
  //   합쳐 '한 겹'으로 그린다. 개구부(문/창)는 _buildCarvedEdge 가 벽선 위 위치를
  //   기하로 판정해 뚫으므로, 맞닿은 방 사이 문도 그대로 관통한다.
  _buildInteriorWalls(d, b, ceilH) {
    const LINE_TOL = 60;   // 같은 벽선으로 볼 허용치(mm)
    // 1) 방 벽 세그먼트 수집 — o:0 수평(y=line, x:a..b) / o:1 수직(x=line, y:a..b)
    const segs = [];
    for (const room of d.rooms) {
      if (OPEN_ROOM_TYPES.includes(room.type)) continue;   // 발코니 등 벽 없음
      const h = room.type === 'attic' ? ATTIC_HEIGHT : ceilH;
      const open = Array.isArray(room.open) ? room.open : [];
      const x2 = room.x + room.w, y2 = room.y + room.d;
      if (!open.includes('n')) segs.push({ o: 0, line: room.y, a: room.x, b: x2, h });
      if (!open.includes('s')) segs.push({ o: 0, line: y2, a: room.x, b: x2, h });
      if (!open.includes('w')) segs.push({ o: 1, line: room.x, a: room.y, b: y2, h });
      if (!open.includes('e')) segs.push({ o: 1, line: x2, a: room.y, b: y2, h });
    }
    // 2) (방향·선·높이)로 묶기
    const groups = new Map();
    for (const s of segs) {
      const k = s.o + '|' + Math.round(s.line / LINE_TOL) + '|' + Math.round(s.h);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(s);
    }
    const wallMat = this._wallMat();
    for (const arr of groups.values()) {
      const o = arr[0].o, h = arr[0].h;
      const line = arr.reduce((t, s) => t + s.line, 0) / arr.length;   // 대표 선값(평균)
      // 3) 겹치는 구간 병합 → 유니온
      const iv = arr.map((s) => [Math.min(s.a, s.b), Math.max(s.a, s.b)]).sort((p, q) => p[0] - q[0]);
      const merged = [];
      for (const [a, bb] of iv) {
        const last = merged[merged.length - 1];
        if (last && a <= last[1] + 1) last[1] = Math.max(last[1], bb);
        else merged.push([a, bb]);
      }
      // 4) 각 구간을 한 벽으로 (개구부는 기하로 뚫림), 걸레받이 포함
      for (const [a, bb] of merged) {
        const A = o === 0 ? this._p(a, line, b) : this._p(line, a, b);
        const B = o === 0 ? this._p(bb, line, b) : this._p(line, bb, b);
        this._buildCarvedEdge(A, B, h, WALL_T, WALL_T / 2, b, () => wallMat, { baseboard: true });
      }
    }
  }

  // 한 벽면(room+side) 위에 놓인 개구부들을 축 좌표로 정리 (a..c2, sill, top)
  //   소속 방과 무관하게 '이 벽선 위'의 문/창을 모두 잡음. (외장재 마감에서 사용)
  _collectOps(room, side, L) {
    const TOL = 300;
    const horiz = (side === 'n' || side === 's');
    let P0, dir;
    if (side === 'n') { P0 = [room.x, room.y]; dir = [1, 0]; }
    else if (side === 's') { P0 = [room.x, room.y + room.d]; dir = [1, 0]; }
    else if (side === 'w') { P0 = [room.x, room.y]; dir = [0, 1]; }
    else { P0 = [room.x + room.w, room.y]; dir = [0, 1]; }
    const out = [];
    for (const o of (store.design.openings || [])) {
      const w = this._openingWorld(o); if (!w) continue;
      if (w.free) continue;
      if (w.horiz !== horiz) continue;
      const vx = w.cx - P0[0], vy = w.cy - P0[1];
      const t = vx * dir[0] + vy * dir[1];
      const perp = Math.abs(-vx * dir[1] + vy * dir[0]);
      if (perp > TOL) continue;
      if (t < -w.half || t > L + w.half) continue;
      const a = Math.max(0, t - w.half), c2 = Math.min(L, t + w.half);
      if (c2 - a < 1) continue;
      out.push({ a, c2, sill: w.sill, top: w.top });
    }
    return out.sort((p, q) => p.a - q.a);
  }

  // 개구부를 제외한 벽 솔리드 사각형 목록 [a, b, yLo, yHi]
  // ext: 모서리 메움을 위해 양 끝을 늘리는 길이
  _wallRects(L, ops, wallH, ext, extB) {
    const eA = ext, eB = (extB != null) ? extB : ext;   // 양 끝 연장을 따로(밴드 구간 이음매는 0)
    const yBase = 60, wallTop = yBase + wallH;
    const rects = [];
    let cursor = -eA;
    for (const o of ops) {
      const top = Math.min(wallTop, yBase + o.top);
      if (o.a > cursor) rects.push([cursor, o.a, yBase, wallTop]);     // 개구부 사이 꽉 찬 벽
      if (top < wallTop) rects.push([o.a, o.c2, top, wallTop]);        // 상부 인방
      if (o.sill > 0) rects.push([o.a, o.c2, yBase, yBase + o.sill]);  // 하부(창 밑) 벽
      cursor = Math.max(cursor, o.c2);
    }
    if (cursor < L + eB) rects.push([cursor, L + eB, yBase, wallTop]);
    return rects;
  }

  _baseboardMat() { return this.__bbMat || (this.__bbMat = new THREE.MeshStandardMaterial({ color: '#e7e2d8', roughness: 0.75 })); }

  // 창호: 벽면에 끼워지는 창틀 + 유리(또는 문짝)
  _buildOpening(o, b) {
    const pl = this._openingWorld(o); if (!pl) return;
    const t = WINDOW_TYPES[o.winType] || {};
    const isDoor = t.glass === false;
    const sgn = o.flipH ? -1 : 1;   // 경첩(문 다는 쪽) 좌우 — 손잡이·여닫이 위치를 벽 방향으로 뒤집음

    // 벽면 중심 좌표 (3D) + 벽 방향에 맞춘 회전
    const [cx, cz] = this._p(pl.cx, pl.cy, b);
    const cy = (o.sill || 0) + (o.h || 1200) / 2 + 60;

    const g = new THREE.Group();
    g.position.set(cx, cy, cz);
    g.rotation.y = -Math.atan2(pl.uy, pl.ux);

    // 프레임 — 중간 회색(알루미늄 새시 느낌). 흰색이면 흰 벽에 묻히고, 검정이면 구멍처럼 보임
    // 새시 — 속성 패널의 '창틀 색상'(o.color) 반영 (예전엔 무시되고 항상 회색이었음)
    const frameMat = new THREE.MeshStandardMaterial({ color: o.color || '#7c828a', roughness: 0.38, metalness: 0.55 });
    const W = o.w, Hh = o.h, FT = 70; // 프레임 두께
    // 외곽 프레임 (위/아래/좌/우) — 벽 두께보다 살짝만 나오게 해서 파묻힘 방지
    const addFrame = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, WALL_T + 60), frameMat);
      m.position.set(x, y, 0); m.castShadow = true; g.add(m);
    };
    addFrame(W, FT, 0, Hh / 2 - FT / 2);
    addFrame(W, FT, 0, -Hh / 2 + FT / 2);
    addFrame(FT, Hh, -W / 2 + FT / 2, 0);
    addFrame(FT, Hh, W / 2 - FT / 2, 0);

    if (isDoor) {
      const leafW = W - FT * 2, leafH = Hh - FT;
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(leafW, leafH, WALL_T - 20),
        new THREE.MeshStandardMaterial({ color: '#8a6b49', roughness: 0.65 })   // 밝은 원목 문짝
      );
      door.position.y = -FT / 2; door.castShadow = true; g.add(door);
      // 패널 몰딩(문짝 표면 홈) — 살짝 들어간 판 2개
      const panel = (yy) => { const p = new THREE.Mesh(new THREE.BoxGeometry(leafW * 0.66, leafH * 0.34, 8), new THREE.MeshStandardMaterial({ color: '#7a5d3f', roughness: 0.7 })); p.position.set(0, -FT / 2 + yy, (WALL_T - 20) / 2); g.add(p); };
      panel(leafH * 0.22); panel(-leafH * 0.22);
      // 손잡이(양면) — 경첩 좌우(flipH)에 따라 손잡이 쪽도 뒤집힘
      for (const zz of [(WALL_T - 20) / 2 + 12, -(WALL_T - 20) / 2 - 12]) {
        const kn = new THREE.Mesh(new THREE.SphereGeometry(28, 12, 10), new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.6, roughness: 0.3 }));
        kn.position.set(sgn * (leafW / 2 - 70), -FT / 2, zz); g.add(kn);
      }
    } else {
      // 유리 — 환경광을 반사하는 반투명 유리 (하늘·실내가 비쳐 보이고, 안쪽도 은은히 보임)
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(W - FT * 2, Hh - FT * 2, 16),
        // (고화질 후처리는 선형 색공간에서 섞여 유리가 더 뿌옇게 보이므로 불투명도를 낮게 잡음)
        new THREE.MeshPhysicalMaterial({ color: '#a9cadb', transparent: true, opacity: 0.24, roughness: 0.04, metalness: 0,
          clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6, depthWrite: false })
      );
      glass.renderOrder = 2;
      g.add(glass);
      if (t.combo === 'foldSwing') {
        // 폴딩 + 여닫이 복합 도어 — 경첩 좌우(flipH)에 따라 여닫이/폴딩 방향을 뒤집음
        //   sgn=+1: 폴딩(왼쪽) + 여닫이(오른쪽) / sgn=-1: 여닫이(왼쪽) + 폴딩(오른쪽)
        const sr = t.swingRatio || 0.28;
        const foldStart = sgn * (-W / 2);           // 폴딩이 시작되는 벽 끝
        const xSplit = sgn * (W * (0.5 - sr));       // 폴딩/여닫이 구분 위치
        // 구분 세로틀(굵게)
        const div = new THREE.Mesh(new THREE.BoxGeometry(FT, Hh - FT * 2, WALL_T), frameMat);
        div.position.set(xSplit, 0, 0); g.add(div);
        // 폴딩 세로 살 (foldStart → xSplit, 방향은 부호로 자동 처리)
        const nFold = Math.max(2, t.panes || 4);
        const foldW = xSplit - foldStart;
        for (let i = 1; i < nFold; i++) {
          const x = foldStart + (foldW * i) / nFold;
          const m = new THREE.Mesh(new THREE.BoxGeometry(FT * 0.7, Hh - FT * 2, WALL_T), frameMat);
          m.position.set(x, 0, 0); g.add(m);
        }
        // 여닫이 문 손잡이 (구분틀에서 여닫이 쪽으로)
        const kn = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 200, 12),
          new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.6, roughness: 0.3 }));
        kn.rotation.x = Math.PI / 2; kn.position.set(xSplit + sgn * FT * 1.3, 0, WALL_T / 2 + 20); g.add(kn);
      } else {
        // 세로 분할 프레임(멀리언)
        const panes = Math.max(1, t.panes || 1);
        const mullW = t.fold ? FT : FT * 0.7;
        for (let i = 1; i < panes; i++) {
          const x = -W / 2 + (W * i) / panes;
          const mull = new THREE.Mesh(new THREE.BoxGeometry(mullW, Hh - FT * 2, WALL_T), frameMat);
          mull.position.set(x, 0, 0); g.add(mull);
        }
      }
      // 가로 중간 살(창살) — 미닫이·폴딩(좌우로 미는 세로 짝)·유리중문(noRail)은 생략
      if (!t.noRail && !t.slide) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(W - FT * 2, FT * 0.6, WALL_T * 0.8), frameMat);
        rail.position.set(0, 0, 0); g.add(rail);
      }
      // 창턱(실) — 아래쪽 바깥으로 살짝 튀어나온 판 (바닥까지 내려오는 문 형태는 생략)
      if ((o.sill || 0) > 0) {
        const sill = new THREE.Mesh(new THREE.BoxGeometry(W + 40, 40, WALL_T + 90), frameMat);
        sill.position.set(0, -Hh / 2 + 20, 0); g.add(sill);
      }
      // 창 둘레 마감 몰딩 — 외벽 쪽에 두꺼운 테두리 (세움 시공: 창틀색과 같은 진한 프레임)
      if (o.trim) {
        const TR = 90, depth = WALL_T + 240;   // 외장(바깥면 120)보다 앞으로 나와야 겹쳐 깜빡이지 않음
        for (const [w, h, x, y] of [[W + TR * 2, TR, 0, Hh / 2 + TR / 2], [W + TR * 2, TR, 0, -Hh / 2 - TR / 2], [TR, Hh, -W / 2 - TR / 2, 0], [TR, Hh, W / 2 + TR / 2, 0]]) {
          if (y < 0 && !(o.sill > 0)) continue;   // 바닥까지 오는 문은 아래 몰딩 없음
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), frameMat);
          m.position.set(x, y, 0); m.castShadow = true; g.add(m);
        }
      }
    }
    this.modelGroup.add(g);
  }

  // 개구부(창/문)를 평면 좌표 기준으로 환산 — 외곽 벽에서도 같은 자리에 구멍을 뚫기 위함
  _openingWorld(o) {
    const half = (o.w || 900) / 2;
    // 벽 없이 자유 배치된 개구부 — 3D에도 그 자리·각도에 세워 보이게
    if (o.free) {
      const ang = o.angle || 0;
      const ux = Math.cos(ang), uy = Math.sin(ang);
      return {
        cx: o.x, cy: o.y, ux, uy, horiz: Math.abs(ux) >= Math.abs(uy), half,
        sill: Math.max(0, o.sill || 0), top: (o.sill || 0) + (o.h || 1200), free: true,
      };
    }
    // 외벽(외곽)에 부착된 개구부
    if (o.onOutline) {
      const shapes = outlineShapes(store.design.outline);
      const path = shapes[o.pathIndex]; if (!path) return null;
      const pts = path.pts, n = pts.length;
      const eMax = path.closed ? n : n - 1;
      if (o.edgeIndex < 0 || o.edgeIndex >= eMax) return null;
      const A = pts[o.edgeIndex], B = pts[(o.edgeIndex + 1) % n];
      const ex = B[0] - A[0], ey = B[1] - A[1], len = Math.hypot(ex, ey);
      if (len < 1) return null;
      const ux = ex / len, uy = ey / len;
      const pos = Math.max(half, Math.min(len - half, o.pos));
      return {
        cx: A[0] + ux * pos, cy: A[1] + uy * pos, ux, uy,
        horiz: Math.abs(ux) >= Math.abs(uy), half,
        sill: Math.max(0, o.sill || 0), top: (o.sill || 0) + (o.h || 1200),
      };
    }
    const room = store.design.rooms.find((r) => r.id === o.roomId);
    if (!room) return null;
    const horiz = (o.side === 'n' || o.side === 's');
    const span = horiz ? room.w : room.d;
    const pos = Math.max(half, Math.min(span - half, o.pos));
    let cx, cy, ux, uy;
    if (o.side === 'n') { cx = room.x + pos; cy = room.y; ux = 1; uy = 0; }
    else if (o.side === 's') { cx = room.x + pos; cy = room.y + room.d; ux = 1; uy = 0; }
    else if (o.side === 'w') { cx = room.x; cy = room.y + pos; ux = 0; uy = 1; }
    else { cx = room.x + room.w; cy = room.y + pos; ux = 0; uy = 1; }
    return { cx, cy, ux, uy, horiz, half, sill: Math.max(0, o.sill || 0), top: (o.sill || 0) + (o.h || 1200) };
  }

  // 외곽 한 변(A→B, 중심원점 좌표) 위에 놓인 개구부들을 _wallRects 형식으로 수집
  _edgeOpenings(A, dir, len, b, tol) {
    const TOL = tol || 300; // 방 벽과 외벽 사이 간격 허용치(mm)
    const edgeHoriz = Math.abs(dir[0]) >= Math.abs(dir[1]);
    const out = [];
    for (const o of (store.design.openings || [])) {
      const w = this._openingWorld(o); if (!w) continue;
      if (w.free) continue;               // 자유 배치 개구부는 벽을 뚫지 않음(독립)
      if (w.horiz !== edgeHoriz) continue; // 변 방향과 개구부 방향 일치
      const [pcx, pcz] = this._p(w.cx, w.cy, b);
      const vx = pcx - A[0], vz = pcz - A[1];
      const t = vx * dir[0] + vz * dir[1];               // 변을 따라간 위치
      const perp = Math.abs(-vx * dir[1] + vz * dir[0]); // 변과의 수직 거리
      if (perp > TOL) continue;
      if (t < -w.half || t > len + w.half) continue;
      const a = Math.max(0, t - w.half), c2 = Math.min(len, t + w.half);
      if (c2 - a < 1) continue;
      out.push({ a, c2, sill: w.sill, top: w.top });
    }
    return out.sort((p, q) => p.a - q.a);
  }

  // 외곽/외장 한 변을 개구부 자리를 비워(뚫어) 만든다 (내벽 _buildWall 과 동일 원리)
  //   opts.shift[dx,dz]: 개구부는 원래 벽선(A→B)에서 찾되, 벽 박스는 이만큼
  //     평행이동해 그림 → 외장재를 외벽 바깥면에 덧대면서도 창/문 구멍은 유지.
  //   opts.tol: 개구부 판정 허용 오차(외벽↔개구부 간격), opts.baseboard: 걸레받이.
  _buildCarvedEdge(A, B, wallH, T, ext, b, matFn, opts) {
    const dx = B[0] - A[0], dz = B[1] - A[1];
    const len = Math.hypot(dx, dz); if (len < 1) return;
    const ux = dx / len, uz = dz / len;
    const sx = (opts && opts.shift) ? opts.shift[0] : 0;
    const sz = (opts && opts.shift) ? opts.shift[1] : 0;
    const ops = this._edgeOpenings(A, [ux, uz], len, b, opts && opts.tol);
    const extA = (opts && opts.extA != null) ? opts.extA : ext;   // 밴드 구간이면 끝 연장을 따로 지정
    const extB = (opts && opts.extB != null) ? opts.extB : ext;
    const rects = this._wallRects(len, ops, wallH, extA, extB);
    const ang = -Math.atan2(dz, dx);
    for (const [a, bEnd, yLo, yHi] of rects) {
      const segLen = bEnd - a, h = yHi - yLo;
      if (segLen < 1 || h < 1) continue;
      const mid = (a + bEnd) / 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(segLen, h, T), matFn(segLen, h));
      m.position.set(A[0] + ux * mid + sx, (yLo + yHi) / 2, A[1] + uz * mid + sz);
      m.rotation.y = ang;
      m.castShadow = true; m.receiveShadow = true;
      if (opts && opts.userData) m.userData = { ...opts.userData };   // 면별 외장재 클릭 식별
      this.modelGroup.add(m);
      // 걸레받이(바닥 몰딩) — 바닥에 닿는 벽 하단(문 개구부 자리는 rect가 없어 자동으로 비워짐)
      if (opts && opts.baseboard && yLo < 80) {
        const bb = new THREE.Mesh(new THREE.BoxGeometry(segLen, 90, T + 24), this._baseboardMat());
        bb.position.set(A[0] + ux * mid + sx, 105, A[1] + uz * mid + sz);
        bb.rotation.y = ang; bb.receiveShadow = true;
        this.modelGroup.add(bb);
      }
    }
  }

  // 집 외곽(외벽) — 각 경로의 변에 벽 (+ 닫힌 경로면 바닥). 여러 외벽 누적 지원
  _buildOutline(d, b, ceilH) {
    const H = ceilH, T = d.wallThickness || 150;
    const wallMat = this._wallMat();
    for (const { pts, closed } of outlineShapes(d.outline)) {
      const P = pts.map((p) => this._p(p[0], p[1], b));
      const n = P.length;
      for (let i = 0; i < (closed ? n : n - 1); i++) {
        const a = P[i], c = P[(i + 1) % n];
        this._buildCarvedEdge(a, c, H, T, T / 2, b, () => wallMat); // 창/문 자리는 비워 둠
      }
      if (closed && n >= 3) {
        const shape = new THREE.Shape();
        P.forEach((p, i) => (i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1])));
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        // ShapeGeometry UV(=mm 좌표)를 bbox 0..1 로 정규화 → 강화마루 판재가 자연스럽게 반복
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        const sx = Math.max(1, bb.max.x - bb.min.x), sy = Math.max(1, bb.max.y - bb.min.y);
        const uv = geo.attributes.uv, pos = geo.attributes.position;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (pos.getX(k) - bb.min.x) / sx, (pos.getY(k) - bb.min.y) / sy);
        uv.needsUpdate = true;
        const floorMat = TEX.floorMaterial('living', '#caa877', sx, sy); // 강화마루(오크)
        floorMat.side = THREE.DoubleSide;   // 회전 후 위에서도 보이도록 양면 렌더
        const floor = new THREE.Mesh(geo, floorMat);
        floor.rotation.x = Math.PI / 2;
        floor.position.y = 20;
        floor.receiveShadow = true;
        this.modelGroup.add(floor);
      }
    }
  }

  // 외장재: 외곽(outline)이 있으면 그 둘레를, 없으면 방 외벽에 마감을 입힘
  _buildExterior(d, b, ceilH) {
    const ex = d.exterior || {};
    const baseMat = ex.material || 'cement';
    const mDef = EXTERIOR_MATERIALS[baseMat] || EXTERIOR_MATERIALS.cement;
    const col = ex.color || mDef.color;
    const faces = d.exteriorFaces || {};    // 면별 외장재 오버라이드 { "p0e2": {material,color} }
    const T = 120;            // 벽 바깥에 덧대는 외장 마감 두께
    const EPS = 60;           // 벽 바로 바깥 지점으로 외곽 여부 판정

    // 집 외곽(다각형/열린벽)이 있으면 각 경로의 변에 외장 마감
    const oshapes = outlineShapes(d.outline);
    if (oshapes.length) {
      const H = ceilH + 120;
      // 외장재는 외벽 '바깥면'에 덧대야 한다. 외벽선 위에 겹쳐 그리면 두 벽이
      //   같은 자리에 겹쳐 z-fighting(깜빡임·얼룩)으로 지저분해진다. 각 변을
      //   바깥 법선 방향으로 (외벽두께/2 + 마감두께/2)만큼 밀어 겹치지 않게 함.
      const off = (d.wallThickness || 150) / 2 + T / 2;
      oshapes.forEach(({ pts, closed }, pi) => {
        const P = pts.map((p) => this._p(p[0], p[1], b));
        const n = P.length;
        let cxs = 0, czs = 0; for (const p of P) { cxs += p[0]; czs += p[1]; } cxs /= n; czs /= n;
        for (let i = 0; i < (closed ? n : n - 1); i++) {
          const a = P[i], c = P[(i + 1) % n];
          const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz) || 1;
          let nx = dz / len, nz = -dx / len;                       // 변의 수직
          const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
          if ((mx - cxs) * nx + (mz - czs) * nz < 0) { nx = -nx; nz = -nz; } // 중심 반대(=바깥)로
          // 면별 외장재 — 오버라이드가 있으면 그 재질/색, 없으면 기본 외장재.
          //   '띠'는 덧붙이지 않고, 같은 평면(off)에서 변을 구간별로 잘라 색만 다르게 칠한다
          //   → 기본 외장재 위에 판을 겹쳐 붙이지 않으므로 두께 없이 자연스럽게 색만 바뀜.
          const key = 'p' + pi + 'e' + i;
          const fo = faces[key];
          const baseFMat = (fo && fo.material) || baseMat;   // 면 전체 기본(부분 띠가 아닌 영역)
          const baseFCol = (fo && fo.color) || null;
          // 유효한 띠들(정렬·클램프)
          const bands = (fo && Array.isArray(fo.bands) ? fo.bands : [])
            .map((bd) => ({ u0: Math.max(0, Math.min(1, Math.min(bd.u0, bd.u1))), u1: Math.max(0, Math.min(1, Math.max(bd.u0, bd.u1))), material: bd.material, color: bd.color }))
            .filter((bd) => bd.u1 - bd.u0 > 0.004);
          // 변을 밴드 경계로 잘라 구간 목록 생성
          const cutSet = new Set([0, 1]);
          for (const bd of bands) { cutSet.add(Math.round(bd.u0 * 1e4) / 1e4); cutSet.add(Math.round(bd.u1 * 1e4) / 1e4); }
          const cuts = [...cutSet].sort((p, q) => p - q);
          for (let s = 0; s < cuts.length - 1; s++) {
            const ua = cuts[s], ub = cuts[s + 1]; if (ub - ua < 0.002) continue;
            const umid = (ua + ub) / 2;
            // 이 구간을 덮는 띠(나중에 칠한 것 우선) → 없으면 면 기본
            const cover = [...bands].reverse().find((bd) => umid >= bd.u0 && umid <= bd.u1);
            const segMat = cover ? (cover.material || baseMat) : baseFMat;
            const sDef = EXTERIOR_MATERIALS[segMat] || mDef;
            const segCol = cover ? (cover.color || sDef.color) : (baseFCol || sDef.color);
            const A2 = [a[0] + (c[0] - a[0]) * ua, a[1] + (c[1] - a[1]) * ua];
            const C2 = [a[0] + (c[0] - a[0]) * ub, a[1] + (c[1] - a[1]) * ub];
            // 개구부는 '원래 외벽선'에서 찾고 마감 박스만 off 만큼 평행이동 → 겹침 없이 창/문 구멍 유지.
            //   구간 이음매(내부 경계)는 끝 연장 0, 진짜 모서리(0/1)만 T 만큼 연장해 코너를 메움.
            this._buildCarvedEdge(A2, C2, H, T, 0, b,
              (segLen, h) => TEX.exteriorMaterial(segMat, segCol, segLen, h, sDef.roughness, sDef.metalness, ex.dir),
              { shift: [nx * off, nz * off], tol: off + 350, userData: { extFace: key },
                extA: ua <= 0.0001 ? T : 0, extB: ub >= 0.9999 ? T : 0 });
          }
        }
      });
      this._buildCornerTrims(d, b, H, off + T / 2);
      return;
    }

    // 발코니(개방)는 외벽이 없으므로 외곽 판정 대상에서 제외
    const rooms = d.rooms.filter((r) => !OPEN_ROOM_TYPES.includes(r.type));
    const inAnyRoom = (x, y) => rooms.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.d);

    const mat = (len, h) => TEX.exteriorMaterial(ex.material, col, len, h, mDef.roughness, mDef.metalness, ex.dir);
    // 한 외벽에 외장 마감을 입힘 — 창/문 개구부 자리는 비워(뚫어) 둠
    const cladEdge = (r, side, wallH) => {
      const [px, pz] = this._p(r.x, r.y, b);
      const horiz = (side === 'n' || side === 's');
      const L = horiz ? r.w : r.d;
      const ops = this._collectOps(r, side, L);
      const rects = this._wallRects(L, ops, wallH, T); // 끝을 T 늘려 모서리 메움
      for (const [a, bEnd, yLo, yHi] of rects) {
        const len = bEnd - a, h = yHi - yLo;
        if (len < 1 || h < 1) continue;
        let cx, cz, w, dep;
        if (horiz) { cx = px + (a + bEnd) / 2; cz = (side === 'n') ? pz - T / 2 : pz + r.d + T / 2; w = len; dep = T; }
        else       { cz = pz + (a + bEnd) / 2; cx = (side === 'w') ? px - T / 2 : px + r.w + T / 2; w = T; dep = len; }
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), mat(len, h));
        m.position.set(cx, (yLo + yHi) / 2, cz); m.castShadow = true; m.receiveShadow = true;
        this.modelGroup.add(m);
      }
    };

    for (const r of rooms) {
      const open = Array.isArray(r.open) ? r.open : [];
      const wallH = r.type === 'attic' ? ATTIC_HEIGHT : ceilH;
      const cx = r.x + r.w / 2, cz = r.y + r.d / 2;
      // 바깥(다른 방이 없는 쪽)에 면하고 트지 않은 벽에만 외장 적용
      if (!open.includes('n') && !inAnyRoom(cx, r.y - EPS)) cladEdge(r, 'n', wallH);
      if (!open.includes('s') && !inAnyRoom(cx, r.y + r.d + EPS)) cladEdge(r, 's', wallH);
      if (!open.includes('w') && !inAnyRoom(r.x - EPS, cz)) cladEdge(r, 'w', wallH);
      if (!open.includes('e') && !inAnyRoom(r.x + r.w + EPS, cz)) cladEdge(r, 'e', wallH);
    }
    this._buildCornerTrims(d, b, ceilH, T);
  }

  // 기초 — 실내(벽 있는) 공간 아래는 콘크리트 기초, 데크·포치 아래는 회색 세로 판재 하부 마감(스커트)
  //   F: 기초 높이(mm). 지면(-2)부터 F 까지 채움.
  _buildFoundation(d, b, F) {
    const add = (m) => { m.castShadow = true; m.receiveShadow = true; this.modelGroup.add(m); };
    const H = F + 2;
    // 콘크리트 기초: 벽 바깥면에서 20mm 안쪽으로 (외장재가 기초 위에 살짝 걸쳐 보이게)
    const shapes = outlineShapes(d.outline);
    const hasOutline = shapes.length > 0;
    const off = (this.showExterior ? (hasOutline ? (d.wallThickness || 150) / 2 + 120 : 120) : (hasOutline ? (d.wallThickness || 150) / 2 : WALL_T / 2)) - 20;
    // 외곽선(집 footprint)이 있으면 그 모양 그대로 기초를 만든다 — 건물마다 따로, 데크 틈은 비움.
    //   (예전엔 전체 바운딩 사각형 하나라 쌍둥이/L자 모양에서 이상하게 넓게 깔렸음)
    const builtShaped = hasOutline && shapes.some((s) => s.closed && s.pts.length >= 3);
    if (builtShaped) {
      for (const { pts, closed } of shapes) {
        if (!closed || pts.length < 3) continue;
        const P = pts.map((p) => this._p(p[0], p[1], b));
        let cx = 0, cz = 0; for (const q of P) { cx += q[0]; cz += q[1]; } cx /= P.length; cz /= P.length;
        const shape = new THREE.Shape();
        let minx = Infinity, maxx = -Infinity;
        P.forEach((q, i) => {
          const dx = q[0] - cx, dz = q[1] - cz, len = Math.hypot(dx, dz) || 1;   // 중심 반대(바깥)로 off 만큼 확장
          const ox = q[0] + dx / len * off, oz = q[1] + dz / len * off;
          minx = Math.min(minx, ox); maxx = Math.max(maxx, ox);
          if (i) shape.lineTo(ox, -oz); else shape.moveTo(ox, -oz);   // Shape 의 y = 월드 -z (회전 후 원위치)
        });
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false });
        const mesh = new THREE.Mesh(geo, TEX.concreteMaterial(Math.max(1, maxx - minx), H));
        mesh.rotation.x = -Math.PI / 2; mesh.position.y = -2;   // 지면(-2)부터 위로 F
        add(mesh);
      }
    } else {
      const fb = this._roofBounds(d, b);
      const w = fb.w + off * 2, dd = fb.h + off * 2;
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, H, dd), TEX.concreteMaterial(w, H));
      base.position.set(fb.cx - b.cx, H / 2 - 2, fb.cz - b.cz);
      add(base);
    }
    // 데크·포치·발코니 하부 스커트
    for (const r of d.rooms) {
      if (!OPEN_ROOM_TYPES.includes(r.type)) continue;
      const [px, pz] = this._p(r.x, r.y, b);
      const m = new THREE.Mesh(new THREE.BoxGeometry(r.w, H, r.d),
        TEX.exteriorMaterial('wood', '#8e959c', Math.max(r.w, r.d), H, 0.8, 0));
      m.position.set(px + r.w / 2, H / 2 - 2, pz + r.d / 2);
      add(m);
    }
  }

  // 외벽 모서리 포인트 — exterior.corner 색이 있으면 집 네 모서리를 ㄱ자로 감싸는 진한 패널(폭 420)
  //   (세움 시공 사진: 우드톤 세로 사이딩 + 차콜 모서리). outFace: 외장 바깥면까지의 거리(벽선 기준)
  _buildCornerTrims(d, b, H, outFace) {
    const ex = d.exterior || {};
    if (!ex.corner) return;
    const def = EXTERIOR_MATERIALS[ex.material] || EXTERIOR_MATERIALS.metal;
    const fb = this._roofBounds(d, b);
    const CW = 420, T = 40;   // 모서리 패널 폭, 외장 바깥면에 덧대는 두께
    const x0 = fb.minX - b.cx - outFace, x1 = fb.maxX - b.cx + outFace;
    const z0 = fb.minY - b.cz - outFace, z1 = fb.maxY - b.cz + outFace;
    const mat = () => TEX.exteriorMaterial(ex.material || 'metal', ex.corner, CW, H, def.roughness, def.metalness, ex.dir);
    for (const [cx, cz, sx, sz] of [[x0, z0, 1, 1], [x1, z0, -1, 1], [x0, z1, 1, -1], [x1, z1, -1, -1]]) {
      // x 방향 면(북·남 벽)에 붙는 판 + z 방향 면(동·서 벽)에 붙는 판
      const a = new THREE.Mesh(new THREE.BoxGeometry(CW, H, T), mat());
      a.position.set(cx + sx * (CW / 2 - T), H / 2, cz - sz * T / 2);
      const c = new THREE.Mesh(new THREE.BoxGeometry(T, H, CW), mat());
      c.position.set(cx - sx * T / 2, H / 2, cz + sz * (CW / 2 - T));
      for (const m of [a, c]) { m.castShadow = true; m.receiveShadow = true; this.modelGroup.add(m); }
    }
  }

  // 지붕: 형태별 생성 (평지붕/박공/비대칭박공/우진각/외쪽)
  //   실제 시공처럼 — 두께 있는 지붕판 + 벽 밖으로 내민 처마 + 처마 끝 마감판(파사드)·처마 밑면(소핏)
  //   + 물받이 + 박공 삼각 벽면(외장재) + 용마루 캡. 용마루는 기존과 같이 Z(도면 세로) 방향.
  // 건물(외곽선 경로)별로 지붕을 따로 그린다 — 경로마다 roof 를 지정하면 그 형태로,
  //   없으면 공통 d.roof 로. 외곽선이 없으면 벽 있는 방 전체에 지붕 1개.
  //   예) 6평동=평지붕, 4평동=박공 처럼 건물마다 다른 지붕 지원.
  _buildRoof(d, b, ceilH) {
    const shapes = outlineShapes(d.outline);
    const paths = (d.outline && Array.isArray(d.outline.paths)) ? d.outline.paths : [];
    const closed = shapes.filter((s) => s.closed);
    if (closed.length >= 1) {
      shapes.forEach((sh, i) => {
        if (!sh.closed) return;
        const spec = (paths[i] && paths[i].roof) || d.roof || {};
        this._buildOneRoof(d, b, ceilH, this._ptsBounds(sh.pts, b), spec);
      });
    } else {
      this._buildOneRoof(d, b, ceilH, this._roofBounds(d, b), d.roof || {});
    }
    this._buildPorchRoofs(d, b, ceilH, this._roofBounds(d, b), (d.roof && d.roof.color) || '#3a3f44');
  }

  // 점 배열의 경계 상자 (지붕 한 채가 덮을 범위)
  _ptsBounds(pts, b) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    if (!isFinite(minX)) return this._roofBounds({ rooms: [] }, b);
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cz: (minY + maxY) / 2 };
  }

  // 지붕 한 채 그리기 — fb(범위), roofSpec({type,color,rise,ridge})
  _buildOneRoof(d, b, ceilH, fb, roofSpec) {
    const roof = roofSpec || d.roof || { type: 'gable', color: '#3a3f44' };
    const type = ROOF_TYPES[roof.type] ? roof.type : 'gable';
    const rise = roof.rise > 0 ? roof.rise : ROOF_TYPES[type].rise;   // 도면별 지붕 높이(경사) 지정 가능
    const color = roof.color || '#3a3f44';
    // 용마루 방향: 'z'(도면 세로, 기본) | 'x'(도면 가로). 'x' 면 지붕을 z 기준으로 만든 뒤 90° 돌림
    const ridgeX = roof.ridge === 'x';
    const spanW = ridgeX ? fb.h : fb.w, spanL = ridgeX ? fb.w : fb.h;

    // 치수(mm) — 외벽 바깥면 기준
    // 외벽선 → 지금 보이는 벽 바깥면까지 거리. 박공 벽면이 벽면과 정확히 같은 면에 오도록
    //   (외곽선 도면은 벽두께/2 + 외장 120, 방만 있는 도면은 외장 120 / 외장 끄면 벽 반두께)
    const hasOutline = outlineShapes(d.outline).length > 0;
    const off = this.showExterior
      ? (hasOutline ? (d.wallThickness || 150) / 2 + 120 : 120)
      : (hasOutline ? (d.wallThickness || 150) / 2 : WALL_T / 2);
    const Sx = spanW / 2 + off, Sz = spanL / 2 + off;   // 외벽 바깥면까지 반폭 (Sx: 경사 방향, Sz: 용마루 방향)
    const E = 600;          // 처마 내밀기 (경사 아래쪽)
    const R = 400;          // 박공 쪽 내밀기
    const TH = roof.thickness > 0 ? roof.thickness : 180;   // 지붕판 두께(도면별 지정 가능)
    // 지붕이 얹히는 높이 = 지금 보이는 벽의 윗면. 외장재가 켜져 있으면 외장 윗면(+120),
    //   꺼져 있으면 내벽 윗면 — 예전엔 항상 +120 이라 외장을 끄면 벽과 지붕 사이가 벌어졌음
    //   (외곽선 도면의 외장만 벽보다 120 높게 올라감 — 방만 있는 도면의 외장은 벽 높이와 같음)
    const plateY = (this.showExterior && outlineShapes(d.outline).length) ? ceilH + 120 : ceilH;
    // 기존 도면과 같은 경사 유지: 예전엔 (반폭+750) 에 rise 만큼 올라갔음
    const k = type === 'shed' ? rise / (2 * (spanW / 2 + 750)) : rise / (spanW / 2 + 750);

    const roofMat = TEX.roofMaterial(color, 1500, 1500);   // UV 를 mm/1500 단위로 직접 넣으므로 반복 1
    const { trimMat, soffitMat } = this._roofTrimMats(roof);   // 파사드·물받이 / 처마 밑면
    const capMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), roughness: 0.5, metalness: 0.3 });
    const grp = new THREE.Group();
    grp.position.set(fb.cx - b.cx, plateY, fb.cz - b.cz);
    if (ridgeX) grp.rotation.y = Math.PI / 2;   // 로컬 z(용마루) → 월드 x
    const add = (m) => { m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
    // 경사 지붕판 좌표는 '밑면' 기준으로 계산 → 윗면은 두께만큼 위 (밑면이 벽 위에 얹힘)
    const L = (pts) => pts.map(([x, y, z]) => [x, y + TH, z]);

    // 박공·외벽 채움면 재질 (외장재가 켜져 있으면 외장재, 아니면 실내벽 재질)
    const ex = d.exterior || {};
    const exDef = EXTERIOR_MATERIALS[ex.material] || EXTERIOR_MATERIALS.cement;
    const fillMat = (len, h) => this.showExterior
      ? TEX.exteriorMaterial(ex.material || 'cement', ex.color || exDef.color, len, h, exDef.roughness, exDef.metalness, ex.dir)
      : this._wallMat();
    // 박공 삼각면 재질 — 지붕별 gableColor 지정 시 그 색으로(외장재 질감 유지), 없으면 외장과 동일
    const gableCol = roof.gableColor || null;
    const gableMat = (len, h) => {
      if (this.showExterior) return TEX.exteriorMaterial(ex.material || 'cement', gableCol || ex.color || exDef.color, len, h, exDef.roughness, exDef.metalness, ex.dir);
      return gableCol ? new THREE.MeshStandardMaterial({ color: gableCol, roughness: 0.85 }) : this._wallMat();
    };
    // 박공 끝(z = ±Sz) 에 다각형 벽면 — pts: [x, y] (y 는 plate 기준)
    const gableFill = (pts) => {
      const sh = new THREE.Shape();
      pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
      sh.closePath();
      const hMax = Math.max(...pts.map((p) => p[1]));
      for (const zs of [-1, 1]) {
        const geo = new THREE.ExtrudeGeometry(sh, { depth: 120, bevelEnabled: false });
        geo.translate(0, 0, -60);
        this._planarUV(geo, 2 * Sx, hMax);
        const m = add(new THREE.Mesh(geo, gableMat(2 * Sx, hMax)));
        m.position.z = zs * (Sz - 60);
      }
    };
    // 물받이 — 처마 끝선을 따라 (x,z)→(x,z) 구간, 높이 y
    const gutter = (x0, z0, x1, z1, y) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(len, 120, 110), trimMat));
      m.position.set((x0 + x1) / 2, y - 60, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    };

    if (type === 'flat') {
      // 평지붕: 얇은 슬래브 + 둘레 파라펫 느낌의 마감판
      const X = Sx + 300, Z = Sz + 300;
      add(this._roofSlab([[-X, 0, -Z], [X, 0, -Z], [X, 0, Z], [-X, 0, Z]], [1, 0, 0], TH + 60, roofMat, trimMat, soffitMat));
      grp.position.y = plateY + TH + 60;
    } else if (type === 'hip') {
      // 우진각(모임): 네 면이 모두 처마로 내려오고, 긴 쪽으로 용마루
      const X = Sx + E, Z = Sz + E, ye = -k * E, top = ye + k * Math.min(X, Z);
      let r0, r1;   // 용마루 양 끝
      if (Z >= X) { r0 = [0, top, -(Z - X)]; r1 = [0, top, Z - X]; }
      else        { r0 = [-(X - Z), top, 0]; r1 = [X - Z, top, 0]; }
      const A = [-X, ye, -Z], B = [X, ye, -Z], C = [X, ye, Z], D = [-X, ye, Z];
      if (Z >= X) {
        add(this._roofSlab(L([A, D, r1, r0]), [0, 0, 1], TH, roofMat, trimMat, soffitMat));   // 서
        add(this._roofSlab(L([C, B, r0, r1]), [0, 0, -1], TH, roofMat, trimMat, soffitMat));  // 동
        add(this._roofSlab(L([B, A, r0]), [-1, 0, 0], TH, roofMat, trimMat, soffitMat));      // 북
        add(this._roofSlab(L([D, C, r1]), [1, 0, 0], TH, roofMat, trimMat, soffitMat));       // 남
      } else {
        add(this._roofSlab(L([B, A, r0, r1]), [-1, 0, 0], TH, roofMat, trimMat, soffitMat));
        add(this._roofSlab(L([D, C, r1, r0]), [1, 0, 0], TH, roofMat, trimMat, soffitMat));
        add(this._roofSlab(L([A, D, r0]), [0, 0, 1], TH, roofMat, trimMat, soffitMat));
        add(this._roofSlab(L([C, B, r1]), [0, 0, -1], TH, roofMat, trimMat, soffitMat));
      }
      const rl = Math.hypot(r1[0] - r0[0], r1[2] - r0[2]);
      if (rl > 1) {
        const cap = add(new THREE.Mesh(new THREE.BoxGeometry(Z >= X ? 220 : rl + 220, 90, Z >= X ? rl + 220 : 220), capMat));
        cap.position.set(0, top + TH + 45, 0);
      }
      gutter(-X, -Z, X, -Z, ye); gutter(X, -Z, X, Z, ye); gutter(X, Z, -X, Z, ye); gutter(-X, Z, -X, -Z, ye);
    } else {
      // 박공 / 비대칭 박공 / 외쪽 — 경사면을 X 방향으로, 용마루는 Z 방향
      const Z = Sz + R;
      if (type === 'shed') {
        // 외쪽: 서쪽(-x)이 낮고 동쪽(+x)이 높은 한 면
        const hHigh = k * 2 * Sx;
        const x0 = -Sx - E, y0 = -k * E, x1 = Sx + 300, y1 = hHigh + k * 300;
        add(this._roofSlab(L([[x0, y0, -Z], [x0, y0, Z], [x1, y1, Z], [x1, y1, -Z]]), [0, 0, 1], TH, roofMat, trimMat, soffitMat));
        gableFill([[-Sx, 0], [Sx, 0], [Sx, hHigh]]);
        // 높은 쪽 외벽(동쪽) — plate 위 삼각 공간을 벽으로 막음
        const hw = add(new THREE.Mesh(new THREE.BoxGeometry(120, hHigh, 2 * Sz), fillMat(2 * Sz, hHigh)));
        hw.position.set(Sx - 60, hHigh / 2, 0);
        gutter(x0, -Z, x0, Z, y0);
      } else {
        const ridgeX = type === 'asymGable' ? -Sx + 2 * Sx * 0.32 : 0;
        const hR = k * Sx;                                   // 용마루 높이 (plate 기준, 지붕판 밑면)
        const kL = hR / (ridgeX + Sx), kR = hR / (Sx - ridgeX);   // 좌·우 경사 (비대칭이면 다름)
        const xl = -Sx - E, yl = -kL * E, xr = Sx + E, yr = -kR * E;
        add(this._roofSlab(L([[xl, yl, -Z], [xl, yl, Z], [ridgeX, hR, Z], [ridgeX, hR, -Z]]), [0, 0, 1], TH, roofMat, trimMat, soffitMat));
        add(this._roofSlab(L([[xr, yr, Z], [xr, yr, -Z], [ridgeX, hR, -Z], [ridgeX, hR, Z]]), [0, 0, -1], TH, roofMat, trimMat, soffitMat));
        gableFill([[-Sx, 0], [Sx, 0], [ridgeX, hR]]);
        const cap = add(new THREE.Mesh(new THREE.BoxGeometry(260, 110, 2 * Z + 40), capMat));
        cap.position.set(ridgeX, hR + TH + 40, 0);
        gutter(xl, -Z, xl, Z, yl); gutter(xr, -Z, xr, Z, yr);
      }
    }
    this.modelGroup.add(grp);
  }

  // 본 지붕이 덮을 범위 — 외곽선이 있으면 외곽선, 없으면 벽 있는 방(데크·포치 제외)의 범위
  _roofBounds(d, b) {
    const shapes = outlineShapes(d.outline);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (shapes.length) {
      for (const { pts } of shapes) for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    } else {
      for (const r of d.rooms) {
        if (OPEN_ROOM_TYPES.includes(r.type)) continue;
        minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.d);
      }
    }
    if (!isFinite(minX)) return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY, w: b.w, h: b.h, cx: b.cx, cz: b.cz };
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cz: (minY + maxY) / 2 };
  }

  // 포치 지붕 — 본채 벽에 붙은 낮은 외쪽 지붕(징크판넬 느낌) + 바깥 모서리 기둥
  //   본채에 닿은 변이 높고 바깥으로 갈수록 낮아짐. 본채와 떨어진 포치는 평평하게.
  _buildPorchRoofs(d, b, ceilH, fb, color) {
    const porches = d.rooms.filter((r) => r.type === 'porch');
    if (!porches.length) return;
    const roof = d.roof || {};
    const roofMat = TEX.roofMaterial(color, 1500, 1500);
    const { trimMat, soffitMat } = this._roofTrimMats(roof, true);   // 포치 천장: 기본 원목 루바
    const postMat = new THREE.MeshStandardMaterial({ color: roof.postColor || '#2a2c2f', roughness: 0.5, metalness: 0.4 });
    // 높은 쪽(본채 벽)·낮은 쪽 높이, 내밀기 — 본채 처마 밑으로 들어가도록 벽 윗면보다 낮게
    const TH = 100, hHigh = ceilH - 150, hLow = ceilH - 350, O = 300;
    const EPS = 30;
    for (const r of porches) {
      // 본채(지붕 범위)와 맞닿은 변 찾기 → 그쪽이 높은 쪽
      let side = null;
      if (Math.abs(r.y - fb.maxY) < EPS) side = 'n';
      else if (Math.abs(r.y + r.d - fb.minY) < EPS) side = 's';
      else if (Math.abs(r.x - fb.maxX) < EPS) side = 'w';
      else if (Math.abs(r.x + r.w - fb.minX) < EPS) side = 'e';
      const [px, pz] = this._p(r.x, r.y, b);
      const x0 = px - O, x1 = px + r.w + O, z0 = pz - O, z1 = pz + r.d + O;
      const hi = hHigh + TH, lo = side ? hLow + TH : hi;
      // 높이: 본채 쪽 변 = hi, 반대쪽 = lo (본채 쪽은 벽에 붙으므로 내밀기 없음)
      let top;
      if (side === 'n') top = [[x0, hi, pz], [x1, hi, pz], [x1, lo, z1], [x0, lo, z1]];
      else if (side === 's') top = [[x0, lo, z0], [x1, lo, z0], [x1, hi, pz + r.d], [x0, hi, pz + r.d]];
      else if (side === 'w') top = [[px, hi, z0], [x1, lo, z0], [x1, lo, z1], [px, hi, z1]];
      else if (side === 'e') top = [[x0, lo, z0], [px + r.w, hi, z0], [px + r.w, hi, z1], [x0, lo, z1]];
      else top = [[x0, hi, z0], [x1, hi, z0], [x1, hi, z1], [x0, hi, z1]];
      const eave = (side === 'n' || side === 's') ? [1, 0, 0] : [0, 0, 1];
      const slab = this._roofSlab(top, eave, TH, roofMat, trimMat, soffitMat);
      slab.castShadow = true; slab.receiveShadow = true;
      this.modelGroup.add(slab);
      // 천장 조명 — 매립 다운라이트 + 벽쪽 LED 간접조명 띠 (r.lights 가 켜진 포치만)
      if (r.lights) {
        // 천장(지붕판 밑면) 높이: 본채 쪽 hHigh → 바깥 hLow 로 선형
        const ceilAt = (x, z) => {
          if (!side) return hHigh;
          const t = side === 'n' ? (z - pz) / r.d : side === 's' ? (pz + r.d - z) / r.d
            : side === 'w' ? (x - px) / r.w : (px + r.w - x) / r.w;
          return hHigh + (hLow - hHigh) * Math.min(1, Math.max(0, t));
        };
        const lampMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 2.2 });
        const along = (side === 'n' || side === 's') ? r.w : r.d, across = (side === 'n' || side === 's') ? r.d : r.w;
        const nA = Math.max(2, Math.round(along / 1800));
        for (let i = 0; i < nA; i++) for (const f of [0.35, 0.8]) {
          const u = (i + 0.5) / nA * along, v = f * across;
          let x, z;
          if (side === 'n') { x = px + u; z = pz + v; } else if (side === 's') { x = px + u; z = pz + r.d - v; }
          else if (side === 'w') { x = px + v; z = pz + u; } else { x = px + r.w - v; z = pz + u; }
          const lamp = new THREE.Mesh(new THREE.CylinderGeometry(75, 75, 12, 20), lampMat);
          lamp.position.set(x, ceilAt(x, z) - 6, z);
          this.modelGroup.add(lamp);
        }
        // LED 띠 — 본채 벽을 따라 천장 바로 아래 (따뜻한 노란빛)
        if (side) {
          const ledMat = new THREE.MeshStandardMaterial({ color: '#ffd978', emissive: '#ffbe3c', emissiveIntensity: 2.5 });
          const len = along;
          const led = new THREE.Mesh(new THREE.BoxGeometry(side === 'n' || side === 's' ? len : 40, 30, side === 'n' || side === 's' ? 40 : len), ledMat);
          const lx = side === 'w' ? px + 40 : side === 'e' ? px + r.w - 40 : px + r.w / 2;
          const lz = side === 'n' ? pz + 40 : side === 's' ? pz + r.d - 40 : pz + r.d / 2;
          led.position.set(lx, hHigh - 20, lz);
          this.modelGroup.add(led);
        }
      }
      // 기둥 — 본채 반대쪽 변(들)을 따라 약 3m 간격, 100×100
      const postAt = (x, z, h) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(100, h, 100), postMat);
        m.position.set(x, h / 2, z); m.castShadow = true; this.modelGroup.add(m);
      };
      const inset = 150;
      const edgePosts = (ax, az, bx, bz) => {
        const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 3000));
        for (let i = 0; i <= n; i++) { const t = i / n; postAt(ax + (bx - ax) * t, az + (bz - az) * t, hLow); }
      };
      const L = px + inset, R = px + r.w - inset, N = pz + inset, S = pz + r.d - inset;
      if (side === 'n') edgePosts(L, S, R, S);
      else if (side === 's') edgePosts(L, N, R, N);
      else if (side === 'w') edgePosts(R, N, R, S);
      else if (side === 'e') edgePosts(L, N, L, S);
      else { edgePosts(L, N, R, N); edgePosts(L, S, R, S); }
    }
  }

  // 지붕 마감 재질 — roof.fascia: 처마 끝 마감판·물받이 색, roof.soffit: 처마 밑면('wood' = 원목 루바 또는 색)
  //   기본은 흰색(예전과 동일). woodDefault: 포치 천장처럼 지정이 없으면 원목 루바로
  _roofTrimMats(roof, woodDefault = false) {
    const trimMat = new THREE.MeshStandardMaterial({ color: roof.fascia || '#ebe8e1', roughness: 0.55, metalness: roof.fascia ? 0.35 : 0 });
    const s = roof.soffit || (woodDefault ? 'wood' : null);
    const soffitMat = s === 'wood' ? TEX.soffitWoodMaterial(roof.soffitColor || '#f2c48a')   // 밝은 소나무 루바
      : s ? new THREE.MeshStandardMaterial({ color: s, roughness: 0.7 }) : trimMat;
    return { trimMat, soffitMat };
  }

  // 난간 — 데크·포치의 room.rail: ['s','e'] 처럼 지정한 변을 따라 (높이 1,000, 세로 살 110 간격)
  //   살·기둥·손잡이를 한 덩어리 지오메트리로 합쳐 가볍게 (메시 수 폭증 방지)
  _buildRailings(d, b) {
    const H = 1000, FLOOR = 60;
    for (const r of d.rooms) {
      const sides = Array.isArray(r.rail) ? r.rail : [];
      if (!sides.length) continue;
      const [px, pz] = this._p(r.x, r.y, b);
      const parts = [];
      const box = (w, h, dd, x, y, z) => { const g = new THREE.BoxGeometry(w, h, dd); g.translate(x, y, z); parts.push(g); };
      const inset = 40;
      for (const s of sides) {
        let ax, az, bx, bz;
        if (s === 'n') { ax = px; az = pz + inset; bx = px + r.w; bz = az; }
        else if (s === 's') { ax = px; az = pz + r.d - inset; bx = px + r.w; bz = az; }
        else if (s === 'w') { ax = px + inset; az = pz; bx = ax; bz = pz + r.d; }
        else if (s === 'e') { ax = px + r.w - inset; az = pz; bx = ax; bz = pz + r.d; } else continue;
        const len = Math.hypot(bx - ax, bz - az), horiz = az === bz;
        const at = (t) => [ax + (bx - ax) * t, az + (bz - az) * t];
        // 손잡이(윗 난간) + 아래 가로대
        const [mx, mz] = at(0.5);
        box(horiz ? len : 60, 50, horiz ? 60 : len, mx, FLOOR + H - 25, mz);
        box(horiz ? len : 40, 40, horiz ? 40 : len, mx, FLOOR + 120, mz);
        // 기둥 약 1.5m 간격
        const nP = Math.max(1, Math.round(len / 1500));
        for (let i = 0; i <= nP; i++) { const [x, z] = at(i / nP); box(60, H, 60, x, FLOOR + H / 2, z); }
        // 세로 살
        const nB = Math.floor(len / 110);
        for (let i = 1; i < nB; i++) { const [x, z] = at(i / nB); box(25, H - 170, 25, x, FLOOR + 140 + (H - 170) / 2 - 20, z); }
      }
      if (!parts.length) continue;
      const geo = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: r.railColor || '#6f757b', roughness: 0.5, metalness: 0.4 }));
      m.castShadow = true; m.receiveShadow = true;
      this.modelGroup.add(m);
    }
  }

  // 실내 아트월 — room.artWall: ['e','w'] 처럼 지정한 벽 안쪽에 세로 루버(템바보드) 패널
  _buildArtWalls(room, b, wallH) {
    const sides = Array.isArray(room.artWall) ? room.artWall : [];
    if (!sides.length) return;
    const [px, pz] = this._p(room.x, room.y, b);
    const T = 24, gap = WALL_T / 2 + T / 2 + 2, h = wallH - 40;
    for (const s of sides) {
      const horiz = s === 'n' || s === 's';
      const len = (horiz ? room.w : room.d) - WALL_T;
      const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : T, h, horiz ? T : len), TEX.slatMaterial(room.artColor || '#d8c3a5', len, h));
      const x = s === 'w' ? px + gap : s === 'e' ? px + room.w - gap : px + room.w / 2;
      const z = s === 'n' ? pz + gap : s === 's' ? pz + room.d - gap : pz + room.d / 2;
      m.position.set(x, 60 + h / 2, z);
      m.receiveShadow = true;
      this.modelGroup.add(m);
    }
  }

  // 두께 있는 지붕판 1장 — top: 윗면 다각형(볼록, 월드 좌표 [x,y,z]), eaveDir: 처마선 방향(기와 줄 방향),
  //   th: 두께(수직). 윗면 = 기와/슁글, 밑면·옆면 = 마감판(소핏·파사드). 기와 줄이 처마와 나란하도록 UV 계산.
  _roofSlab(top, eaveDir, th, topMat, sideMat, bottomMat = sideMat) {
    const V = top.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    // 윗면 법선이 위를 향하도록 정점 순서 정리
    const nrm = new THREE.Vector3().subVectors(V[1], V[0]).cross(new THREE.Vector3().subVectors(V[2], V[0]));
    if (nrm.y < 0) V.reverse();
    const n = V.length;
    const Bv = V.map((p) => new THREE.Vector3(p.x, p.y - th, p.z));
    const e = new THREE.Vector3(eaveDir[0], eaveDir[1], eaveDir[2]).normalize();
    // 경사 오르막 방향(면 위에서 처마선에 수직)
    const faceN = new THREE.Vector3().subVectors(V[1], V[0]).cross(new THREE.Vector3().subVectors(V[2], V[0])).normalize();
    const up = new THREE.Vector3().crossVectors(faceN, e).normalize();
    if (up.y < 0) up.negate();
    const pos = [], uv = [];
    const push = (p, u, v) => { pos.push(p.x, p.y, p.z); uv.push(u, v); };
    const T = 1500;   // 텍스처 1장 = 1500mm
    // 윗면 (부채꼴 삼각형)
    for (let i = 1; i < n - 1; i++) for (const p of [V[0], V[i], V[i + 1]]) push(p, p.dot(e) / T, p.dot(up) / T);
    const topCount = pos.length / 3;
    // 밑면 (반대 방향) — 처마 밑면(소핏)·포치 천장. 루바 판재가 처마선과 나란하도록 UV
    for (let i = 1; i < n - 1; i++) for (const p of [Bv[0], Bv[i + 1], Bv[i]]) push(p, p.dot(e) / T, p.dot(up) / T);
    const botCount = pos.length / 3 - topCount;
    // 옆면 (처마 끝 마감판)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      for (const p of [V[i], Bv[i], Bv[j], V[i], Bv[j], V[j]]) push(p, 0, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.addGroup(0, topCount, 0);
    geo.addGroup(topCount, botCount, 2);
    geo.addGroup(topCount + botCount, pos.length / 3 - topCount - botCount, 1);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, [topMat, sideMat, bottomMat]);
  }

  // 평면(XY) 도형의 UV 를 0..1 로 — 외장재 텍스처 반복(len×h 기준)이 맞게 들어가도록
  _planarUV(geo, w, h) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox, pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / (w || 1), (pos.getY(i) - bb.min.y) / (h || 1));
    uv.needsUpdate = true;
  }

  // 가구 그룹 등록 — 3D에서 클릭·드래그로 잡을 수 있게 모든 부품에 가구 id 표시,
  //   선택된 가구는 바닥에 빨간 테두리 판으로 강조
  _addFurniture(g, f) {
    g.traverse((o) => { o.userData.furnId = f.id; });
    if (store.selectedFurniture === f.id) {
      const bb = new THREE.Box3().setFromObject(g);
      const w = bb.max.x - bb.min.x + 120, dd = bb.max.z - bb.min.z + 120;
      const ring = new THREE.Mesh(new THREE.BoxGeometry(w, 20, dd),
        new THREE.MeshStandardMaterial({ color: '#c8102e', transparent: true, opacity: 0.35, depthWrite: false }));
      ring.position.set((bb.min.x + bb.max.x) / 2, 70, (bb.min.z + bb.max.z) / 2);
      ring.userData.furnId = f.id;
      this.modelGroup.add(ring);
    }
    this.modelGroup.add(g);
  }

  _buildFurniture(f, b, ceilH = 2400) {
    const c0 = catalogOf(f.catalogId); if (!c0) return;
    const c = f.color ? { ...c0, color: f.color } : c0;   // 제품별 색상 변경(f.color) — 주 색상만 바꾸고 부속(다리·손잡이 등)은 유지
    let [px, pz] = this._p(f.x, f.y, b);
    // 벽부착 제품(외부 벽등·콘센트): 외장 마감 '바깥면' 앞으로 확실히 내밀어 가려지지 않게
    if (c0.wallMount && Array.isArray(f.wallNormal) && this.showExterior) {
      const cladOuter = (store.design.wallThickness || 150) / 2 + 120;  // 벽중심→외장 마감 바깥면(마감두께 120)
      const dEff = (f.d || c0.d || 100);                                // 제품 깊이(스케일 반영값)
      const extra = cladOuter + dEff / 2 + 20;                          // 제품 뒷면이 마감면 바로 앞에 붙게
      px += f.wallNormal[0] * extra; pz += f.wallNormal[1] * extra;
    }
    const g = new THREE.Group();
    // 벽걸이 제품(상부장·후드)은 설치 높이(elev)만큼 띄움 — 제품별로 바꿀 수 있음(f.elev)
    g.position.set(px, 60 + (f.elev != null ? f.elev : (c0.elev || 0)), pz);
    g.rotation.y = -(f.rotation || 0) * Math.PI / 180;
    // 개별 크기 조절(W/D/H) 반영 — 카탈로그 대비 비율로 스케일 (실링팬은 천장 높이에 붙으므로 높이 제외)
    // 실링팬·데크계단은 높이를 기하에서 직접 처리 → Y 스케일 제외(계단이 뜨거나 파묻히지 않게)
    const noYScale = c.id === 'ceilfan' || c.kind === 'decksteps';
    g.scale.set((f.w || c.w) / c.w, noYScale ? 1 : (f.h || c.h) / c.h, (f.d || c.d) / c.d);
    const mat = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 });
    // finish: 'fabric'|'wood' → 질감 텍스처, 그 외(undefined) → 단색
    const finMat = (col, w, dd, finish) => {
      const tx = finish ? TEX.furnitureMaterial(finish, col, w, dd) : null;
      return tx || mat(col);
    };

    const addBox = (w, h, dd, y, col, z = 0, x = 0, finish) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), finMat(col, w, dd, finish));
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      g.add(m); return m;
    };

    // 모서리 둥근 박스 — 매트리스·이불·베개 등 푹신한 오브젝트에 사용
    const addRounded = (w, h, dd, y, col, z = 0, x = 0, finish, radius) => {
      const r = Math.max(2, Math.min(radius != null ? radius : 40, Math.min(w, h, dd) / 2 - 1));
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, dd, 4, r), finMat(col, w, dd, finish));
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      g.add(m); return m;
    };

    const addCyl = (r, h, y, col, z = 0, x = 0, seg = 20) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat(col));
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
    };

    // 수납 가구(옷장/책장/화장대)는 원목 결, 그 외 box(가전·욕실)는 단색
    const woodBox = ['wardrobe', 'shelf', 'dresser'].includes(c.id);
    // 주방 가구 문짝 구분선 — 약 450mm 폭으로 나눈 세로 줄 + 손잡이 홈(가로 줄). front: 앞면 z
    const cabDoors = (w, h, y0, front) => {
      const n = Math.max(1, Math.round(w / 450));
      for (let i = 1; i < n; i++) addBox(4, h - 20, 3, y0 + h / 2, '#c9ccd0', front + 1, -w / 2 + (w / n) * i);
      addBox(w - 20, 6, 3, y0 + h - 30, '#c9ccd0', front + 1);
    };

    // 설비·가전·욕실은 id 별 전용 3D 모양 (밋밋한 박스 대신). 없으면 아래 kind 로.
    const fixture = () => {
      switch (c.id) {
        case 'toilet': {
          addBox(c.w, 120, c.d * 0.5, 60, c.color, c.d * 0.22);            // 바닥받침
          addBox(c.w, 380, c.d * 0.62, 250, c.color, c.d * 0.13);          // 변기 몸통
          addBox(c.w, 60, c.d * 0.62, 470, '#dfe3e5', c.d * 0.13);         // 시트
          addBox(c.w, 430, 180, 265, c.color, -c.d / 2 + 90);             // 물탱크
          return true;
        }
        case 'basin': {
          addBox(200, 620, 220, 310, c.color, c.d * 0.06);                // 받침대
          addBox(c.w, 150, c.d, 785, c.color);                            // 세면 상판
          addBox(c.w * 0.66, 70, c.d * 0.66, 730, '#dfe6ea');             // 볼 안쪽
          addCyl(16, 150, 900, '#c9ced3', -c.d / 2 + 90);                // 수전
          return true;
        }
        case 'bathtub': {
          addBox(c.w, c.h, c.d, c.h / 2, c.color);                        // 욕조 외형
          addBox(c.w - 180, 120, c.d - 180, c.h - 30, '#e0ebef');         // 안쪽 물칸(연한색)
          return true;
        }
        case 'sink': case 'sink18': case 'sinkwf': case 'cooktop': {
          addBox(c.w, c.h - 60, c.d, (c.h - 60) / 2, c.color, 0, 0, c.id === 'cooktop' ? 'wood' : undefined); // 하부장
          if (c.id !== 'cooktop') cabDoors(c.w, c.h - 60 - 100, 100, c.d / 2);   // 문짝 구분선
          addBox(c.w, 60, c.d, c.h - 30, c.id === 'cooktop' ? '#3a3d42' : '#f7f7f5');   // 상판(싱크대는 흰 인조대리석)
          if (c.id !== 'cooktop') {
            addBox(c.w * 0.3, 46, c.d * 0.62, c.h - 8, '#c7ccd0', 0, c.w * 0.26); // 싱크볼 테두리
            addCyl(15, 230, c.h + 95, '#b9bec3', -c.d / 2 + 130, c.w * 0.26);     // 수전
          }
          return true;
        }
        case 'induction': case 'induction2': {
          addBox(c.w, 60, c.d, 40, '#26292d');                            // 검정 유리 상판
          const bs = c.id === 'induction'
            ? [[-c.w * 0.22, -c.d * 0.18], [c.w * 0.22, -c.d * 0.18], [-c.w * 0.22, c.d * 0.18], [c.w * 0.22, c.d * 0.18]]
            : [[-c.w * 0.2, 0], [c.w * 0.2, 0]];
          for (const [ux, uz] of bs) addCyl(Math.min(c.w, c.d) * 0.16, 4, 74, '#43474c', uz, ux);
          return true;
        }
        case 'fridge': {
          addBox(c.w, c.h, c.d, c.h / 2, c.color);                        // 몸통
          addBox(c.w, 14, c.d, c.h * 0.42, '#b7bdc1', c.d / 2 - 7);       // 냉동/냉장 구분선
          addBox(44, c.h * 0.9, 32, c.h / 2, '#aeb4b8', c.d / 2 - 16, -c.w / 2 + 70); // 손잡이
          return true;
        }
        case 'washer': {
          addBox(c.w, c.h, c.d, c.h / 2, c.color);                        // 몸통
          const dr = new THREE.Mesh(new THREE.CylinderGeometry(c.h * 0.3, c.h * 0.3, 40, 24), mat('#9aa6ad'));
          dr.rotation.x = Math.PI / 2; dr.position.set(0, c.h * 0.5, c.d / 2 - 12); dr.castShadow = true; g.add(dr);
          return true;
        }
        case 'stairs': {
          const steps = 12, rise = c.h / steps, run = c.d / steps;
          for (let i = 0; i < steps; i++) addBox(c.w, rise, c.d - run * i, rise / 2 + rise * i, c.color, run * i / 2); // 오르는 계단
          return true;
        }
        case 'railing': {
          addBox(c.w, 50, c.d, c.h - 25, c.color);                        // 상단 손잡이 바
          const posts = Math.max(2, Math.round(c.w / 350));
          for (let i = 0; i <= posts; i++) addBox(45, c.h, c.d, c.h / 2, c.color, 0, -c.w / 2 + (c.w / posts) * i); // 기둥
          return true;
        }
        case 'ceilfan': {
          const y = ceilH - 60 - 120;                                     // 천장 근처 (그룹이 y=60)
          addBox(30, 120, 30, y + 95, '#9aa0a8');                         // 다운로드(봉)
          addCyl(120, 110, y, '#d7d2c8');                                 // 모터 몸통(넉넉하게)
          addCyl(70, 60, y - 90, '#e9e6df');                             // 아래 등커버(조명)
          for (let k = 0; k < 5; k++) {                                   // 날개 5장, 넓게
            const bl = new THREE.Mesh(new THREE.BoxGeometry(c.w * 0.44, 22, 230), mat('#c8ad82'));
            bl.geometry.translate(c.w * 0.27, 0, 0);
            bl.position.set(0, y - 10, 0); bl.rotation.y = k * (Math.PI * 2 / 5); bl.castShadow = true; g.add(bl);
          }
          return true;
        }
        case 'faucet': {
          addCyl(22, 40, 20, c.color);
          addCyl(11, 170, 105, c.color);
          return true;
        }
        default: return false;
      }
    };
    if (fixture()) { this._addFurniture(g, f); return; }

    switch (c.kind) {
      case 'sofa': {
        addBox(c.w, c.h * 0.45, c.d, c.h * 0.225, c.color, 0, 0, 'fabric');            // 좌석
        addBox(c.w, c.h * 0.7, c.d * 0.25, c.h * 0.35, c.color, -c.d * 0.37, 0, 'fabric'); // 등받이
        addBox(c.w * 0.12, c.h * 0.55, c.d, c.h * 0.27, c.color, 0, -c.w / 2 + c.w * 0.06, 'fabric');
        addBox(c.w * 0.12, c.h * 0.55, c.d, c.h * 0.27, c.color, 0, c.w / 2 - c.w * 0.06, 'fabric');
        break;
      }
      case 'bed': {
        // 푹신한 매트리스 침대 — 프레임 + 두툼한 매트리스(둥근 모서리) + 부푼 이불 + 통통한 베개
        const H = c.h;
        const frameH = H * 0.22, matH = H * 0.42;                 // 낮은 프레임 위 두꺼운 매트리스
        const frameTop = frameH, matTop = frameTop + matH;
        addBox(c.w, frameH, c.d, frameH / 2, '#6f5a3f', 0, 0, 'wood');   // 프레임(원목)
        // 매트리스 — 모서리 둥글게, 푹신해 보이게
        addRounded(c.w * 0.97, matH, c.d * 0.97, frameTop + matH / 2, c.color, 0, 0, 'fabric', matH * 0.42);
        // 이불 — 두툼하게 부풀려 발치(+z)쪽 2/3 를 덮음
        const duvH = H * 0.3;
        addRounded(c.w * 0.99, duvH, c.d * 0.66, matTop + duvH / 2 - matH * 0.12, '#ece4d8', c.d * 0.15, 0, 'fabric', duvH * 0.45);
        // 이불 접힌 윗단(살짝 걷은 느낌)
        addRounded(c.w * 0.99, H * 0.16, c.d * 0.16, matTop + H * 0.06, '#f4efe4', -c.d * 0.08, 0, 'fabric', H * 0.07);
        // 헤드보드 — 천 쿠션(둥근) 느낌
        addRounded(c.w, H * 1.0, c.d * 0.1, frameTop + H * 0.5, '#b6a17e', -c.d / 2 + c.d * 0.05, 0, 'fabric', 90);
        // 베개 2개 — 통통하게(머리쪽 -z)
        const pillW = c.w * 0.4, pillH = H * 0.22, pillD = c.d * 0.2;
        addRounded(pillW, pillH, pillD, matTop + pillH * 0.45, '#f7f3ec', -c.d / 2 + c.d * 0.17, -c.w * 0.22, 'fabric', pillH * 0.48);
        addRounded(pillW, pillH, pillD, matTop + pillH * 0.45, '#f7f3ec', -c.d / 2 + c.d * 0.17, c.w * 0.22, 'fabric', pillH * 0.48);
        break;
      }
      case 'table': {
        addBox(c.w, c.h * 0.08, c.d, c.h - c.h * 0.04, c.color, 0, 0, 'wood');       // 상판
        const legC = '#6f5a3f', lh = c.h * 0.92, ly = lh / 2;
        const ox = c.w / 2 - 60, oz = c.d / 2 - 60;
        addBox(60, lh, 60, ly, legC, oz, ox); addBox(60, lh, 60, ly, legC, oz, -ox);
        addBox(60, lh, 60, ly, legC, -oz, ox); addBox(60, lh, 60, ly, legC, -oz, -ox);
        break;
      }
      case 'chair': {
        addBox(c.w, 60, c.d, c.h * 0.45, c.color, 0, 0, 'fabric');
        addBox(c.w, c.h * 0.5, 60, c.h * 0.72, c.color, -c.d / 2 + 30, 0, 'fabric');
        break;
      }
      case 'diningSet': {
        // 식탁 + 긴 변 양쪽 의자 (의자는 식탁을 향함). 전체 크기(W×D)에 의자 공간 포함
        const tw = c.w - 200, td = c.d - 700, th = c.h;
        addBox(tw, 40, td, th - 20, c.color, 0, 0, 'wood');                      // 상판
        const legC = '#5d4a33', ox = tw / 2 - 70, oz = td / 2 - 70;
        for (const [lx, lz] of [[ox, oz], [-ox, oz], [ox, -oz], [-ox, -oz]]) addBox(50, th - 40, 50, (th - 40) / 2, legC, lz, lx);
        const per = Math.max(1, Math.round((c.seats || 4) / 2)), cw = 440, cd = 460, chC = c.chairColor || '#d6d0c6';
        for (const side of [-1, 1]) {
          for (let i = 0; i < per; i++) {
            const x = -tw / 2 + (tw / per) * (i + 0.5), z = side * (td / 2 + 170);
            addBox(cw, 50, cd, 450, chC, z, x, 'fabric');                          // 좌석
            addBox(cw, 420, 50, 450 + 235, chC, z + side * (cd / 2 - 25), x, 'fabric'); // 등받이(식탁 반대쪽)
            for (const [ex, ez] of [[cw / 2 - 30, cd / 2 - 30], [-cw / 2 + 30, cd / 2 - 30], [cw / 2 - 30, -cd / 2 + 30], [-cw / 2 + 30, -cd / 2 + 30]]) addBox(25, 425, 25, 212, '#6b6f75', z + ez, x + ex);
          }
        }
        break;
      }
      case 'kbase': {                                                   // 하부장: 걸레받이 + 몸통 + 상판
        addBox(c.w - 20, 100, c.d - 60, 50, '#b9bcc0', -20);
        addBox(c.w, c.h - 160, c.d, 100 + (c.h - 160) / 2, c.color);
        cabDoors(c.w, c.h - 160, 100, c.d / 2);
        addBox(c.w, 60, c.d + 20, c.h - 30, '#f7f7f5', 10);
        break;
      }
      case 'kwall': case 'ktall': {                                     // 상부장(벽걸이)·키큰장: 몸통 + 문짝 구분선
        addBox(c.w, c.h, c.d, c.h / 2, c.color);
        cabDoors(c.w, c.h, 0, c.d / 2);
        if (c.kind === 'ktall') {                                       // 키큰장: 가운데 가전 수납칸(오픈) 표시
          addBox(c.w - 60, 560, 20, c.h * 0.45, '#3b3f44', c.d / 2 + 2);
          addBox(c.w - 60, 10, c.d - 40, c.h * 0.45, '#8f959b', 0);
        }
        break;
      }
      case 'hood': {                                                    // 레인지후드: 사다리꼴 느낌 본체 + 덕트
        addBox(c.w, 120, c.d, 60, c.color);
        addBox(c.w * 0.45, c.h - 120, c.d * 0.45, 120 + (c.h - 120) / 2, c.color, -c.d * 0.2);
        break;
      }
      case 'tvstand': {
        // 낮은 거실장 — 짧은 다리 + 몸통 + 서랍 3칸 구분선
        const legH = 80, bh = c.h - legH;
        addBox(c.w, bh, c.d, legH + bh / 2, c.color);
        for (const lx of [-c.w / 2 + 60, c.w / 2 - 60]) for (const lz of [-c.d / 2 + 50, c.d / 2 - 50]) addBox(30, legH, 30, legH / 2, '#b9a27a', lz, lx);
        for (let i = 1; i < 3; i++) addBox(6, bh - 40, 4, legH + bh / 2, '#9aa0a8', c.d / 2 + 1, -c.w / 2 + (c.w / 3) * i);   // 서랍 칸
        addBox(c.w - 40, 8, 4, legH + bh - 30, '#9aa0a8', c.d / 2 + 1);          // 손잡이 홈
        break;
      }
      case 'tv': {
        addBox(c.w, c.h, c.d, c.h / 2 + 350, c.color);                // 패널
        addBox(c.w * 0.3, 40, 250, 20, '#444');                        // 받침
        break;
      }
      case 'rug': {
        const m = addBox(c.w, 12, c.d, 6, c.color, 0, 0, 'fabric'); m.castShadow = false;
        break;
      }
      case 'plant': {
        addBox(c.w * 0.6, c.h * 0.25, c.d * 0.6, c.h * 0.12, '#9c7b52', 0, 0, 'wood');
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(c.w * 0.55, 12, 10), mat(c.color));
        leaf.position.y = c.h * 0.62; leaf.scale.y = 1.4; leaf.castShadow = true;
        g.add(leaf);
        break;
      }
      case 'sconce': {
        // 외부 벽등(간접등) — 벽면에 붙는 세로 박스 + 위아래로 새어나오는 빛
        addBox(c.w, c.h, c.d, 0, c.color);                                  // 등기구 몸통
        const glowMat = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffd98a', emissiveIntensity: 1.4, roughness: 0.5 });
        // 위·아래 발광면 (간접광 느낌)
        const top = new THREE.Mesh(new THREE.BoxGeometry(c.w * 0.7, 24, c.d * 0.7), glowMat); top.position.set(0, c.h / 2 - 6, 0); g.add(top);
        const bot = new THREE.Mesh(new THREE.BoxGeometry(c.w * 0.7, 24, c.d * 0.7), glowMat); bot.position.set(0, -c.h / 2 + 6, 0); g.add(bot);
        // 벽을 타고 번지는 빛 (포인트 라이트, 성능 위해 약하게)
        const lightUp = new THREE.PointLight(0xffe6b0, 6, 2600, 2); lightUp.position.set(0, c.h / 2 + 200, c.d); g.add(lightUp);
        const lightDn = new THREE.PointLight(0xffe6b0, 6, 2600, 2); lightDn.position.set(0, -c.h / 2 - 200, c.d); g.add(lightDn);
        break;
      }
      case 'tarp': {
        // 타프(차양막) — 삼각 세일 2장을 높이 다르게 겹쳐 얹은 모던 그늘막
        const hw = c.w / 2, hd = c.d / 2;
        const fabricMat = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
        // 세 모서리 A·B·C([x,z,y=높이])로 삼각 세일 하나 — 변 가운데를 sag 만큼 늘어뜨려 부드럽게
        const sail = (A, B, C, sag) => {
          const mid = (P, Q) => [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2, (P[2] + Q[2]) / 2 - sag];
          const V = [A, B, C, mid(A, B), mid(B, C), mid(C, A)];
          const pos = new Float32Array(V.length * 3);
          V.forEach((p, i) => { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[2]; pos[i * 3 + 2] = p[1]; });
          const g2 = new THREE.BufferGeometry();
          g2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          g2.setIndex([0, 3, 5, 3, 1, 4, 5, 4, 2, 3, 4, 5]);
          g2.computeVertexNormals();
          const m = new THREE.Mesh(g2, fabricMat); m.castShadow = true; m.receiveShadow = true; g.add(m);
        };
        const hi = 260, lo = 30;
        // 세일1: 좌하(높)–우하(낮)–우상(높)
        sail([-hw, -hd, hi], [hw, -hd, lo], [hw, hd, hi], 120);
        // 세일2: 좌하(낮)–좌상(높)–우상(낮), 조금 위로 겹치게 (대각선을 공유해 X자로 겹침)
        sail([-hw, -hd, lo + 70], [-hw, hd, hi + 40], [hw, hd, lo + 70], 120);
        // 네 모서리 지지 기둥 (바닥까지) — 건물 사이에 봉 없이 매다는 경우(f.noPoles)엔 생략
        if (!f.noPoles) {
          const postH = (f.elev != null ? f.elev : (c.elev || 2400));
          const postMat = new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 0.45, roughness: 0.5 });
          for (const [sx, sz, ph] of [[-hw, -hd, hi], [hw, -hd, lo], [hw, hd, hi], [-hw, hd, hi]]) {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, postH + ph, 10), postMat);
            pole.position.set(sx, (ph - postH) / 2, sz); pole.castShadow = true; g.add(pole);
          }
        }
        break;
      }
      case 'decksteps': {
        // 데크 계단 — 지면에 딱 붙고, 기초가 있으면 데크(기초+바닥) 상단까지 딱 맞게 오르는 계단.
        //   집 그룹이 기초 높이 F 만큼 올라가 있으므로, 이 제품 그룹을 로컬 0 에 두면
        //   기하 y=0(=세계 F)가 데크 근처, y=-F(=세계 0)가 지면. → 아래를 지면(-F)부터 쌓는다.
        const F = this._foundationH || 0;
        g.position.y = 0;   // 바닥 두께(+60) 오프셋 제거 → 계단은 항상 지면 기준
        if (F > 0) {
          const rise = F + 30;   // 지면 → 데크 바닥 상단(세계 F+30)
          const n = f.steps > 0 ? f.steps : Math.max(2, Math.min(6, Math.round(rise / 190)));
          const sh = rise / n, sd = c.d / n;
          for (let i = 0; i < n; i++) {
            const h = (i + 1) * sh;                                  // 지면에서 이 단 윗면까지
            addBox(c.w, h, sd, -F + h / 2, c.color, -c.d / 2 + sd * (i + 0.5));   // 뒤(데크쪽)로 갈수록 높음
          }
        } else {
          // 기초 없을 때: 지면 위 작은 단(맨 아래 단이 지면에 닿게 -F=0 기준으로 쌓음)
          const totalH = f.h != null ? f.h : c.h;
          const n = f.steps > 0 ? f.steps : Math.max(2, Math.min(4, Math.round(totalH / 170)));
          const sh = totalH / n, sd = c.d / n;
          for (let i = 0; i < n; i++) { const h = (i + 1) * sh; addBox(c.w, h, c.d - sd * i, h / 2, c.color, c.d / 2 - (c.d - sd * i) / 2); }
        }
        break;
      }
      case 'outlet': {
        // 야외 방수 콘센트 — 흰 박스 + 방수 덮개(살짝 열린 뚜껑)
        addBox(c.w, c.h, c.d, 0, c.color);                                  // 본체
        const lid = addBox(c.w * 0.96, c.h * 0.5, 18, c.h * 0.18, '#d7d5cf'); // 방수 덮개
        lid.position.z = c.d / 2 + 8; lid.rotation.x = -0.5;
        addBox(c.w * 0.5, c.h * 0.28, 8, -c.h * 0.15, '#8b8f95', c.d / 2 + 2); // 콘센트 구멍부
        break;
      }
      default: // box
        addBox(c.w, c.h, c.d, c.h / 2, c.color, 0, 0, woodBox ? 'wood' : undefined);
    }
    this._addFurniture(g, f);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    if (!this.active || this._photoBusy) return;
    this._resize();   // 매 활성 프레임에 컨테이너 크기와 동기화 (탭 전환 후 흰 화면 자가 복구)
    if (this.dirty) this.rebuild();
    this.controls.update();   // 감쇠(관성) 회전 중이면 'change' → _needsRender
    this._updateCompass();
    this._updateCmpLabels();
    // 변화가 있을 때만 렌더. 혹시 놓친 변경이 있어도 1초마다 한 번은 다시 그려 자가 복구
    if (this._needsRender || performance.now() - this._lastRender > 1000) {
      this._needsRender = false;
      this._render();
    }
  }

  // 현재 3D 화면을 PNG dataURL 로 캡처 (인쇄/저장용). 3D 미진입 시에도 한 번 렌더해서 캡처
  toImage() {
    const wasActive = this.active;
    if (!wasActive) {
      // 숨겨진 상태면 임시 크기 부여 후 렌더
      this.renderer.setSize(1200, 800, false);
      if (this.composer) this.composer.setSize(1200, 800);
      this.camera.aspect = 1200 / 800;
      this.camera.updateProjectionMatrix();
      this.rebuild();
    } else if (this.dirty) this.rebuild();   // 방금 바꾼 설정(지붕·외장 토글 등)이 캡처에 바로 반영되도록
    // 캡처·인쇄는 성능과 무관하게 항상 고화질(구석 음영)로
    const hq = this.hq, pinned = this._hqPinned;
    this.hq = true; this._hqPinned = true;
    this._render();
    this.hq = hq; this._hqPinned = pinned; this._needsRender = true;
    const url = this.renderer.domElement.toDataURL('image/png');
    if (!wasActive) { this._appliedW = 0; this._resize(); }   // 캡처용 임시 크기 무효화 → 다음에 재적용
    return url;
  }

  // 🧊 블렌더용 3D 내보내기 — 현재 도면을 .glb(바이너리 glTF)로.
  //   mm→m(1/1000)로 축소한 사본을 내보내 블렌더에서 실제 크기(미터)로 열린다.
  //   블렌더 glTF 가져오기가 Y-up→Z-up을 자동 변환하므로 방향도 맞는다.
  async exportGLB() {
    if (!this.active || this.dirty) this.rebuild();   // 3D를 아직 안 열었거나 설정이 바뀌었으면 먼저 생성
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const root = new THREE.Group();
    root.name = (store.design && store.design.name) || 'SEUM';
    const clone = this.modelGroup.clone(true);        // 지오메트리·재질은 참조 공유(원본 장면 영향 없음)
    clone.children.filter((c) => c.userData.isGround).forEach((c) => clone.remove(c));   // 지평선까지 깔린 잔디 제외
    clone.scale.multiplyScalar(0.001);                // mm → m
    root.add(clone);
    const buffer = await new Promise((resolve, reject) => {
      new GLTFExporter().parse(root, resolve, reject, { binary: true, onlyVisible: true });
    });
    return new Blob([buffer], { type: 'model/gltf-binary' });
  }

  // 사진급 렌더용 HDR 환경(하늘 그라데이션 + '밝은 태양')을 equirect 텍스처로 생성.
  //   태양 값을 1보다 크게(HDR) 넣어야 패스 트레이서가 진짜 방향성 그림자·하이라이트를 만든다.
  //   preset: 'day'(맑은 대낮) / 'sunset'(노을) / 'overcast'(흐린 날)
  _photoEnv(preset) {
    const PRESETS = {
      day:      { top: [0.26, 0.44, 0.72], hor: [0.82, 0.88, 0.94], sunAz: 0.7, sunEl: 0.85, sunInt: 16, sun: [1.0, 0.96, 0.88], sky: 1.0, gnd: [0.16, 0.20, 0.13] },
      sunset:   { top: [0.10, 0.14, 0.30], hor: [0.98, 0.55, 0.26], sunAz: 1.35, sunEl: 0.15, sunInt: 13, sun: [1.0, 0.60, 0.32], sky: 0.9, gnd: [0.15, 0.12, 0.10] },
      overcast: { top: [0.60, 0.64, 0.69], hor: [0.80, 0.82, 0.85], sunAz: 0.7, sunEl: 0.9, sunInt: 1.4, sun: [0.92, 0.94, 0.97], sky: 0.95, gnd: [0.15, 0.17, 0.15] },
    };
    const p = PRESETS[preset] || PRESETS.day;
    const W = 1024, H = 512, data = new Float32Array(W * H * 4);
    const sx = Math.cos(p.sunEl) * Math.sin(p.sunAz), sy = Math.sin(p.sunEl), sz = Math.cos(p.sunEl) * Math.cos(p.sunAz);
    const core = 0.024, outer = 0.10;   // 태양 원반 반경(라디안)
    for (let j = 0; j < H; j++) {
      const lat = (0.5 - (j + 0.5) / H) * Math.PI;
      for (let i = 0; i < W; i++) {
        const lon = ((i + 0.5) / W) * 2 * Math.PI - Math.PI;
        const cl = Math.cos(lat), dx = cl * Math.sin(lon), dy = Math.sin(lat), dz = cl * Math.cos(lon);
        let r, g, b;
        if (dy >= 0) {                       // 하늘: 지평선→천정 그라데이션
          const t = Math.pow(dy, 0.55);
          r = (p.hor[0] + (p.top[0] - p.hor[0]) * t) * p.sky;
          g = (p.hor[1] + (p.top[1] - p.hor[1]) * t) * p.sky;
          b = (p.hor[2] + (p.top[2] - p.hor[2]) * t) * p.sky;
        } else {                             // 지평선 아래: 바닥(잔디) 반사색으로 부드럽게
          const t = Math.min(1, -dy * 1.6);
          r = (p.hor[0] * (1 - t) + p.gnd[0] * t) * 0.7;
          g = (p.hor[1] * (1 - t) + p.gnd[1] * t) * 0.7;
          b = (p.hor[2] * (1 - t) + p.gnd[2] * t) * 0.7;
        }
        const cosd = dx * sx + dy * sy + dz * sz;         // 태양과의 각도
        const d = Math.acos(Math.max(-1, Math.min(1, cosd)));
        if (d < outer) {
          const s = d < core ? 1 : Math.pow(1 - (d - core) / (outer - core), 2);
          r += p.sun[0] * p.sunInt * s; g += p.sun[1] * p.sunInt * s; b += p.sun[2] * p.sunInt * s;
        }
        const k = (j * W + i) * 4; data[k] = r; data[k + 1] = g; data[k + 2] = b; data[k + 3] = 1;
      }
    }
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.needsUpdate = true;
    return tex;
  }

  // 미리보기용: 지금 3D 구도를 PNG dataURL 로 (사진급 렌더 창에서 '이 구도로 렌더됩니다' 미리보기)
  previewDataURL() { return this.toImage(); }

  // 📸 사진급 렌더 — 패스 트레이싱(빛이 벽·바닥에 여러 번 튕기는 것까지 계산)으로
  //   건축 CG 같은 한 장을 만든다. 지금 보고 있는 카메라 구도 그대로 별도 캔버스에 점점 선명하게 그림.
  //   라이브러리는 버튼을 누를 때만 불러오므로 평소 로딩 속도엔 영향 없음.
  //   opts.background: 'day' | 'sunset' | 'overcast' (배경·조명 프리셋)
  async createPhotoRender(width, height, opts = {}) {
    const { WebGLPathTracer } = await import('three-gpu-pathtracer');
    // three r162+ 에서 생긴 Scene 회전 속성을 패스 트레이서가 읽음 → 0.160 에는 없으므로 기본값(회전 없음) 보충
    for (const k of ['backgroundRotation', 'environmentRotation']) {
      if (!(k in THREE.Scene.prototype)) Object.defineProperty(THREE.Scene.prototype, k, { value: new THREE.Euler(), writable: true, configurable: true });
    }
    if (this.dirty) this.rebuild();

    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = this.renderer.toneMappingExposure;

    const pt = new WebGLPathTracer(renderer);
    pt.tiles.set(2, 2);            // 한 번에 1/4씩 그려 화면이 멈추지 않게
    pt.bounces = 6;                // 빛 반사 횟수 — 실내 간접광까지
    pt.filterGlossyFactor = 0.5;   // 반사 노이즈(반짝이 점) 억제
    pt.renderDelay = 0; pt.fadeDuration = 0; pt.minSamples = 1;
    pt.rasterizeScene = false;     // 처음부터 계산 결과만 표시

    // 하늘+태양(HDR): 하늘 그라데이션에 밝은 태양을 심어 진짜 방향성 그림자·하이라이트가 생기게
    const sky = this._photoEnv(opts.background || 'day');

    const cam = this.camera.clone();
    cam.aspect = width / height;
    cam.updateProjectionMatrix();

    // 장면을 잠깐 야외 조건으로 바꿔 패스 트레이서에 넘기고 바로 원상복구 (동기 처리라 화면 깜빡임 없음)
    const scene = this.scene;
    const saved = { env: scene.environment, bg: scene.background, envI: scene.environmentIntensity };
    scene.environment = sky; scene.background = sky; scene.environmentIntensity = 1.0;
    try { pt.setScene(scene, cam); }
    finally { scene.environment = saved.env; scene.background = saved.bg; scene.environmentIntensity = saved.envI; }

    this._photoBusy = true;        // 렌더 중엔 실시간 화면을 쉬어 GPU를 몰아줌
    let raf = 0, stopped = false;
    const loop = () => { if (stopped) return; pt.renderSample(); raf = requestAnimationFrame(loop); };
    loop();
    const self = this;
    return {
      canvas: renderer.domElement,
      get samples() { return pt.samples; },
      stop() { stopped = true; cancelAnimationFrame(raf); },
      toDataURL() { return renderer.domElement.toDataURL('image/png'); },
      dispose() {
        this.stop();
        try { pt.dispose(); } catch { /* noop */ }
        sky.dispose(); renderer.dispose(); renderer.forceContextLoss();
        self._photoBusy = false; self._needsRender = true;
      },
    };
  }

  // 외부에서 카메라 프리셋
  // --- 3D 직접 편집 (방 이동·크기조절) ---
  setEditMode(on) {
    this.editMode = !!on;
    if (!on) { this.selRooms.clear(); if (store.selectedRoom) { store.selectedRoom = null; store.emit(); } }
    this.dirty = true;
  }
  // 면별 외장재 모드 on/off
  setFaceMode(on) { this.faceMode = !!on; this.dirty = true; if (!on) { this.faceBrush = null; this._clearFacePreview(); this._selBand = null; this._bandDrag = null; this.dirty = true; } }
  // 면별 외장재 전체 초기화 — 모든 면·띠 오버라이드 제거(기본 외장재로 복귀)
  clearAllExteriorFaces() { store.commit((d) => { d.exteriorFaces = {}; }); }
  // 클릭한 외장 면(외곽선 변) 키 찾기
  _facePick(e) {
    this._raycaster.setFromCamera(this._ndc(e), this.camera);
    const hits = this._raycaster.intersectObjects(this.modelGroup.children, true);
    for (const h of hits) { const u = h.object.userData || {}; if (u.extFace) return u.extFace; }
    return null;
  }
  // 클릭한 면 전체에 현재 붓 재질을 칠함(기본 붓이면 면 재질·띠 모두 제거)
  _facePaint(key) {
    const brush = this.faceBrush; if (!brush) return false;
    store.commit((d) => {
      d.exteriorFaces = d.exteriorFaces || {};
      if (!brush.material) { delete d.exteriorFaces[key]; return; }   // 기본으로 완전 초기화
      const fo = d.exteriorFaces[key] || {};
      fo.material = brush.material; fo.color = brush.color;           // 밴드(fo.bands)는 유지
      d.exteriorFaces[key] = fo;
    });
    return true;
  }
  // 면의 u0~u1 구간(폭)에 자재 띠를 추가. 기본 붓이면 그 구간과 겹치는 띠 제거
  _facePaintBand(key, u0, u1) {
    const brush = this.faceBrush; if (!brush) return false;
    store.commit((d) => {
      d.exteriorFaces = d.exteriorFaces || {};
      const fo = d.exteriorFaces[key] || {};
      // 새 띠와 겹치는 기존 띠는 먼저 제거 → 덮어쓰기(같은 자리에 겹쳐 쌓여 z-fighting 나던 문제 해결)
      const keep = Array.isArray(fo.bands) ? fo.bands.filter((bd) => Math.max(bd.u0, bd.u1) <= u0 + 0.002 || Math.min(bd.u0, bd.u1) >= u1 - 0.002) : [];
      if (!brush.material) {
        fo.bands = keep;   // 기본 붓 = 그 구간 띠 지우기
      } else {
        keep.push({ u0, u1, material: brush.material, color: brush.color });
        fo.bands = keep;
      }
      d.exteriorFaces[key] = fo;
    });
    return true;
  }
  // 외장 면(외곽선 변)의 3D 시작점 A·방향 dir·길이 len (월드 XZ)
  _faceEdgeInfo(key) {
    const m = /^p(\d+)e(\d+)$/.exec(key); if (!m) return null;
    const pi = +m[1], ei = +m[2];
    const sh = outlineShapes(store.design.outline)[pi]; if (!sh) return null;
    const pts = sh.pts, n = pts.length; const A0 = pts[ei], B0 = pts[(ei + 1) % n];
    if (!A0 || !B0) return null;
    const b = this._bounds();
    const A = this._p(A0[0], A0[1], b), B = this._p(B0[0], B0[1], b);
    const dx = B[0] - A[0], dz = B[1] - A[1], len = Math.hypot(dx, dz) || 1;
    // 바깥 법선 (도형 중심 반대쪽)
    const P = pts.map((p) => this._p(p[0], p[1], b));
    let ccx = 0, ccz = 0; for (const q of P) { ccx += q[0]; ccz += q[1]; } ccx /= P.length; ccz /= P.length;
    let nx = dz / len, nz = -dx / len;
    const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
    if ((mx - ccx) * nx + (mz - ccz) * nz < 0) { nx = -nx; nz = -nz; }
    return { A, dir: [dx / len, dz / len], len, n: [nx, nz] };
  }
  // 면 key 위 u 위치에 있는 띠 인덱스(없으면 -1)
  _bandAt(key, u) {
    const fo = (store.design.exteriorFaces || {})[key];
    if (!fo || !Array.isArray(fo.bands)) return -1;
    for (let i = fo.bands.length - 1; i >= 0; i--) {
      const bd = fo.bands[i], lo = Math.min(bd.u0, bd.u1), hi = Math.max(bd.u0, bd.u1);
      if (u >= lo && u <= hi) return i;
    }
    return -1;
  }
  // 밴드 조절 핸들 클릭 판정
  _pickBandHandle(e) {
    this._raycaster.setFromCamera(this._ndc(e), this.camera);
    const hits = this._raycaster.intersectObjects(this.modelGroup.children, true);
    for (const h of hits) { const u = h.object.userData || {}; if (u.bandHandle) return u; }
    return null;
  }
  // 선택된 띠의 좌우 조절 핸들(초록 세로 바) — 면 바깥으로 내밀어 잡기 쉽게
  _buildBandHandles(d, b) {
    const sel = this._selBand; if (!sel) return;
    const fo = (d.exteriorFaces || {})[sel.key]; if (!fo || !Array.isArray(fo.bands) || !fo.bands[sel.idx]) return;
    const info = this._faceEdgeInfo(sel.key); if (!info) return;
    const bd = fo.bands[sel.idx], H = (d.ceilingHeight || 2400);
    const outN = info.n, push = ((d.wallThickness || 150) / 2) + 260;
    for (const edge of ['u0', 'u1']) {
      const u = Math.max(0, Math.min(1, bd[edge]));
      const bx = info.A[0] + info.dir[0] * info.len * u + outN[0] * push;
      const bz = info.A[1] + info.dir[1] * info.len * u + outN[1] * push;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(70, H * 0.92, 70),
        new THREE.MeshStandardMaterial({ color: '#16a34a', metalness: 0.2, roughness: 0.4 }));
      bar.position.set(bx, H * 0.5, bz);
      bar.rotation.y = Math.atan2(-info.dir[1], info.dir[0]);
      bar.userData = { bandHandle: edge, key: sel.key, idx: sel.idx };
      this.modelGroup.add(bar);
    }
  }
  // 클릭 지점의 외장 면 + 변을 따라간 위치(0~1) 반환
  _facePickAt(e) {
    this._raycaster.setFromCamera(this._ndc(e), this.camera);
    const hits = this._raycaster.intersectObjects(this.modelGroup.children, true);
    for (const h of hits) {
      const u = h.object.userData || {};
      if (!u.extFace) continue;
      const info = this._faceEdgeInfo(u.extFace);
      let frac = 0.5;
      if (info && h.point) { const px = h.point.x - info.A[0], pz = h.point.z - info.A[1]; frac = Math.min(1, Math.max(0, (px * info.dir[0] + pz * info.dir[1]) / info.len)); }
      return { key: u.extFace, u: frac };
    }
    return null;
  }
  // 특정 면(key) 위에서 포인터의 변 방향 위치(0~1) — 면 밖으로 나가도 변 직선에 투영해 끝(0/1)까지 잡힘
  _faceUAt(e, key) {
    const info = this._faceEdgeInfo(key); if (!info) return null;
    this._raycaster.setFromCamera(this._ndc(e), this.camera);
    const nx = info.dir[1], nz = -info.dir[0];   // 변에 수직인 수직평면
    const plane = new THREE.Plane(new THREE.Vector3(nx, 0, nz), -(nx * info.A[0] + nz * info.A[1]));
    const pt = new THREE.Vector3();
    if (!this._raycaster.ray.intersectPlane(plane, pt)) return null;
    const u = ((pt.x - info.A[0]) * info.dir[0] + (pt.z - info.A[1]) * info.dir[1]) / info.len;
    return Math.min(1, Math.max(0, u));
  }
  // 드래그 중 적용 범위(띠) 미리보기 상자 — scene 에 직접 두어 rebuild 와 무관하게 표시
  _updateFacePreview(key, u0, u1) {
    const info = this._faceEdgeInfo(key); if (!info) { this._clearFacePreview(); return; }
    const lo = Math.min(u0, u1), hi = Math.max(u0, u1);
    const w = Math.max(20, (hi - lo) * info.len);
    const H = (store.design.ceilingHeight || 2400) + 160;
    const cu = (lo + hi) / 2;
    const cx = info.A[0] + info.dir[0] * info.len * cu, cz = info.A[1] + info.dir[1] * info.len * cu;
    if (!this._facePreviewMesh) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.4, depthTest: false, side: THREE.DoubleSide });
      this._facePreviewMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
      this._facePreviewMesh.renderOrder = 999;
      this.scene.add(this._facePreviewMesh);
    }
    const m = this._facePreviewMesh;
    m.visible = true;
    m.position.set(cx, H / 2, cz);
    m.rotation.y = Math.atan2(-info.dir[1], info.dir[0]);
    m.scale.set(w, H, 80);
    this._needsRender = true;
  }
  _clearFacePreview() { if (this._facePreviewMesh) { this._facePreviewMesh.visible = false; this._needsRender = true; } }
  // 선택된 색 구간의 범위 상자(주황)를 보여줘 폭을 눈으로 확인하며 조절
  _showSelBandPreview() {
    const s = this._selBand; if (!s) { this._clearFacePreview(); return; }
    const fo = (store.design.exteriorFaces || {})[s.key];
    const band = fo && fo.bands && fo.bands[s.idx];
    if (band) this._updateFacePreview(s.key, band.u0, band.u1); else this._clearFacePreview();
  }
  _buildEditHandles(d, b) {
    const room = d.rooms.find((r) => r.id === store.selectedRoom); if (!room) return;
    // 함께 선택된 방들(다중 선택 = 건물 통째) — 대표 방 포함해 모두 강조
    const selIds = this.selRooms.size ? new Set([...this.selRooms, room.id]) : new Set([room.id]);
    const group = d.rooms.filter((r) => selIds.has(r.id));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of group) {
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.d);
      // 선택 방 강조(반투명 박스)
      const [rx, rz] = this._p(r.x, r.y, b);
      const ring = new THREE.Mesh(new THREE.BoxGeometry(r.w, 40, r.d),
        new THREE.MeshStandardMaterial({ color: '#c8102e', transparent: true, opacity: 0.28 }));
      ring.position.set(rx + r.w / 2, 70, rz + r.d / 2); this.modelGroup.add(ring);
    }
    // 모서리 크기조절 핸들 — 단일 선택일 때만 (그룹이면 이동·회전만)
    if (group.length === 1) {
      const corners = [['nw', room.x, room.y], ['ne', room.x + room.w, room.y], ['sw', room.x, room.y + room.d], ['se', room.x + room.w, room.y + room.d]];
      for (const [name, cxmm, cymm] of corners) {
        const [hx, hz] = this._p(cxmm, cymm, b);
        const h = new THREE.Mesh(new THREE.BoxGeometry(360, 360, 360),
          new THREE.MeshStandardMaterial({ color: '#c8102e', metalness: 0.2, roughness: 0.5 }));
        h.position.set(hx, 260, hz); h.userData = { handle: name, roomId: room.id };
        this.modelGroup.add(h);
      }
    }
    // 90° 회전 핸들 — 선택(그룹) 중심 위에 초록 원기둥. 클릭하면 시계방향 90° 회전.
    const [gcx, gcz] = this._p((minX + maxX) / 2, (minY + maxY) / 2, b);
    const HY = 1150;   // 핸들 높이 (지붕 아래, 잘 보이고 집을 안 가림)
    const rotMat = new THREE.MeshStandardMaterial({ color: '#16a34a', metalness: 0.2, roughness: 0.4 });
    const rh = new THREE.Mesh(new THREE.TorusGeometry(430, 120, 14, 32), rotMat);
    rh.rotation.x = Math.PI / 2; rh.position.set(gcx, HY, gcz);
    rh.userData = { handle: 'rotate', roomId: room.id };
    this.modelGroup.add(rh);
    // 회전 방향 표시용 화살촉 (시계방향)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(200, 380, 18), rotMat);
    tip.position.set(gcx + 430, HY, gcz); tip.rotation.z = -Math.PI / 2;
    tip.userData = { handle: 'rotate', roomId: room.id };
    this.modelGroup.add(tip);
    // 핸들과 방을 잇는 기둥(선택 위치 안내)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, HY - 70, 8),
      new THREE.MeshStandardMaterial({ color: '#16a34a', transparent: true, opacity: 0.5 }));
    stem.position.set(gcx, (HY - 70) / 2, gcz); this.modelGroup.add(stem);
  }
  _ndc(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
  }
  _groundHit(e) {   // 화면 포인터 → 지면(y=0) 평면상의 도면 좌표(mm)
    this._raycaster.setFromCamera(this._ndc(e), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(this._foundationH || 0));   // 기초 위 바닥 높이
    const t = new THREE.Vector3();
    if (!this._raycaster.ray.intersectPlane(plane, t)) return null;
    const b = this._bounds();
    return { x: t.x + b.cx, y: t.z + b.cz };
  }
  _pickFurniture(e) {   // 화면 포인터 아래 가장 가까운 가구 id (없으면 null)
    this.modelGroup.updateMatrixWorld();   // 방금 다시 만든(아직 렌더 전) 모델도 정확한 위치로
    this._raycaster.setFromCamera(this._ndc(e), this.camera);
    const hits = this._raycaster.intersectObjects(this.modelGroup.children, true);
    for (const h of hits) {
      const u = h.object.userData || {};
      if (u.furnId) return u.furnId;
      if (h.object.material && !h.object.material.transparent) return null;   // 벽 등 불투명한 것에 먼저 막히면 선택 안 함
    }
    return null;
  }
  _pick(e) {        // 핸들/방 선택 (핸들 우선)
    this._raycaster.setFromCamera(this._ndc(e), this.camera);
    const hits = this._raycaster.intersectObjects(this.modelGroup.children, true);
    for (const h of hits) { const u = h.object.userData || {}; if (u.handle) return u; }
    for (const h of hits) { const u = h.object.userData || {}; if (u.roomId) return u; }
    // 실물 모델(GLB)을 누르면 집 전체 선택 → 드래그하면 모델째로 이동
    const rooms = store.design.rooms;
    if (this.usingModel3d && rooms.length && hits.some((h) => this._inModel3d(h.object))) return { roomId: rooms[0].id, model3d: true };
    return null;
  }
  _inModel3d(o) { for (; o; o = o.parent) if (o.name === 'model3d') return true; return false; }
  _edDown(e) {
    // 면별 외장재 모드: 클릭=면 전체, 드래그=드래그한 폭만큼 자재 띠
    if (this.faceMode && e.button === 0) {
      // 1) 선택된 띠의 조절 핸들을 잡으면 → 가장자리 드래그로 폭 조절
      const hp = this._pickBandHandle(e);
      if (hp) { this._bandDrag = { key: hp.key, idx: hp.idx, edge: hp.bandHandle }; this.controls.enabled = false; store.snapshot(); return; }
      const pick = this._facePickAt(e);
      if (pick) {
        const fo = (store.design.exteriorFaces || {})[pick.key];
        // 2) 기존 색 띠를 클릭 → 선택(폭 조절 핸들 + 주황 범위 상자 표시), 칠하지 않음
        const bi = this._bandAt(pick.key, pick.u);
        if (bi >= 0) { this._selBand = { key: pick.key, idx: bi }; this._showSelBandPreview(); this.dirty = true; return; }
        // 3) 전체 칠한 면을 클릭 → 폭 조절 가능한 [0,1] 띠로 바꾸고 선택(범위 재조절)
        if (fo && fo.material && !(Array.isArray(fo.bands) && fo.bands.length)) {
          store.commit((dd) => {
            const f2 = (dd.exteriorFaces = dd.exteriorFaces || {})[pick.key];
            f2.bands = [{ u0: 0, u1: 1, material: f2.material, color: f2.color }];
            delete f2.material; delete f2.color;
          });
          this._selBand = { key: pick.key, idx: 0 }; this._showSelBandPreview(); this.dirty = true; return;
        }
        // 4) 그 외 빈 면 → 칠하기(클릭=전체, 드래그=띠)
        if (this._selBand) { this._selBand = null; this._clearFacePreview(); this.dirty = true; }
        this._faceDrag = { key: pick.key, u0: pick.u, u1: pick.u }; this.controls.enabled = false;
      } else if (this._selBand) { this._selBand = null; this._clearFacePreview(); this.dirty = true; }
      return;
    }
    if (e.button !== 0) return;            // 좌클릭만 편집 — 휠(가운데)·우클릭은 카메라 이동/회전
    // 가구(제품): 편집 모드가 아니어도 잡아서 끌면 이동 (빈 곳을 끌면 기존처럼 회전)
    const fp = this._pickFurniture(e);
    if (fp) {
      const f = store.design.furniture.find((x) => x.id === fp); if (!f) return;
      const g = this._groundHit(e); if (!g) return;
      if (store.selectedFurniture !== f.id) { store.selectedFurniture = f.id; store.selectedRoom = store.selectedOpening = null; store.emit(); }
      this.controls.enabled = false;
      this._edrag = { mode: 'furn', f, dx: g.x - f.x, dy: g.y - f.y };
      return;
    }
    // 3D 직접 편집 — 별도 '편집 모드' 없이 집을 바로 클릭/드래그.
    //   빈 곳 드래그 = 화면 회전(궤도), 집 클릭 = 선택, 선택된 집 드래그 = 이동.
    const pick = this._pick(e);

    // 초록 회전 핸들 클릭 → 선택(그룹) 90° 시계방향 회전
    if (pick && pick.handle === 'rotate') {
      const room = store.design.rooms.find((r) => r.id === pick.roomId); if (!room) return;
      const ids = this.selRooms.size ? [...new Set([...this.selRooms, room.id])] : [room.id];
      const primary = store.selectedRoom || room.id;
      this.controls.enabled = false;      // 핸들 누르는 동안 화면 회전 방지 (up 에서 복구)
      store.commit((d) => rotateRoomsInDesign(d, ids, +1));
      store.selectedRoom = primary; store.emit();
      return;
    }

    // 빨간 모서리 핸들 드래그 → 크기조절
    if (pick && pick.handle) {
      const room = store.design.rooms.find((r) => r.id === pick.roomId); if (!room) return;
      this.controls.enabled = false;
      this._edrag = { mode: 'resize', room, handle: pick.handle };
      return;
    }

    const roomId = pick && pick.roomId;

    // Shift+클릭 = 다중 선택 토글 (건물 통째 이동/회전)
    if (e.shiftKey && roomId) {
      // 먼저 단일 선택해 둔 방도 그룹에 포함 (A 클릭 후 Shift+B → A·B 둘 다 선택)
      if (store.selectedRoom && !this.selRooms.has(store.selectedRoom)) this.selRooms.add(store.selectedRoom);
      if (this.selRooms.has(roomId)) {
        this.selRooms.delete(roomId);
        store.selectedRoom = this.selRooms.values().next().value || null;
      } else {
        this.selRooms.add(roomId);
        store.selectedRoom = roomId;
      }
      store.emit();
      return;
    }

    // 이미 선택된 집을 (Shift 없이) 잡으면 → 바로 이동 시작 (단일/그룹)
    const grabbingSelected = roomId && (roomId === store.selectedRoom || this.selRooms.has(roomId));
    if (grabbingSelected) {
      const room = store.design.rooms.find((r) => r.id === roomId);
      const g = this._groundHit(e); if (!g) return;
      this.controls.enabled = false;      // 드래그 중 화면 회전 정지
      if (this.selRooms.size > 1 && this.selRooms.has(roomId)) {
        if (store.selectedRoom !== roomId) { store.selectedRoom = roomId; store.emit(); }
        this._edrag = { mode: 'group', ids: [...this.selRooms], anchorId: roomId, dx: g.x - room.x, dy: g.y - room.y };
      } else {
        this._edrag = { mode: 'move', room, dx: g.x - room.x, dy: g.y - room.y };
      }
      return;
    }

    // 그 외(선택 안 된 집 또는 빈 곳) → 클릭이면 선택/해제, 드래그면 화면 회전.
    //   컨트롤을 켜 둔 채 클릭·드래그를 구분(_edMove 에서 이동량으로 판정).
    this._gesture = { x0: e.clientX, y0: e.clientY, roomId: roomId || null, model3d: !!(pick && pick.model3d), moved: false };
  }
  _edMove(e) {
    if (this._bandDrag) {   // 선택한 띠의 한쪽 가장자리를 끌어 폭 조절
      const bd = this._bandDrag; const u = this._faceUAt(e, bd.key);
      if (u != null) {
        store.liveUpdate(() => {
          const fo = (store.design.exteriorFaces || {})[bd.key]; const band = fo && fo.bands && fo.bands[bd.idx];
          if (band) band[bd.edge] = u;
        });
        const fo = (store.design.exteriorFaces || {})[bd.key]; const band = fo && fo.bands && fo.bands[bd.idx];
        if (band) this._updateFacePreview(bd.key, band.u0, band.u1);   // 조절 중 범위 상자 갱신
      }
      return;
    }
    if (this._faceDrag) {   // 면별 외장재 드래그 — 변 직선에 투영해 끝까지 잡히게 + 범위 미리보기
      const u = this._faceUAt(e, this._faceDrag.key);
      if (u != null) { this._faceDrag.u1 = u; this._updateFacePreview(this._faceDrag.key, this._faceDrag.u0, u); }
      return;
    }
    if (!this._edrag) {
      // 클릭↔드래그 판정 중: 일정 이상 움직이면 화면 회전으로 간주(선택 취소)
      if (this._gesture && !this._gesture.moved) {
        if (Math.hypot(e.clientX - this._gesture.x0, e.clientY - this._gesture.y0) > 6) this._gesture.moved = true;
      }
      return;
    }
    const g = this._groundHit(e); if (!g) return;
    // 드래그당 한 번만 스냅샷 → Ctrl+Z 되돌리기 지원(2D 편집과 동일)
    if (!this._edrag.snapped) { store.snapshot(); this._edrag.snapped = true; }
    const snap = (v) => Math.round(v / 100) * 100;
    const dr = this._edrag, room = dr.room;
    if (dr.mode === 'furn') {           // 가구 이동 — 50mm 단위
      const s50 = (v) => Math.round(v / 50) * 50;
      store.liveUpdate(() => { dr.f.x = s50(g.x - dr.dx); dr.f.y = s50(g.y - dr.dy); });
      return;
    }
    if (dr.mode === 'group') {           // 다중 선택 방 함께 이동
      const anchor = store.design.rooms.find((r) => r.id === dr.anchorId); if (!anchor) return;
      const ddx = snap(g.x - dr.dx) - anchor.x, ddy = snap(g.y - dr.dy) - anchor.y;
      if (ddx || ddy) store.liveUpdate(() => moveRoomsInDesign(store.design, dr.ids, ddx, ddy));
      return;
    }
    if (dr.mode === 'move') {
      store.liveUpdate(() => { room.x = snap(g.x - dr.dx); room.y = snap(g.y - dr.dy); });
    } else {
      const MIN = 800; let { x, y, w, d: dd } = room; const right = x + w, bottom = y + dd;
      const mx = snap(g.x), my = snap(g.y);
      if (dr.handle.includes('w')) { x = Math.min(mx, right - MIN); w = right - x; }
      if (dr.handle.includes('e')) { w = Math.max(MIN, mx - x); }
      if (dr.handle.includes('n')) { y = Math.min(my, bottom - MIN); dd = bottom - y; }
      if (dr.handle.includes('s')) { dd = Math.max(MIN, my - y); }
      store.liveUpdate(() => { room.x = x; room.y = y; room.w = w; room.d = dd; });
    }
  }
  _edUp() {
    if (this._bandDrag) {   // 띠 폭 조절 종료 — u0/u1 정규화(뒤집힘 보정)
      const bd = this._bandDrag; this._bandDrag = null;
      store.liveEnd(); this.controls.enabled = true;
      store.commit((d) => {
        const fo = (d.exteriorFaces || {})[bd.key];
        const band = fo && fo.bands && fo.bands[bd.idx];
        if (band && band.u0 > band.u1) { const t = band.u0; band.u0 = band.u1; band.u1 = t; }
      });
      this._showSelBandPreview(); this.dirty = true; return;
    }
    if (this._faceDrag) {
      const fd = this._faceDrag; this._faceDrag = null; this.controls.enabled = true;
      this._clearFacePreview();
      const w = Math.abs(fd.u1 - fd.u0);
      if (w < 0.03) this._facePaint(fd.key);                                   // 살짝 = 클릭 → 면 전체
      else this._facePaintBand(fd.key, Math.min(fd.u0, fd.u1), Math.max(fd.u0, fd.u1)); // 드래그 → 폭만큼 띠
      return;
    }
    if (this._edrag) {
      const mode = this._edrag.mode; const moved = this._edrag.snapped;
      this._edrag = null;
      // 방을 옮기거나 크기조절했으면 외곽선(지붕·외장)을 몸통에 맞춰 다시 계산
      if (moved && (mode === 'move' || mode === 'group' || mode === 'resize')) {
        syncOutlineToRooms(store.design); store.emit();
      }
      store.liveEnd(); this.controls.enabled = true; return;
    }
    // 클릭(거의 안 움직임) 판정 → 집 선택 / 빈 곳이면 선택 해제
    if (this._gesture) {
      const gs = this._gesture; this._gesture = null;
      if (!gs.moved) {
        if (gs.model3d) {   // 실물 모델 클릭 → 모든 방을 그룹 선택 (이동·회전이 집 전체에 적용)
          this.selRooms = new Set(store.design.rooms.map((r) => r.id));
          store.selectedRoom = gs.roomId; store.selectedFurniture = null; store.selectedOpening = null; store.emit();
        } else if (gs.roomId) {
          this.selRooms.clear();
          if (store.selectedRoom !== gs.roomId) {
            store.selectedRoom = gs.roomId; store.selectedFurniture = null; store.selectedOpening = null; store.emit();
          }
        } else if (store.selectedRoom || this.selRooms.size) {
          this.selRooms.clear(); store.selectedRoom = null; store.emit();
        }
      }
    }
    this.controls.enabled = true;
  }

  // 3D 선택 해제 (깔끔한 상담 화면으로)
  clearSelection() {
    this.selRooms.clear();
    if (store.selectedRoom || store.selectedFurniture) { store.selectedRoom = null; store.selectedFurniture = null; store.emit(); }
    this.dirty = true;
  }

  // 바닥 보기 — 땅을 숨기고 아래에서 올려다봄 (기초 콘크리트·데크 하부·장선)
  setUnderside(on) {
    this.underside = !!on;
    if (this._ground) this._ground.visible = !on;
    if (this.underLight) this.underLight.intensity = on ? 1.1 : 0;
    this._needsRender = true;
  }

  view(type) {
    const b = this._bounds();
    this.setUnderside(type === 'under');
    if (type === 'under') {
      this.camera.fov = 50; this.camera.updateProjectionMatrix();
      this.controls.maxPolarAngle = Math.PI * 0.98;   // 땅 아래로 내려가 올려다보기
      this._aerialZoomLimits(b);
      const d = Math.max(b.w, b.h) * 1.1 + 5000;
      this.camera.position.set(d * 0.6, -d * 0.75, d * 0.8);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      return;
    }
    if (type === 'interior') {
      // 실내 시점 — 집 안 눈높이(1450mm)에서 반대편을 바라봄. 둘러보기 가능.
      this.camera.fov = 62; this.camera.updateProjectionMatrix();
      this.controls.maxPolarAngle = Math.PI * 0.9;   // 살짝 아래(바닥·가구)까지 볼 수 있게
      this.controls.minDistance = 400;
      this.controls.maxDistance = Math.max(b.w, b.h) * 1.5 + 8000;
      this.camera.position.set(-(b.w / 2 - 700), 1450, (b.h / 2 - 700));
      this.controls.target.set(b.w * 0.06, 1120, -(b.h * 0.36));
      this.controls.update();
      return;
    }
    // 외부(조감) 시점 프리셋
    this.camera.fov = 50; this.camera.updateProjectionMatrix();
    this.controls.maxPolarAngle = Math.PI / 2.05;    // 지면 아래로는 못 내려가게
    this._aerialZoomLimits(b);                        // 휠 줌 범위 제한
    const d = Math.max(b.w, b.h) * 1.1 + 5000;
    if (type === 'top') this.camera.position.set(0, d * 1.4, 1);
    else if (type === 'front') this.camera.position.set(0, d * 0.4, d);
    else this.camera.position.set(d * 0.65, d * 0.8, d * 0.85);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
}
