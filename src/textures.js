// 세움 홈플래너 - 절차적 텍스처 (Canvas 기반)
// 외부 이미지 없이 캔버스로 자재 질감을 그려 THREE.Texture 로 변환합니다.
// (폐쇄망에서도 동작 - 이미지 파일 다운로드 불필요)
//
// 모든 패턴은 "밝은 회색 + 명암 변화"의 무채색으로 그립니다.
// 실제 색은 메쉬 재질의 color 로 곱(multiply)해 입히므로,
// 사용자가 외장 색상을 바꿔도 같은 텍스처가 자연스럽게 따라옵니다.
// three.js 는 3D(재질) 함수에서만 필요하다. 로그인·2D UI 가 three CDN 로딩에
// 묶이지 않도록 '정적 import' 대신 viewer3d.js 가 주입한다. (swatchDataURL/EXT_KIND 는 2D-only)
let THREE = null;
export function _useThree(mod) { THREE = mod; }

// 텍스처 1장이 실제 공간에서 덮는 크기(mm) — repeat 계산 기준
const TILE = {
  brick: 1600, metalSiding: 1300, cementSiding: 1500, ceramicSiding: 1400,
  stucco: 2200, woodSiding: 1500, stone: 2000, shingle: 1500,
  floorWood: 1700, floorTile: 1100, plaster: 2500, fabric: 600, woodGrain: 1400,
  grass: 3000, deckBoard: 1400, metalSidingV: 1300, slat: 900,
};

// ---------------------------------------------------------------------------
// 패턴 그리기 헬퍼
// ---------------------------------------------------------------------------
function newCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function roundRect(x, X, Y, W, H, r) {
  r = Math.min(r, W / 2, H / 2);
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r);
  x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r);
  x.arcTo(X, Y, X + W, Y, r);
  x.closePath();
}

