// 세움 홈플래너 - Supabase 클라우드 연동
// 계정 로그인 + 서버(DB) 저장 + 영업사원 간 공유 + 고객용 공유 링크.
// 설정값(window.SEUM_CONFIG)이 없으면 비활성화 상태로 동작하고, 앱의 나머지 기능은 정상 사용 가능.

let client = null;
let ready = false;
const subs = new Set();

const cfg = (typeof window !== 'undefined' && window.SEUM_CONFIG) || {};

export const cloud = {
  configured() { return !!(cfg.supabaseUrl && cfg.supabaseAnonKey); },
  ready() { return ready; },
  user: null,

  // Supabase 클라이언트 동적 로드 (CDN ESM)
  async init() {
    if (!this.configured()) return false;
    if (client) return true;
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data } = await client.auth.getSession();
      this.user = data?.session?.user || null;
      client.auth.onAuthStateChange((_ev, session) => {
        this.user = session?.user || null;
        this._emit();
      });
      ready = true;
      this._emit();
      return true;
    } catch (e) {
      console.error('[cloud] init 실패:', e);
      return false;
    }
  },

  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  _emit() { subs.forEach((fn) => fn(this)); },

  // --- 인증 ---
  async signIn(email, password) {
    await this.init();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async signUp(email, password) {
    await this.init();
    const { error } = await client.auth.signUp({ email, password });
    if (error) throw error;
  },
  async signOut() { if (client) await client.auth.signOut(); },

  // --- 도면 CRUD ---
  // 새로 저장(또는 기존 id 업데이트). data 는 도면 JSON.
  async saveDesign({ id, name, data, isShared = false, isTemplate = false }) {
    await this.init();
    if (!this.user) throw new Error('로그인이 필요합니다.');
    const row = {
      name, data,
      is_shared: isShared, is_template: isTemplate,
      owner: this.user.id, updated_at: new Date().toISOString(),
    };
    if (id) row.id = id;
    const { data: out, error } = await client.from('designs').upsert(row).select().single();
    if (error) throw error;
    return out;
  },

  async listMine() {
    await this.init();
    if (!this.user) return [];
    const { data, error } = await client.from('designs')
      .select('id,name,is_shared,is_template,updated_at,owner')
      .eq('owner', this.user.id).order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // 영업사원 간 공유된 도면 (본인 것 제외)
  async listShared() {
    await this.init();
    const { data, error } = await client.from('designs')
      .select('id,name,is_shared,is_template,updated_at,owner')
      .eq('is_shared', true).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).filter((d) => !this.user || d.owner !== this.user.id);
  },

  // 공용 단지/평형 템플릿 (DB에 등록된 것)
  async listTemplates() {
    await this.init();
    const { data, error } = await client.from('designs')
      .select('id,name,updated_at').eq('is_template', true).order('name');
    if (error) throw error;
    return data || [];
  },

  async getDesign(id) {
    await this.init();
    const { data, error } = await client.from('designs').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async removeDesign(id) {
    await this.init();
    const { error } = await client.from('designs').delete().eq('id', id);
    if (error) throw error;
  },

  // 공유 링크 생성 (현재 페이지 + ?id=)
  shareLink(id) {
    const u = new URL(window.location.href);
    u.search = '?id=' + encodeURIComponent(id);
    u.hash = '';
    return u.toString();
  },
};
