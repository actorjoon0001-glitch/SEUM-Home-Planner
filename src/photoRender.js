// 세움 홈플래너 - 📸 사진급 렌더 창
// 지금 3D 화면 구도 그대로 패스 트레이싱 렌더를 돌려, 점점 선명해지는 과정을 보여주고 PNG로 저장한다.
// (렌더 계산 자체는 viewer3d.js 의 createPhotoRender 가 담당)
// + ✨ AI 실사 변환: 지금 렌더/구도를 이미지 AI(image-to-image)로 실사 건축사진처럼 바꾼다.
//   (서버 함수 /.netlify/functions/ai-render 가 API 키를 들고 대신 호출)

import { store } from './store.js';

// 도면 정보 → 실사 변환 프롬프트에 쓸 영어 표현
const MATERIAL_EN = {
  metal: 'dark metal siding', cement: 'fiber-cement siding', ceramic: 'ceramic panel siding',
  stucco: 'white stucco render', brick: 'brick facade', wood: 'warm vertical wood siding', stone: 'natural stone cladding',
};
const ROOF_EN = {
  flat: 'flat roof', gable: 'gable pitched roof', asymGable: 'asymmetric gable roof',
  hip: 'hip roof', shed: 'mono-pitch shed roof',
};
const SCENE_EN = {
  day: 'clear blue sky, bright natural daylight',
  sunset: 'golden sunset light, warm sky',
  overcast: 'soft diffuse overcast daylight',
};

// 현재 도면으로부터 실사 변환 프롬프트 자동 생성 (지붕·외장재·배경 반영, 형태·구도 유지 지시 포함)
function buildAiPrompt(bg) {
  const d = (store && store.design) || {};
  const ex = (d.exterior && d.exterior.material) || 'metal';
  const exEn = MATERIAL_EN[ex] || 'modern siding';
  const roofs = new Set();
  if (d.roof && d.roof.type) roofs.add(ROOF_EN[d.roof.type] || 'modern roof');
  const paths = (d.outline && Array.isArray(d.outline.paths)) ? d.outline.paths : [];
  for (const p of paths) if (p && p.roof && p.roof.type) roofs.add(ROOF_EN[p.roof.type] || 'modern roof');
  const roofTxt = roofs.size ? [...roofs].join(' and ') : 'modern roof';
  const scene = SCENE_EN[bg] || SCENE_EN.day;
  return [
    'Photorealistic architectural exterior visualization of a modern Korean modular house.',
    `Exterior finish: ${exEn}. Roof: ${roofTxt}. Large black-framed glass windows and doors, wooden deck.`,
    `${scene}. Neat green lawn with light landscaping, realistic soft shadows and ambient occlusion.`,
    'Professional real-estate exterior photography, ultra realistic, high detail, natural materials.',
    'IMPORTANT: keep the exact same building shapes, proportions, layout, roof types, window and door positions, and the same camera angle as the reference image — only make it photorealistic.',
  ].join(' ');
}

const QUALITY = {
  fast: { label: '빠르게 (약 10초)', samples: 120 },
  normal: { label: '보통 (약 30초)', samples: 350 },
  best: { label: '최고 (1분 이상)', samples: 900 },
};
const SIZES = { 1600: '1600px (보고용)', 2400: '2400px (인쇄·카탈로그)' };
const BACKGROUNDS = { day: '맑은 대낮 ☀️', sunset: '노을 🌇', overcast: '흐린 날 ☁️' };

let dlg = null;