// ---------------------------------------------------------------------------
// 자재별 패턴 생성기 (무채색 명암)
// ---------------------------------------------------------------------------
const GEN = {
  // 가로 사이딩(라프) - 판재가 겹쳐진 외벽
  siding(x, s, { ph = 28, grain = false, sheen = 0 } = {}) {
    x.fillStyle = '#d2d2d2'; x.fillRect(0, 0, s, s);
    for (let y = 0; y <= s; y += ph) {
      const v = 205 + ((Math.random() * 16 - 8) | 0);   // 판재별 미세 톤차
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(0, y, s, ph - 2);
      if (grain) {                                       // 섬유시멘트 결
        for (let k = 0; k < 6; k++) {
          x.strokeStyle = `rgba(140,140,140,${0.06 + Math.random() * 0.08})`;
          x.lineWidth = 1;
          const gy = y + Math.random() * ph;
          x.beginPath(); x.moveTo(0, gy);
          x.bezierCurveTo(s * 0.3, gy + (Math.random() * 3 - 1.5), s * 0.6, gy + (Math.random() * 3 - 1.5), s, gy);
          x.stroke();
        }
      }
      x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(0, y + ph - 2, s, 2);   // 겹침 그늘
      x.fillStyle = 'rgba(255,255,255,0.45)'; x.fillRect(0, y + ph - 4, s, 1); // 하이라이트
    }
    if (sheen) {                                         // 금속 광택
      const g = x.createLinearGradient(0, 0, s, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${sheen})`);
      g.addColorStop(1, 'rgba(0,0,0,0.05)');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
    }
  },

  brick(x, s) {
    x.fillStyle = '#dadada'; x.fillRect(0, 0, s, s);     // 줄눈(모르타르)
    const bw = 58, bh = 26, gap = 5;
    let row = 0;
    for (let y = -bh; y < s + bh; y += bh + gap) {
      const off = (row % 2) ? -(bw + gap) / 2 : 0;
      for (let bx = off - bw; bx < s + bw; bx += bw + gap) {
        const v = 188 + ((Math.random() * 22 - 11) | 0);
        x.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
        x.fillRect(bx, y, bw, bh);
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(bx, y, bw, 2);
        x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(bx, y + bh - 3, bw, 3);
      }
      row++;
    }
  },

  stucco(x, s) {
    x.fillStyle = '#dcdcdc'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 14000; i++) {
      const v = (Math.random() * 60 - 30) | 0;
      x.fillStyle = `rgba(${128 + v},${128 + v},${128 + v},${0.05 + Math.random() * 0.06})`;
      const r = 1 + Math.random() * 2;
      x.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
  },

  woodSiding(x, s) {
    x.fillStyle = '#c9c9c9'; x.fillRect(0, 0, s, s);
    const pw = 40;
    for (let i = 0; i < s; i += pw) {
      const v = 205 + ((Math.random() * 18 - 9) | 0);
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(i, 0, pw - 2, s);
      for (let k = 0; k < 16; k++) {                     // 나뭇결
        x.strokeStyle = `rgba(120,120,120,${0.05 + Math.random() * 0.1})`;
        x.lineWidth = 0.8 + Math.random();
        const gx = i + 2 + Math.random() * (pw - 4);
        x.beginPath(); x.moveTo(gx, 0);
        x.bezierCurveTo(gx + 3, s * 0.33, gx - 3, s * 0.66, gx + 1, s);
        x.stroke();
      }
      x.fillStyle = 'rgba(0,0,0,0.32)'; x.fillRect(i + pw - 2, 0, 2, s); // 판재 틈
      x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(i, 0, 1, s);
    }
  },

  stone(x, s) {
    x.fillStyle = '#9f9f9f'; x.fillRect(0, 0, s, s);     // 줄눈
    const cells = 6, cs = s / cells;
    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        const pad = 2 + Math.random() * 3;
        const jx = Math.random() * 4 - 2, jy = Math.random() * 4 - 2;
        const v = 190 + ((Math.random() * 30 - 15) | 0);
        x.fillStyle = `rgb(${v},${v - 3},${v - 6})`;
        roundRect(x, gx * cs + pad + jx, gy * cs + pad + jy, cs - pad * 2, cs - pad * 2, 4 + Math.random() * 4);
        x.fill();
        x.fillStyle = 'rgba(0,0,0,0.12)';
        x.fillRect(gx * cs + pad + jx, gy * cs + pad + jy + (cs - pad * 2) - 3, cs - pad * 2, 3);
      }
    }
  },

  shingle(x, s) {                                        // 지붕 슁글/기와
    x.fillStyle = '#b9b9b9'; x.fillRect(0, 0, s, s);
    const rh = 30, tw = 44;
    let row = 0;
    for (let y = -rh; y < s + rh; y += rh) {
      const off = (row % 2) ? -tw / 2 : 0;
      for (let tx = off - tw; tx < s + tw; tx += tw) {
        const v = 180 + ((Math.random() * 30 - 15) | 0);
        x.fillStyle = `rgb(${v},${v},${v})`;
        roundRect(x, tx + 1, y, tw - 2, rh + rh * 0.6, 5); x.fill();
        x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(tx, y + rh - 3, tw, 3);
      }
      row++;
    }
  },

  floorWood(x, s) {                                      // 원목 마루
    x.fillStyle = '#c9c9c9'; x.fillRect(0, 0, s, s);
    const ph = 34;
    let row = 0;
    for (let y = 0; y < s; y += ph) {
      const seam = (row % 3) * (s / 3);
      const v = 206 + ((Math.random() * 14 - 7) | 0);
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(0, y, s, ph - 2);
      for (let k = 0; k < 18; k++) {
        x.strokeStyle = `rgba(120,120,120,${0.05 + Math.random() * 0.08})`;
        x.lineWidth = 0.8;
        const gy = y + 2 + Math.random() * (ph - 4);
        x.beginPath(); x.moveTo(0, gy);
        x.bezierCurveTo(s * 0.3, gy + (Math.random() * 2 - 1), s * 0.6, gy + (Math.random() * 2 - 1), s, gy);
        x.stroke();
      }
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, y + ph - 2, s, 2);
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(0, y, s, 1);
      x.fillStyle = 'rgba(0,0,0,0.25)';
      x.fillRect(seam, y, 2, ph);
      x.fillRect((seam + s / 2) % s, y, 2, ph);
      row++;
    }
  },

  floorTile(x, s) {                                      // 타일
    x.fillStyle = '#b6b6b6'; x.fillRect(0, 0, s, s);     // 줄눈
    const cells = 4, cs = s / cells, g = 3;
    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        const v = 214 + ((Math.random() * 12 - 6) | 0);
        x.fillStyle = `rgb(${v},${v},${v})`;
        x.fillRect(gx * cs + g, gy * cs + g, cs - g * 2, cs - g * 2);
        x.fillStyle = 'rgba(255,255,255,0.12)';
        x.fillRect(gx * cs + g, gy * cs + g, cs - g * 2, (cs - g * 2) * 0.4);
      }
    }
  },

  plaster(x, s) {                                        // 실내 도장/미장 벽 (은은한 질감)
    x.fillStyle = '#ededed'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 6000; i++) {
      const v = (Math.random() * 30 - 15) | 0;
      x.fillStyle = `rgba(${230 + v},${230 + v},${230 + v},0.05)`;
      x.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  },

  fabric(x, s) {                                         // 패브릭 직조
    const step = 5;
    for (let y = 0; y < s; y += step) {
      for (let xx = 0; xx < s; xx += step) {
        const warp = ((xx / step + y / step) % 2) === 0;
        const v = warp ? 198 : 176;
        x.fillStyle = `rgb(${v},${v},${v})`;
        x.fillRect(xx, y, step - 1, step - 1);
      }
    }
    for (let i = 0; i < 4000; i++) {
      x.fillStyle = 'rgba(0,0,0,0.04)';
      x.fillRect(Math.random() * s, Math.random() * s, 1, 1);
    }
  },

  grass(x, s) {                                          // 잔디 마당 (얼룩진 풀 + 짧은 잎)
    x.fillStyle = '#b4b4b4'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {                       // 큰 얼룩 — 타일 반복 티가 덜 나게
      const v = 150 + ((Math.random() * 70) | 0);
      const r = s * (0.08 + Math.random() * 0.18);
      const cx = Math.random() * s, cy = Math.random() * s;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${v},${v},${v},0.2)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      x.fillStyle = g;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { x.save(); x.translate(ox, oy); x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore(); }
    }
    for (let i = 0; i < 9000; i++) {                     // 풀잎
      const v = 110 + ((Math.random() * 130) | 0);
      x.strokeStyle = `rgba(${v},${v},${v},0.55)`;
      x.lineWidth = 1;
      const px = Math.random() * s, py = Math.random() * s, len = 2 + Math.random() * 4;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() * 2 - 1), py - len); x.stroke();
    }
  },

  metalSidingV(x, s) {                                   // 세로 골 메탈사이딩 (골 간격 약 80mm + 우드 프린트 결)
    x.fillStyle = '#cfcfcf'; x.fillRect(0, 0, s, s);
    for (let k = 0; k < 40; k++) {                       // 프린트 나뭇결(세로, 옅게)
      x.strokeStyle = `rgba(110,110,110,${0.05 + Math.random() * 0.08})`;
      x.lineWidth = 0.8 + Math.random() * 1.2;
      const gx = Math.random() * s;
      x.beginPath(); x.moveTo(gx, 0);
      x.bezierCurveTo(gx + 4, s * 0.33, gx - 4, s * 0.66, gx + 1, s);
      x.stroke();
    }
    const n = 16, rw = s / n;                            // 골(리브)
    for (let i = 0; i < n; i++) {
      const gx = i * rw;
      const g = x.createLinearGradient(gx, 0, gx + rw, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(0.18, 'rgba(255,255,255,0.22)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.05)'); g.addColorStop(0.85, 'rgba(0,0,0,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
      x.fillStyle = g; x.fillRect(gx, 0, rw, s);
    }
  },

  slat(x, s) {                                           // 실내 아트월 템바보드 (세로 루버, 틈 어둡게)
    const n = 12, sw = s / n;
    x.fillStyle = '#6e6e6e'; x.fillRect(0, 0, s, s);     // 루버 사이 그림자 홈
    for (let i = 0; i < n; i++) {
      const gx = i * sw, v = 205 + ((Math.random() * 12 - 6) | 0);
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(gx + 2, 0, sw - 4, s);
      for (let k = 0; k < 4; k++) {                      // 결
        x.strokeStyle = `rgba(120,120,120,${0.06 + Math.random() * 0.08})`; x.lineWidth = 0.8;
        const lx = gx + 3 + Math.random() * (sw - 6);
        x.beginPath(); x.moveTo(lx, 0); x.lineTo(lx + (Math.random() * 2 - 1), s); x.stroke();
      }
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(gx + 2, 0, 1.5, s);
    }
  },

  deckBoard(x, s) {                                      // 합성데크 (폭 약 140mm 판재 + 틈, 은은한 결)
    const n = 10, bh = s / n;
    x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, s, s);     // 판재 사이 틈
    for (let i = 0; i < n; i++) {
      const y = i * bh;
      const v = 196 + ((Math.random() * 14 - 7) | 0);    // 판재별 미세 톤차 (대비 낮게 → 멀리서 반짝임 없음)
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(0, y + 1, s, bh - 2.5);
      for (let k = 0; k < 5; k++) {                      // 결 — 가늘고 옅게
        x.strokeStyle = `rgba(120,120,120,${0.04 + Math.random() * 0.05})`;
        x.lineWidth = 1;
        const gy = y + 3 + Math.random() * (bh - 6);
        x.beginPath(); x.moveTo(0, gy);
        x.bezierCurveTo(s * 0.33, gy + (Math.random() * 2 - 1), s * 0.66, gy + (Math.random() * 2 - 1), s, gy);
        x.stroke();
      }
      // 판재 이음(엇갈림)
      x.fillStyle = 'rgba(0,0,0,0.18)';
      x.fillRect(((i * 0.37) % 1) * s, y + 1, 1.5, bh - 2.5);
    }
  },

  woodGrain(x, s) {                                      // 가구 원목 결
    x.fillStyle = '#cdcdcd'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      const y = Math.random() * s;
      x.strokeStyle = `rgba(120,120,120,${0.05 + Math.random() * 0.12})`;
      x.lineWidth = 0.8 + Math.random() * 1.5;
      x.beginPath(); x.moveTo(0, y);
      x.bezierCurveTo(s * 0.33, y + (Math.random() * 8 - 4), s * 0.66, y + (Math.random() * 8 - 4), s, y + (Math.random() * 6 - 3));
      x.stroke();
    }
    const g = x.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0.05)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  },
};

// 패턴 종류 → 생성기 호출 옵션
function draw(kind, ctx, size) {
  switch (kind) {
    case 'metalSiding':   return GEN.siding(ctx, size, { ph: 22, sheen: 0.18 });
    case 'cementSiding':  return GEN.siding(ctx, size, { ph: 34, grain: true });
    case 'ceramicSiding': return GEN.siding(ctx, size, { ph: 28, sheen: 0.06 });
    default:              return GEN[kind](ctx, size);
  }
}

// ---------------------------------------------------------------------------
// 텍스처 캐시 (패턴은 1회만 그림 → 성능)
// ---------------------------------------------------------------------------
const _base = new Map();   // kind → 원본 CanvasTexture
const _tiled = new Map();  // kind|repX|repY → repeat 적용본

function baseTexture(kind) {
  if (_base.has(kind)) return _base.get(kind);
  const c = newCanvas(256);
  draw(kind, c.getContext('2d'), 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  _base.set(kind, tex);
  return tex;
}

// repeat 은 0.5 단위로 반올림해 캐시 → 편집마다 텍스처가 무한히 늘지 않음
function tiled(kind, repX, repY) {
  repX = Math.max(0.5, Math.round(repX * 2) / 2);
  repY = Math.max(0.5, Math.round(repY * 2) / 2);
  const key = `${kind}|${repX}|${repY}`;
  if (_tiled.has(key)) return _tiled.get(key);
  const t = baseTexture(kind).clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  t.needsUpdate = true;
  _tiled.set(key, t);
  return t;
}

function makeMat(kind, color, repX, repY, opts = {}) {
  const map = tiled(kind, repX, repY);
  const m = new THREE.MeshStandardMaterial({
    color,
    map,
    bumpMap: map,
    bumpScale: opts.bumpScale ?? 1.2,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.0,
  });
  if (opts.side) m.side = opts.side;
  if (opts.envMapIntensity != null) m.envMapIntensity = opts.envMapIntensity;
  return m;
}

const rep = (dimMM, kind) => dimMM / TILE[kind];

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------
const EXT_KIND = {
  metal: 'metalSiding', metalV: 'metalSidingV', cement: 'cementSiding', ceramic: 'ceramicSiding',
  stucco: 'stucco', brick: 'brick', wood: 'woodSiding', stone: 'stone',
};

// 외장재 (벽 1장 길이 lenMM × 높이 hMM)
export function exteriorMaterial(matId, color, lenMM, hMM, roughness, metalness) {
  const kind = EXT_KIND[matId] || 'cementSiding';
  return makeMat(kind, color, rep(lenMM, kind), rep(hMM, kind), {
    roughness, metalness,
    bumpScale: (matId === 'brick' || matId === 'stone') ? 3 : 1.5,
    side: THREE.DoubleSide,
  });
}

// 지붕 (슁글)
export function roofMaterial(color, wMM, dMM) {
  return makeMat('shingle', color, rep(wMM, 'shingle'), rep(dMM, 'shingle'), {
    roughness: 0.8, bumpScale: 2, side: THREE.DoubleSide,
  });
}

// 바닥 (방 종류에 따라 마루/타일)
const TILE_ROOMS = ['bath', 'utility', 'balcony', 'entrance'];   // 주방은 요즘 시공처럼 마루
const DECK_ROOMS = ['deck', 'porch', 'balcony'];
const DECK_COLOR = '#7c716a';   // 합성데크 (그레이 브라운 — 세움 본점 시공 사진 톤)
export function floorMaterial(roomType, color, wMM, dMM) {
  if (DECK_ROOMS.includes(roomType)) {
    // 야외 데크·포치: 실제 합성데크 판재 질감. 요철(bump)을 약하게 해 멀리서 반짝이지 않게
    return makeMat('deckBoard', DECK_COLOR, rep(wMM, 'deckBoard'), rep(dMM, 'deckBoard'), {
      roughness: 0.85, bumpScale: 0.35, envMapIntensity: 0.4,
    });
  }
  const kind = TILE_ROOMS.includes(roomType) ? 'floorTile' : 'floorWood';
  return makeMat(kind, color, rep(wMM, kind), rep(dMM, kind), {
    // 요철은 약하게 — 강하면 가는 줄눈·결이 카메라 움직일 때 반짝거림
    roughness: kind === 'floorTile' ? 0.5 : 0.7, bumpScale: 0.4,
    envMapIntensity: 0.6,   // 밝은 타일·마루가 하얗게 날아가지 않게
  });
}

// 바깥 지면 (잔디) — sizeMM: 정사각 지면 한 변
export function groundMaterial(sizeMM) {
  // 지면은 환경광을 약하게 받아야 집 그림자가 또렷하게 떨어짐
  return makeMat('grass', '#7a925c', rep(sizeMM, 'grass'), rep(sizeMM, 'grass'), { roughness: 1, bumpScale: 1.5, envMapIntensity: 0.35 });
}

// 아트월 템바보드 (세로 루버) — 폭 lenMM × 높이 hMM
export function slatMaterial(color, lenMM, hMM) {
  return makeMat('slat', color, rep(lenMM, 'slat'), Math.max(1, rep(hMM, 'slat') / 3), { roughness: 0.7, bumpScale: 0.8, envMapIntensity: 0.5 });
}

// 처마 밑면·포치 천장 루바 (원목 판재) — UV 를 mm/1700 단위로 넣어 쓰므로 반복 1
export function soffitWoodMaterial(color) {
  // 판재 폭을 좁게(약 100mm) — 세로 반복 2.2배
  //   아래를 향한 면이라 햇빛을 못 받으므로 환경광 반사를 높여 밝은 소나무 톤 유지
  return makeMat('floorWood', color, 1, 2.2, { roughness: 0.75, bumpScale: 0.3, envMapIntensity: 1.5 });
}

// 실내 벽 (은은한 미장)
export function wallMaterial(color) {
  // 환경광을 줄여 하얀 벽이 날아가지 않고 햇빛 그림자·구석 음영이 보이게
  return makeMat('plaster', color, 3, 3, { roughness: 0.95, bumpScale: 0.3, envMapIntensity: 0.45 });
}

// 가구 마감 (fabric/wood 는 텍스처, 그 외는 null → 호출부에서 단색 사용)
export function furnitureMaterial(finish, color, wMM, hMM) {
  if (finish === 'fabric')
    return makeMat('fabric', color, Math.max(1, rep(wMM, 'fabric')), Math.max(1, rep(hMM, 'fabric')),
      { roughness: 0.95, bumpScale: 0.6 });
  if (finish === 'wood')
    return makeMat('woodGrain', color, Math.max(1, rep(wMM, 'woodGrain')), Math.max(1, rep(hMM, 'woodGrain')),
      { roughness: 0.65, bumpScale: 0.7 });
  return null;
}

// 외장재 id → 패턴 종류 (마감재 라이브러리 썸네일용)
export { EXT_KIND };

// 마감재 미리보기 썸네일 (grayscale 패턴 × 색상 → dataURL)
// kind: 'metalSiding' | 'brick' | 'stucco' | 'shingle' | 'floorTile' ... (draw()가 아는 종류)
export function swatchDataURL(kind, color = '#cccccc', size = 88) {
  const c = newCanvas(size);
  const x = c.getContext('2d');
  draw(kind, x, size);
  x.globalCompositeOperation = 'multiply';   // 무채색 질감 위에 색을 곱해 입힘
  x.fillStyle = color;
  x.fillRect(0, 0, size, size);
  x.globalCompositeOperation = 'source-over';
  return c.toDataURL();
}
