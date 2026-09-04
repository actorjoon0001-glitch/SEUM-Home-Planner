// 세움 홈플래너 — 면별 외장재 (벽 하나하나 클릭해서 재질 지정)
//   🎨 버튼을 켜고 재질을 고른 뒤, 3D에서 외벽 면을 클릭하면 그 면만 그 재질로 칠해진다.
//   저장: d.exteriorFaces { "p0e2": {material,color} } — 없는 면은 기본 외장재.

import { EXTERIOR_MATERIALS } from './data.js';

export function initFacePaint(opts = {}) {
  const viewer = opts.viewer;
  const flash = opts.flash || (() => {});
  const onShowExterior = opts.onShowExterior || (() => {});
  const onNeed3D = opts.onNeed3D || (() => {});
  if (!viewer || document.getElementById('fp-btn')) return;

  const st = document.createElement('style');
  st.textContent = `
  #fp-btn{position:fixed;left:18px;bottom:18px;z-index:60;height:44px;padding:0 14px;border-radius:22px;
    border:1px solid #e0e0e0;background:#fff;color:#333;font-size:14px;font-weight:700;cursor:pointer;
    box-shadow:0 4px 14px rgba(0,0,0,.16);display:flex;align-items:center;gap:6px}
  #fp-btn.on{background:#c8102e;color:#fff;border-color:#c8102e}
  #fp-bar{position:fixed;left:18px;bottom:72px;z-index:60;display:none;flex-wrap:wrap;gap:8px;
    max-width:min(420px,calc(100vw - 36px));padding:12px;background:#fff;border:1px solid #e3e3e3;
    border-radius:14px;box-shadow:0 8px 26px rgba(0,0,0,.2)}
  #fp-bar.on{display:flex}
  #fp-bar .sw{width:60px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:#555}
  #fp-bar .sw .chip{width:52px;height:36px;border-radius:8px;border:2px solid transparent;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
  #fp-bar .sw.sel .chip{border-color:#c8102e}
  #fp-bar .sw.sel{color:#c8102e;font-weight:700}
  #fp-bar .sw.def .chip{background:repeating-linear-gradient(45deg,#eee,#eee 6px,#ddd 6px,#ddd 12px);display:flex;align-items:center;justify-content:center;font-size:16px}
  `;
  document.head.appendChild(st);

  const btn = document.createElement('button');
  btn.id = 'fp-btn'; btn.innerHTML = '🎨 <span>면별 외장재</span>';
  document.body.appendChild(btn);

  const bar = document.createElement('div');
  bar.id = 'fp-bar';
  document.body.appendChild(bar);

  const swatches = [];
  const select = (key) => {
    viewer.faceBrush = key === '__default__' ? { material: null } : { material: key, color: EXTERIOR_MATERIALS[key].color };
    swatches.forEach((s) => s.el.classList.toggle('sel', s.key === key));
  };
  // 기본(오버라이드 제거) + 재질들
  const mk = (key, label, chipHtml, cls) => {
    const el = document.createElement('div');
    el.className = 'sw' + (cls ? ' ' + cls : '');
    el.innerHTML = `<div class="chip">${chipHtml || ''}</div><span>${label}</span>`;
    el.onclick = () => select(key);
    bar.appendChild(el); swatches.push({ key, el });
  };
  mk('__default__', '기본', '↺', 'def');
  for (const [key, m] of Object.entries(EXTERIOR_MATERIALS)) {
    mk(key, m.label, '');
    swatches[swatches.length - 1].el.querySelector('.chip').style.background = m.color;
  }

  btn.onclick = () => {
    const on = !viewer.faceMode;
    viewer.setFaceMode(on);
    btn.classList.toggle('on', on);
    bar.classList.toggle('on', on);
    if (on) {
      onNeed3D(); onShowExterior();
      if (!viewer.faceBrush) select(Object.keys(EXTERIOR_MATERIALS)[0]);
      else { const b = viewer.faceBrush; select(b.material || '__default__'); }
      flash('면별 외장재 — 재질 고르고: 클릭=면 전체, 드래그=드래그한 폭만큼 포인트 띠 (기본↺=되돌림)');
    } else flash('면별 외장재 종료');
  };
}
