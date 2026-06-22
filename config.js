// 세움 홈플래너 - 런타임 설정
// Supabase 클라우드를 켜려면 아래 두 값을 채우세요. (둘 다 공개되어도 안전한 값입니다)
//   - supabaseUrl     : Supabase 프로젝트 URL  (예: https://xxxx.supabase.co)
//   - supabaseAnonKey : Supabase anon public key
// 비워두면 클라우드 기능만 비활성화되고 나머지(편집/3D/템플릿/인쇄)는 정상 동작합니다.
// 설정 방법은 supabase/README.md 참고.
// 대표(통합) 상담 번호
//   - repPhone : 고객 상담이 모두 이 한 번호로 연결됩니다. (예: '1588-0000')
//                상단바 [📞 상담전화] 버튼이 이 번호로 전화를 겁니다.
//                비워두면 버튼이 숨겨집니다.
//   - repPhoneLabel : 버튼/안내에 함께 표시할 이름 (선택, 예: '세움 통합상담')
window.SEUM_CONFIG = {
  supabaseUrl: 'https://yjfpwgxwcuvfecssmvdj.supabase.co',
  supabaseAnonKey: 'sb_publishable_hApl76RBqdo4OmrM15qSkw_oHrUfdpX',
  repPhone: '1588-0000',
  repPhoneLabel: '세움 통합상담',
};
