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
  #fp-btn{position:fixed;left:18px;bottom:18px;z-index:60;height:44px;padding:0 16px;border-radius:22px;
    border:1px solid #e0e0e0;background:#fff;color:#333;font-size:14px;font-weight:700;cursor:pointer;
    box-shadow:0 4px 14px rgba(0,0,0,.16);display:flex;align-items:center;gap:6px}
  #fp-btn.on{background:#c8102e;color:#fff;border-color:#c8102e}
  #fp-bar{position:fixed;left:18px;bottom:72px;z-index:60;display:none;flex-direction:column;gap:0;
    width:min(440px,calc(100vw - 36px));background:#fff;border:1px solid #e3e3e3;
    border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.22);overflow:hidden}
  #fp-bar.on{display:flex}
  #fp-head{padding:13px 16px 11px;border-bottom:1px solid #f0f0f0}
  #fp-head .t{font-size:15px;font-weight:800;color:#222;letter-spacing:-.01em}
  #fp-head .d{font-size:12px;color:#8a9099;margin-top:3px;line-height:1.45}
  #fp-head .d b{color:#c8102e;font-weight:700}
  #fp-mats{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:9px 8px;padding:14px 16px 6px}
  #fp-bar .sw{display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer}
  #fp-bar .sw .chip{width:100%;height:40px;border-radius:9px;border:2px solid transparent;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);transition:border-color .12s}
  #fp-bar .sw span{font-size:11px;line-height:1.2;color:#5a6069;text-align:center;word-break:keep-all}
  #fp-bar .sw:hover .chip{border-color:#c9ccd0}
  #fp-bar .sw.sel .chip{border-color:#c8102e;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08),0 0 0 2px rgba(200,16,46,.15)}
  #fp-bar .sw.sel span{color:#c8102e;font-weight:700}
  #fp-bar .sw.def .chip{background:repeating-linear-gradient(45deg,#f0f0f0,#f0f0f0 6px,#e2e2e2 6px,#e2e2e2 12px);display:flex;align-items:center;justify-content:center;font-size:18px;color:#8a9099}
  #fp-color{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:12px 16px 16px;margin-top:4px;border-top:1px solid #f0f0f0}
  #fp-color .lbl{font-size:12px;font-weight:700;color:#5a6069;width:100%}
  #fp-color input[type=color]{width:40px;height:30px;border:1px solid #ddd;border-radius:7px;padding:0;background:#fff;cursor:pointer;flex:0 0 auto}
  #fp-color .fp-sw2{display:flex;gap:6px;flex-wrap:wrap}
  #fp-color .fp-sw2 b{width:24px;height:24px;border-radius:6px;border:1px solid rgba(0,0,0,.14);cursor:pointer;transition:transform .1s}
  #fp-color .fp-sw2 b:hover{transform:scale(1.12)}
  `;
  document.head.appendChild(st);

  const btn = document.createElement('button');
  btn.id = 'fp-btn'; btn.innerHTML = '🎨 <span>면별 외장재</span>';
  document.body.appendChild(btn);

  const bar = document.createElement('div');
  bar.id = 'fp-bar';
  bar.innerHTML = `
    <div id="fp-head">
      <div class="t">🎨 면별 외장재</div>
      <div class="d">재질·색상을 고른 뒤 &nbsp;<b>벽면 클릭</b> = 그 면 전체 &nbsp;·&nbsp; <b>벽면 드래그</b> = 그 부분만(띠)<br>한 벽에 2색은 → 전체 클릭 후, 다른 색으로 원하는 폭을 드래그하세요.</div>
    </div>
    <div id="fp-mats"></div>`;
  document.body.appendChild(bar);
  const mats = bar.querySelector('#fp-mats');

  const swatches = [];
  const select = (key) => {
    viewer.faceBrush = key === '__default__' ? { material: null } : { material: key, color: EXTERIOR_MATERIALS[key].color };
    swatches.forEach((s) => s.el.classList.toggle('sel', s.key === key));
    // 색상 선택기 상태 갱신 (기본 브러시면 비활성)
    if (colorRow) {
      const on = key !== '__default__';
      colorRow.style.opacity = on ? '1' : '0.45';
      colorInput.disabled = !on;
      if (on) colorInput.value = viewer.faceBrush.color || '#888888';
    }
  };
  // 기본(오버라이드 제거) + 재질들
  const mk = (key, label, chipHtml, cls) => {
    const el = document.createElement('div');
    el.className = 'sw' + (cls ? ' ' + cls : '');
    el.innerHTML = `<div class="chip">${chipHtml || ''}</div><span>${label}</span>`;
    el.onclick = () => select(key);
    mats.appendChild(el); swatches.push({ key, el });
  };
  mk('__default__', '기본(되돌림)', '↺', 'def');
  for (const [key, m] of Object.entries(EXTERIOR_MATERIALS)) {
    mk(key, m.label, '');
    swatches[swatches.length - 1].el.querySelector('.chip').style.background = m.color;
  }

  // 색상 선택기 — 같은 재질(예: 메탈사이딩)을 원하는 색으로 칠해 2색 조합 표현
  const colorRow = document.createElement('div');
  colorRow.id = 'fp-color';
  const PRESET = ['#3a3f46', '#6b7079', '#9aa0a8', '#c9c3b8', '#b98b5e', '#8a6b49', '#5b4636', '#2b2e33', '#e7e2d8', '#c0492e'];
  colorRow.innerHTML = `<span class="lbl">색상 (같은 재질도 색만 바꿔 2색 조합)</span><input type="color" id="fp-col"><div class="fp-sw2">${PRESET.map((c) => `<b style="background:${c}" data-c="${c}"></b>`).join('')}</div>`;
  bar.appendChild(colorRow);
  const colorInput = colorRow.querySelector('#fp-col');
  const applyColor = (c) => { if (viewer.faceBrush && viewer.faceBrush.material) { viewer.faceBrush.color = c; colorInput.value = c; } };
  colorInput.oninput = (e) => applyColor(e.target.value);
  colorRow.querySelectorAll('.fp-sw2 b').forEach((b) => b.onclick = () => applyColor(b.dataset.c));

  btn.onclick = () => {
    const on = !viewer.faceMode;
    viewer.setFaceMode(on);
    btn.classList.toggle('on', on);
    bar.classList.toggle('on', on);
    if (on) {
      onNeed3D(); onShowExterior();
      if (!viewer.faceBrush) select(Object.keys(EXTERIOR_MATERIALS)[0]);
      else { const b = viewer.faceBrush; select(b.material || '__default__'); }
      flash('면별 외장재 — 재질·색상 고르고: 클릭=면 전체, 드래그=폭만큼 띠. 같은 사이딩을 색상만 바꿔 2색 조합도 가능 (기본↺=되돌림)');
    } else flash('면별 외장재 종료');
  };
}
