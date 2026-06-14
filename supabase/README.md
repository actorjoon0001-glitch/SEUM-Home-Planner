# Supabase 클라우드 설정 (5분)

영업사원 계정 로그인 + 서버 저장 + 도면 공유 + 고객용 공유 링크를 켜는 방법입니다.
설정 전에도 앱의 편집/3D/템플릿/인쇄 기능은 그대로 동작합니다.

## 1. Supabase 프로젝트 만들기
1. https://supabase.com 가입 → **New project** 생성 (무료 플랜으로 충분)
2. 비밀번호/리전 설정 후 프로젝트 생성 완료까지 대기

## 2. 데이터베이스 준비
1. 좌측 **SQL Editor** 열기
2. 이 폴더의 [`schema.sql`](./schema.sql) 내용을 붙여넣고 **Run**
   - `designs` 테이블 + 보안정책(RLS) + 트리거가 생성됩니다.

## 3. 로그인 방식 설정
- 좌측 **Authentication > Providers > Email** 활성화
- 내부용이라면 **Authentication > Providers > Email**에서 "Confirm email"을 꺼두면
  영업사원 가입 즉시 로그인할 수 있어 편합니다. (사내 정책에 맞게 선택)
- 또는 **Authentication > Users**에서 관리자가 직접 계정을 만들어 배포해도 됩니다.

## 4. 앱에 설정값 넣기
1. Supabase **Project Settings > API** 에서 두 값 복사
   - **Project URL**
   - **anon public** key  (공개되어도 안전한 키입니다. RLS로 보호됨)
2. 프로젝트 루트의 [`config.js`](../config.js) 에 붙여넣기:
   ```js
   window.SEUM_CONFIG = {
     supabaseUrl: 'https://xxxx.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...'
   };
   ```
3. Netlify에 다시 배포(또는 파일 교체)하면 상단 **클라우드** 버튼이 활성화됩니다.

## 사용
- **클라우드 ▸ 로그인** → 이메일/비밀번호
- **클라우드 ▸ 클라우드 저장**: 현재 도면을 서버에 저장
  - "영업사원 공유"를 켜면 동료의 *공유 도면* 목록에 보입니다.
  - "공용 템플릿"을 켜면 모두의 *템플릿* 갤러리에 등록됩니다.
- **공유 링크 복사**: 고객에게 보낼 보기 링크 생성 (`?id=...`).
  고객은 로그인 없이 해당 도면을 열어볼 수 있습니다.

## 공유 링크 동작 방식
- 링크에 도면 **id**가 담깁니다. 앱은 그 id로 Supabase에서 도면을 읽어옵니다.
- 비로그인 고객은 **공유(is_shared) 또는 템플릿(is_template)** 으로 표시된 도면만 열람 가능합니다(RLS).