function build() {
  dlg = document.createElement('dialog');
  dlg.className = 'dialog photo-dlg';
  dlg.innerHTML = `
    <div class="dialog-head">📸 사진급 렌더 <button type="button" data-act="close" title="닫기">✕</button></div>
    <div class="photo-body">
      <div class="photo-opts">
        <label>품질 <select data-f="q">${Object.entries(QUALITY).map(([k, v]) => `<option value="${k}"${k === 'normal' ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <label>크기 <select data-f="w">${Object.entries(SIZES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label>배경 <select data-f="bg">${Object.entries(BACKGROUNDS).map(([k, v]) => `<option value="${k}"${k === 'day' ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <button type="button" class="photo-btn" data-act="start">렌더 시작</button>
        <button type="button" class="photo-btn ai" data-act="ai" title="지금 구도를 AI로 실사 건축사진처럼 변환">✨ AI 실사 변환</button>
      </div>
      <div class="photo-stage"><p class="photo-hint">지금 3D 화면의 구도 그대로 렌더합니다.<br>원하는 각도로 돌려놓고 <b>렌더 시작</b>을 누르세요.</p></div>
      <div class="photo-bar"><div class="photo-fill"></div></div>
      <div class="photo-foot">
        <span class="photo-status"></span>
        <span class="photo-actions">
          <button type="button" class="photo-btn ghost" data-act="stop" disabled>멈추기</button>
          <button type="button" class="photo-btn" data-act="save" disabled>PNG 저장</button>
        </span>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  return dlg;
}

// viewer: Viewer3D, getName: 파일 이름에 쓸 도면 이름
export function openPhotoRender(viewer, getName) {
  if (!viewer || !viewer.createPhotoRender) return;
  const d = dlg || build();
  const $ = (s) => d.querySelector(s);
  const stage = $('.photo-stage'), fill = $('.photo-fill'), status = $('.photo-status');
  const btnStart = $('[data-act=start]'), btnStop = $('[data-act=stop]'), btnSave = $('[data-act=save]');
  const btnAI = $('[data-act=ai]');
  let job = null, timer = 0, t0 = 0, target = 0, aiResult = null;

  // 미리보기 — 지금 3D 구도를 그대로 보여줘 '이 각도로 렌더된다'를 확인 (배경/조명은 렌더 시 적용)
  const showPreview = () => {
    let url = null;
    try { url = viewer.previewDataURL && viewer.previewDataURL(); } catch (e) { url = null; }
    stage.innerHTML = url
      ? `<img src="${url}" alt="미리보기" style="width:100%;height:100%;object-fit:contain;display:block;background:#eef1f4">`
      : '<p class="photo-hint">지금 3D 화면의 구도 그대로 렌더합니다.<br>원하는 각도로 돌려놓고 <b>렌더 시작</b>을 누르세요.</p>';
  };

  const finish = (msg) => {
    clearInterval(timer); timer = 0;
    if (job) job.stop();
    btnStop.disabled = true; btnStart.disabled = false; btnStart.textContent = '다시 렌더';
    if (msg) status.textContent = msg;
  };
  const cleanup = () => { finish(); if (job) { job.dispose(); job = null; } aiResult = null; };

  btnStart.onclick = async () => {
    cleanup();
    const q = QUALITY[$('[data-f=q]').value] || QUALITY.normal;
    const w = +$('[data-f=w]').value || 1600;
    const r = viewer.renderer.domElement.getBoundingClientRect();
    const aspect = r.width && r.height ? r.width / r.height : 16 / 9;
    const h = Math.round(w / aspect);
    target = q.samples;
    btnStart.disabled = true; btnSave.disabled = true;
    status.textContent = '장면 준비 중… (처음 한 번은 라이브러리를 불러와 몇 초 걸려요)';
    fill.style.width = '0%';
    try {
      job = await viewer.createPhotoRender(w, h, { background: $('[data-f=bg]').value });
    } catch (e) {
      console.error('[사진급 렌더] 실패', e);
      status.textContent = '렌더를 시작하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
      btnStart.disabled = false;
      return;
    }
    stage.innerHTML = '';
    stage.appendChild(job.canvas);
    btnStop.disabled = false; btnSave.disabled = false;
    t0 = performance.now();
    timer = setInterval(() => {
      if (!job) return;
      const s = job.samples, pct = Math.min(100, (s / target) * 100);
      fill.style.width = pct.toFixed(1) + '%';
      const sec = Math.round((performance.now() - t0) / 1000);
      status.textContent = `계산 중… ${Math.floor(s)} / ${target} (${sec}초) — 멈춰도 지금까지 결과를 저장할 수 있어요`;
      if (s >= target) finish(`완성! (${sec}초) — PNG로 저장하세요`);
    }, 250);
  };

  btnStop.onclick = () => finish(`멈춤 (${job ? Math.floor(job.samples) : 0} / ${target}) — 지금까지 결과를 저장할 수 있어요`);

  btnSave.onclick = () => {
    const a = document.createElement('a');
    const name = (getName && getName()) || '세움도면';
    const url = aiResult || (job && job.toDataURL());
    if (!url) return;
    a.download = `${name}_${aiResult ? 'AI실사' : '사진급렌더'}.png`;
    a.href = url;
    a.click();
  };

  // 전송 전 이미지를 가볍게 축소 (서버 함수 요청 용량 제한 대비 — 구조만 있으면 됨)
  const scaleDataURL = (srcURL, maxW = 1024) => new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, maxW / (img.width || maxW));
        const w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => resolve(srcURL);
      img.src = srcURL;
    } catch (e) { resolve(srcURL); }
  });

  // ✨ AI 실사 변환 — 지금 렌더(없으면 3D 구도)를 이미지 AI 로 실사화
  btnAI.onclick = async () => {
    const raw = (job && job.toDataURL()) || (viewer.previewDataURL && viewer.previewDataURL());
    if (!raw) { status.textContent = '먼저 3D 구도를 준비하거나 한 번 렌더해 주세요.'; return; }
    const src = await scaleDataURL(raw, 1024);
    const bg = $('[data-f=bg]').value;
    aiResult = null;
    btnAI.disabled = true; btnStart.disabled = true; btnSave.disabled = true;
    status.textContent = '✨ AI 실사 변환 중… (수십 초 걸릴 수 있어요)';
    fill.style.width = '40%';
    try {
      const endpoint = (window.SEUM_CONFIG && window.SEUM_CONFIG.aiRenderEndpoint) || '/.netlify/functions/ai-render';
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: src, prompt: buildAiPrompt(bg), background: bg }),
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.image) {
        aiResult = data.image;
        stage.innerHTML = `<img src="${data.image}" alt="AI 실사" style="width:100%;height:100%;object-fit:contain;display:block;background:#eef1f4">`;
        fill.style.width = '100%';
        btnSave.disabled = false;
        status.textContent = 'AI 실사 변환 완료! PNG로 저장하세요';
      } else {
        fill.style.width = '0%';
        status.textContent = (data && data.error) || 'AI 변환 결과를 받지 못했어요. 잠시 후 다시 시도해 주세요.';
      }
    } catch (e) {
      fill.style.width = '0%';
      status.textContent = 'AI 변환 실패: ' + ((e && e.message) || e);
    }
    btnAI.disabled = false; btnStart.disabled = false;
  };

  $('[data-act=close]').onclick = () => d.close();
  d.onclose = () => {
    cleanup();
    stage.innerHTML = '<p class="photo-hint">지금 3D 화면의 구도 그대로 렌더합니다.<br>원하는 각도로 돌려놓고 <b>렌더 시작</b>을 누르세요.</p>';
    fill.style.width = '0%'; status.textContent = '';
    btnStart.textContent = '렌더 시작'; btnSave.disabled = true;
  };
  showPreview();      // 창을 열 때 지금 구도를 미리보기로 표시
  d.showModal();
}
