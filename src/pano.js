// 📷 360 실사 보기 — 온라인 카탈로그(seum-catalog)에 올린 360 카메라 사진을 홈플래너에서 그대로 둘러보기
//   · 사진은 카탈로그 Supabase(models.panorama_images = [{ url, label }])에서 모델명(code)으로 찾아옴
//     → 카탈로그 관리자에서 360 사진을 올리면 홈플래너에도 자동으로 나타남
//   · 뷰어: three.js 구(球) 안쪽에 등장방형(equirectangular) 사진을 입혀 드래그로 둘러보기
import * as THREE from 'three';
import { catalogGet, catalogThumb } from './catalog.js';

let _panos = null;      // { 모델명(대문자): [{ url, label }] }
let _loading = null;
const norm = (s) => String(s || '').trim().toUpperCase();

// 카탈로그 전체에서 360 사진이 있는 모델만 한 번에 받아 둠 (실패해도 조용히 빈 목록)
export function loadPanos(force) {
  if (_panos && !force) return Promise.resolve(_panos);
  if (_loading && !force) return _loading;
  _loading = catalogGet('models?select=name,slug,panorama_images')
    .then((rows) => {
      const map = {};
      for (const r of rows || []) {
        const list = (Array.isArray(r.panorama_images) ? r.panorama_images : [])
          .map((p) => (typeof p === 'string' ? { url: p } : p))
          .filter((p) => p && p.url);
        if (list.length && r.name) map[norm(r.name)] = labelPanos(list);
      }
      _panos = map;
      return map;
    })
    .catch(() => (_panos = _panos || {}))
    .finally(() => { _loading = null; });
  return _loading;
}

// 이름 없는 장면은 '장면 N', 같은 이름이 여러 장이면 '거실 2'처럼 번호
function labelPanos(list) {
  const seen = {};
  const total = {};
  list.forEach((p) => { const l = (p.label || '').trim(); if (l) total[l] = (total[l] || 0) + 1; });
  return list.map((p, i) => {
    const l = (p.label || '').trim();
    if (!l) return { url: p.url, label: `장면 ${i + 1}`, room: '' };
    seen[l] = (seen[l] || 0) + 1;
    return { url: p.url, label: total[l] > 1 ? `${l} ${seen[l]}` : l, room: l };
  });
}

// 공간(방 이름)별 묶음 — [{ room, start(첫 사진 번호), count }] · 카탈로그에 적은 순서대로
export function panoRooms(list) {
  const out = [];
  (list || []).forEach((p, i) => {
    if (!p.room) return;
    const g = out.find((x) => x.room === p.room);
    if (g) g.count++; else out.push({ room: p.room, start: i, count: 1 });
  });
  return out;
}

export function panosOf(code) { return (code && _panos && _panos[norm(code)]) || null; }

