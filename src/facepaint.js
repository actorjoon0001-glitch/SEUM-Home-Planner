// 세움 홈플래너 — 면별 외장재 (벽 하나하나 클릭해서 재질·색 지정)
//   마감재 패널 안에 들어가는 인라인 UI. 켜고 재질·색을 고른 뒤 3D에서 외벽 면을
//   클릭(면 전체) 또는 드래그(폭만큼 띠)하면 그 부분만 그 재질/색으로 칠해진다.
//   저장: d.exteriorFaces { "p0e2": {material,color, bands:[{u0,u1,material,color}]} } — 없는 면은 기본 외장재.

import { EXTERIOR_MATERIALS } from './data.js';

export function initFacePaint(opts = {}) {
  const viewer = opts.viewer;
  const flash = opts.flash || (() => {});
  const onShowExterior = opts.onShowExterior || (() => {});
  const onNeed3D = opts.onNeed3D || (() => {});
  const mount = opts.mount || document.getElementById('fin-2color-panel');
  if (!viewer || !mount || mount.dataset.fpReady) return;
  mount.dataset.fpReady = '1';

  if (!document.getElementById('fp-inline-style')) {
    const st = document.createElement('style');
    st.id = 'fp-inline-style';
    st.textContent = `
    #fin-2color-panel .fp-toggle{width:100%;height:38px;border-radius:9px;border:1px solid #e0c3c3;
      background:#faf3ec;color:#a23;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
    #fin-2color-panel .fp-toggle.on{background:#c8102e;color:#fff;border-color:#c8102e}
    #fin-2color-panel .fp-body{display:none;margin-top:9px;border:1px solid #eee;border-radius:10px;padding:11px;background:#fff}
    #fin-2color-panel .fp-body.on{display:block}
    #fin-2color-panel .fp-tip{font-size:11.5px;color:#8a9099;line-height:1.5;margin:0 0 9px}
    #fin-2color-panel .fp-tip b{color:#c8102e;font-weight:700}
    #fin-2color-panel .fp-mats{display:grid;grid-template-columns:repeat(auto-fill,minmax(60px,1fr));gap:8px 7px}
    #fin-2color-panel .fp-sw{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer}
    #fin-2color-panel .fp-sw .chip{width:100%;height:34px;border-radius:8px;border:2px solid transparent;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
    #fin-2color-panel .fp-sw span{font-size:10.5px;line-height:1.15;color:#5a6069;text-align:center;word-break:keep-all}
    #fin-2color-panel .fp-sw:hover .chip{border-color:#c9ccd0}
    #fin-2color-panel .fp-sw.sel .chip{border-color:#c8102e;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08),0 0 0 2px rgba(200,16,46,.15)}
    #fin-2color-panel .fp-sw.sel span{color:#c8102e;font-weight:700}
    #fin-2color-panel .fp-sw.def .chip{background:repeating-linear-gradient(45deg,#f0f0f0,#f0f0f0 6px,#e2e2e2 6px,#e2e2e2 12px);display:flex;align-items:center;justify-content:center;font-size:16px;color:#8a9099}
    #fin-2color-panel .fp-color{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-top:11px;padding-top:11px;border-top:1px solid #f0f0f0}
    #fin-2color-panel .fp-color .lbl{font-size:11.5px;font-weight:700;color:#5a6069;width:100%}
    #fin-2color-panel .fp-color input[type=color]{width:38px;height:28px;border:1px solid #ddd;border-radius:7px;padding:0;background:#fff;cursor:pointer;flex:0 0 auto}
    #fin-2color-panel .fp-sw2{display:flex;gap:5px;flex-wrap:wrap}
    #fin-2color-panel .fp-sw2 b{width:22px;height:22px;border-radius:6px;border:1px solid rgba(0,0,0,.14);cursor:pointer}
    #fin-2color-panel .fp-sw2 b:hover{transform:scale(1.12)}
    #fin-2color-panel .fp-reset{margin-top:11px;width:100%;border:1px solid #e0c3c3;background:#fff5f5;color:#c8102e;font-weight:700;font-size:12px;border-radius:8px;padding:7px;cursor:pointer}
    #fin-2color-panel .fp-reset:hover{background:#c8102e;color:#fff;border-color:#c8102e}
    `;
    document.head.appendChild(st);
  }

  mount.innerHTML = `
    <button type="button" class="fp-toggle" id="fp-toggle">🎨 면별 외장재 켜기</button>
    <div class="fp-body" id="fp-body">
      <p class="fp-tip">재질·색상을 고른 뒤 &nbsp;<b>벽면 클릭</b> = 그 면 전체 &nbsp;·&nbsp; <b>벽면 드래그</b> = 그 부분만(띠)<br>칠한 부분을 다시 클릭하면 범위를 조절할 수 있어요. 지우기는 <b>기본(되돌림)↺</b>.</p>
      <div class="fp-mats" id="fp-mats"></div>
      <div class="fp-color" id="fp-color">
        <span class="lbl">색상 (같은 재질도 색만 바꿔 2색 조합)</span>
        <input type="color" id="fp-col">
        <div class="fp-sw2" id="fp-presets"></div>
      </div>
      <button type="button" class="fp-reset" id="fp-reset">전체 초기화 (기본 외장재로)</button>
    </div>`;

  const toggle = mount.querySelector('#fp-toggle');
  const body = mount.querySelector('#fp-body');
  const mats = mount.querySelector('#fp-mats');
  const colorInput = mount.querySelector('#fp-col');
  const colorRow = mount.querySelector('#fp-color');

  const swatches = [];
  const select = (key) => {
    viewer.faceBrush = key === '__default__' ? { material: null } : { material: key, color: EXTERIOR_MATERIALS[key].color };
    swatches.forEach((s) => s.el.classList.toggle('sel', s.key === key));
    const on = key !== '__default__';
    colorRow.style.opacity = on ? '1' : '0.45';
    colorInput.disabled = !on;
    if (on) colorInput.value = viewer.faceBrush.color || '#888888';
  };
  const mk = (key, label, chipHtml, cls) => {
    const el = document.createElement('div');
    el.className = 'fp-sw' + (cls ? ' ' + cls : '');
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
  const PRESET = ['#3a3f46', '#6b7079', '#9aa0a8', '#c9c3b8', '#b98b5e', '#8a6b49', '#5b4636', '#2b2e33', '#e7e2d8', '#c0492e'];
  mount.querySelector('#fp-presets').innerHTML = PRESET.map((c) => `<b style="background:${c}" data-c="${c}"></b>`).join('');
  const applyColor = (c) => { if (viewer.faceBrush && viewer.faceBrush.material) { viewer.faceBrush.color = c; colorInput.value = c; } };
  colorInput.oninput = (e) => applyColor(e.target.value);
  mount.querySelectorAll('#fp-presets b').forEach((b) => b.onclick = () => applyColor(b.dataset.c));

  mount.querySelector('#fp-reset').onclick = () => {
    if (viewer.clearAllExteriorFaces) viewer.clearAllExteriorFaces();
    flash('면별 외장재 전체 초기화 — 기본 외장재로');
  };

  const setOn = (on) => {
    if (viewer.setFaceMode) viewer.setFaceMode(on); else viewer.faceMode = on;
    toggle.classList.toggle('on', on);
    body.classList.toggle('on', on);
    toggle.textContent = on ? '🎨 면별 외장재 끄기' : '🎨 면별 외장재 켜기';
    if (on) {
      onNeed3D(); onShowExterior();
      if (!viewer.faceBrush) select(Object.keys(EXTERIOR_MATERIALS)[0]);
      else select(viewer.faceBrush.material || '__default__');
      flash('면별 외장재 — 재질·색 고르고 3D에서 면 클릭(전체)·드래그(띠). 같은 사이딩도 색만 바꿔 2색 조합 가능');
    }
  };
  toggle.onclick = () => setOn(!viewer.faceMode);

  // 외부에서 열기(마감재 패널의 "2색·부분 시공" 진입 등)
  mount._fpOpen = () => { if (!viewer.faceMode) setOn(true); };
}
