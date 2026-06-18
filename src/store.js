// 세움 홈플래너 - 상태 관리 (단순 pub/sub + 되돌리기/저장)
import { createDefaultDesign, normalize } from './data.js';

const LS_KEY = 'seum-homeplanner:current';
const LS_LIST = 'seum-homeplanner:saved';
const LS_TPL = 'seum-homeplanner:my-templates'; // 내 기본 도면(이 기기)

class Store {
  constructor() {
    this.design = normalize(this._load() || createDefaultDesign());
    this.selectedRoom = null;     // room id
    this.selectedFurniture = null; // furniture id
    this.selectedOpening = null;  // opening id
    this.cloudId = null;          // 현재 도면의 클라우드 저장 id (있으면)
    this._subs = new Set();
    this._history = [];
    this._future = [];
  }

  // --- 구독 ---
  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
  emit() { this._subs.forEach((fn) => fn(this)); }

  // --- 되돌리기 스냅샷 ---
  snapshot() {
    this._history.push(JSON.stringify(this.design));
    if (this._history.length > 60) this._history.shift();
    this._future = [];
  }
  undo() {
    if (!this._history.length) return;
    this._future.push(JSON.stringify(this.design));
    this.design = JSON.parse(this._history.pop());
    this._clampSelection();
    this.emit();
  }
  redo() {
    if (!this._future.length) return;
    this._history.push(JSON.stringify(this.design));
    this.design = JSON.parse(this._future.pop());
    this._clampSelection();
    this.emit();
  }
  _clampSelection() {
    if (!this.design.rooms.some((r) => r.id === this.selectedRoom)) this.selectedRoom = null;
    if (!this.design.furniture.some((f) => f.id === this.selectedFurniture)) this.selectedFurniture = null;
    if (!(this.design.openings || []).some((o) => o.id === this.selectedOpening)) this.selectedOpening = null;
  }

  // --- 변경 (스냅샷 후 emit) ---
  commit(mutator) {
    this.snapshot();
    mutator(this.design);
    this.persist();
    this.emit();
  }

  // 드래그 중처럼 연속 변경은 스냅샷 없이
  liveUpdate(mutator) {
    mutator(this.design);
    this.emit();
  }
  liveEnd() { this.persist(); }

  select(roomId, furnitureId, openingId) {
    this.selectedRoom = roomId ?? null;
    this.selectedFurniture = furnitureId ?? null;
    this.selectedOpening = openingId ?? null;
    this.emit();
  }

  // --- 영속화 ---
  persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(this.design)); } catch (e) {} }
  _load() {
    try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }

  newDesign() {
    this.commit(() => {});
    this.design = normalize(createDefaultDesign());
    this.selectedRoom = this.selectedFurniture = this.selectedOpening = null;
    this.persist();
    this.emit();
  }

  // 이름으로 저장 / 목록
  saveAs(name) {
    const list = this.savedList();
    const entry = { name: name || this.design.name, savedAt: Date.now(), data: this.design };
    const idx = list.findIndex((e) => e.name === entry.name);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    localStorage.setItem(LS_LIST, JSON.stringify(list));
    this.design.name = entry.name;
    this.persist();
    this.emit();
  }
  savedList() {
    try { return JSON.parse(localStorage.getItem(LS_LIST) || '[]'); } catch (e) { return []; }
  }
  loadSaved(name) {
    const entry = this.savedList().find((e) => e.name === name);
    if (!entry) return;
    this.design = normalize(JSON.parse(JSON.stringify(entry.data)));
    this.selectedRoom = this.selectedFurniture = this.selectedOpening = null;
    this._history = []; this._future = [];
    this.persist();
    this.emit();
  }

  // --- 내 기본 도면 (클라우드 없이 이 기기에 저장하는 로컬 템플릿) ---
  localTemplates() {
    try { return JSON.parse(localStorage.getItem(LS_TPL) || '[]'); } catch (e) { return []; }
  }
  // design 을 주면 그 도면을, 안 주면 현재 도면을 내 기본 도면으로 등록
  // keepUnderlay: PDF/이미지 기반 '밑그림 도면'은 배경을 살려둠
  addLocalTemplate({ title, productType, design, keepUnderlay = false } = {}) {
    const list = this.localTemplates();
    const src = design ? normalize(JSON.parse(JSON.stringify(design))) : JSON.parse(JSON.stringify(this.design));
    if (!Array.isArray(src.rooms)) throw new Error('도면 형식이 아닙니다.');
    if (src.underlay && !keepUnderlay) src.underlay = null;  // 용량 큰 밑그림은 기본 제외
    src.productType = productType || src.productType || '';
    const name = (title || src.name || '내 기본 도면').trim();
    src.name = name;
    const entry = { id: 't' + Date.now().toString(36) + Math.floor(Math.random() * 1000), title: name, productType: src.productType, savedAt: Date.now(), data: src };
    list.push(entry);
    localStorage.setItem(LS_TPL, JSON.stringify(list));
    return entry;
  }
  removeLocalTemplate(id) {
    localStorage.setItem(LS_TPL, JSON.stringify(this.localTemplates().filter((e) => e.id !== id)));
  }

  // 도면 객체를 통째로 적용 (템플릿/클라우드 불러오기 공용)
  loadInto(designObj, { cloudId = null } = {}) {
    this.design = normalize(JSON.parse(JSON.stringify(designObj)));
    this.cloudId = cloudId;
    this.selectedRoom = this.selectedFurniture = this.selectedOpening = null;
    this._history = []; this._future = [];
    this.persist();
    this.emit();
  }

  exportJSON() { return JSON.stringify(this.design, null, 2); }
  importJSON(text) {
    const d = JSON.parse(text);
    if (!d.rooms) throw new Error('도면 형식이 아닙니다.');
    this.commit(() => {});
    this.design = normalize(d);
    this.selectedRoom = this.selectedFurniture = this.selectedOpening = null;
    this.persist();
    this.emit();
  }
}

export const store = new Store();