const thumbOf = (url) => catalogThumb(url, 240, 120);   // 탭용 작은 미리보기

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 360 뷰어 창 — 드래그로 둘러보기 · 휠/두 손가락으로 확대 · 아래 탭으로 방 이동 · Esc/✕로 닫기
export function openPano(list, title, start = 0) {
  if (!list || !list.length) return;
  const ov = document.createElement('div'); ov.className = 'pano-overlay';
  ov.innerHTML = `
    <div class="pano-head"><b>📷 ${esc(title || '360 실사')}</b><span class="pano-cur"></span>
      <span class="pano-sp"></span>
      <button type="button" class="pano-btn pano-auto" title="천천히 자동 회전">⟳ 자동 회전</button>
      <button type="button" class="pano-btn pano-fs" title="전체 화면">⛶</button>
      <button type="button" class="pano-btn pano-x" aria-label="닫기">✕</button></div>
    <div class="pano-stage"><div class="pano-load">사진 불러오는 중…</div>
      <button type="button" class="pano-nav pano-prev" aria-label="이전">‹</button>
      <button type="button" class="pano-nav pano-next" aria-label="다음">›</button>
      <div class="pano-hint">드래그해서 둘러보세요 · 휠/두 손가락으로 확대</div></div>
    <div class="pano-tabs">${list.map((p, i) => `<button type="button" class="pano-tab" data-i="${i}"><img src="${esc(thumbOf(p.url))}" alt="" loading="lazy" draggable="false"><span>${esc(p.label)}</span></button>`).join('')}</div>`;
  document.body.appendChild(ov);
  const stage = ov.querySelector('.pano-stage');
  const loadEl = ov.querySelector('.pano-load');
  const curEl = ov.querySelector('.pano-cur');
  const autoBtn = ov.querySelector('.pano-auto');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  const geo = new THREE.SphereGeometry(10, 64, 32); geo.scale(-1, 1, 1);   // 구 안쪽에서 보이게 뒤집기
  const mat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  scene.add(new THREE.Mesh(geo, mat));
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
  const cache = new Map();   // 이미 받은 사진은 다시 받지 않음

  // lon 180° = 사진 가운데(360 카메라의 정면)부터 보이게
  let lon = 180, lat = 0, fov = 75, idx = -1, auto = true, dirty = true, alive = true;
  const resize = () => {
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); dirty = true;
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(stage); else window.addEventListener('resize', resize);
  resize();

  const show = (i) => {
    i = (i + list.length) % list.length;
    if (i === idx) return;
    idx = i;
    ov.querySelectorAll('.pano-tab').forEach((t) => t.classList.toggle('on', +t.dataset.i === i));
    const tab = ov.querySelector(`.pano-tab[data-i="${i}"]`);
    if (tab && tab.scrollIntoView) tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    curEl.textContent = `${list[i].label} · ${i + 1}/${list.length}`;
    const apply = (tex) => {
      if (!alive || idx !== i) return;
      mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
      lon = 180; lat = 0; fov = 75; cam.fov = fov; cam.updateProjectionMatrix();
      loadEl.classList.add('hidden'); dirty = true;
      // 다음 장면 미리 받아 두기 — 탭을 누르면 바로 보이게
      const n = (i + 1) % list.length;
      if (!cache.has(n)) cache.set(n, loadTex(list[n].url));
    };
    loadEl.textContent = '사진 불러오는 중…'; loadEl.classList.remove('hidden');
    if (!cache.has(i)) cache.set(i, loadTex(list[i].url));
    cache.get(i).then(apply, () => { if (idx === i) { cache.delete(i); loadEl.textContent = '사진을 불러오지 못했습니다'; } });
  };
  const loadTex = (url) => new Promise((res, rej) => loader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    res(t);
  }, undefined, rej));

  // 드래그(마우스·터치) · 두 손가락 확대
  const pts = new Map();
  let pinch0 = 0, fov0 = fov;
  const cv = renderer.domElement;
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopAuto();
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); fov0 = fov; }
  });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) {
      const k = fov / (stage.clientHeight || 600);   // 확대할수록 천천히
      lon -= (e.clientX - p.x) * k; lat += (e.clientY - p.y) * k;
      lat = Math.max(-85, Math.min(85, lat)); dirty = true;
    }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2 && pinch0) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      setFov(fov0 * pinch0 / Math.max(d, 1));
    }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); stopAuto(); setFov(fov + e.deltaY * 0.05); }, { passive: false });
  const setFov = (f) => { fov = Math.max(30, Math.min(95, f)); cam.fov = fov; cam.updateProjectionMatrix(); dirty = true; };
  const stopAuto = () => { if (auto) { auto = false; autoBtn.classList.remove('on'); } };
  autoBtn.classList.add('on');
  autoBtn.onclick = () => { auto = !auto; autoBtn.classList.toggle('on', auto); };

  ov.querySelector('.pano-prev').onclick = () => show(idx - 1);
  ov.querySelector('.pano-next').onclick = () => show(idx + 1);
  ov.querySelectorAll('.pano-tab').forEach((t) => { t.onclick = () => show(+t.dataset.i); });
  ov.querySelector('.pano-fs').onclick = () => {
    try { if (document.fullscreenElement) document.exitFullscreen(); else ov.requestFullscreen(); } catch { /* noop */ }
  };

  const onKey = (e) => {
    if (e.key === 'Escape' && !document.fullscreenElement) close();
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'ArrowLeft') show(idx - 1);
  };
  document.addEventListener('keydown', onKey);
  const close = () => {
    alive = false;
    document.removeEventListener('keydown', onKey);
    if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
    try { if (document.fullscreenElement === ov) document.exitFullscreen(); } catch { /* noop */ }
    cache.forEach((p) => p.then((t) => t.dispose(), () => {}));
    geo.dispose(); mat.dispose(); renderer.dispose();
    try { renderer.forceContextLoss(); } catch { /* noop */ }
    ov.remove();
  };
  ov.querySelector('.pano-x').onclick = close;

  let last = performance.now();
  const tick = (now) => {
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (auto && mat.map) { lon += dt * 4; dirty = true; }   // 초당 4° — 천천히 한 바퀴
    if (dirty) {
      const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon);
      cam.lookAt(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
      renderer.render(scene, cam); dirty = false;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  show(Math.max(0, Math.min(list.length - 1, start | 0)));
  return close;
}
