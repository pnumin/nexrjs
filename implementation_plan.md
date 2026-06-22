# 구현 계획서: OpenDART 웹 대시보드

이 문서는 OpenDART API 연동 웹 대시보드를 Next.js (App Router) 기반으로 개발하기 위한 구현 계획을 정의합니다.

---

## 1. 개요 및 연구 결과

### OpenDART API 구조 분석
1. **공시검색 API** (`GET https://opendart.fss.or.kr/api/list.json`)
   - 최근 3개월의 공시 목록을 검색 기간, 법인 분류, 공시 유형 필터에 맞춰 가져옵니다.
   - 접수번호(`rcept_no`)를 활용하여 DART 상세 뷰어로 연결합니다.
2. **기업개황 API** (`GET https://opendart.fss.or.kr/api/company.json`)
   - 회사의 고유번호(`corp_code`)를 바탕으로 대표자명, 주소, 매출 결산월 등의 정보를 가져옵니다.
3. **고유번호 XML API** (`GET https://opendart.fss.or.kr/api/corpCode.xml`)
   - DART 등록 법인 전체의 고유번호가 압축파일(ZIP) 내 `CORPCODE.xml` 형태로 제공됩니다.
   - 대시보드의 원활한 회사명-고유번호 자동 매핑을 위해, 서버(Next.js Route Handlers)가 시작할 때 이 파일을 다운로드 및 메모리/로컬 JSON 캐시로 변환하여 보관하고 자동완성 API를 제공합니다.

### 보안 요건
- API Key(`517f6e68651d9dcb10b306a9aeaca2f466e1e941`)는 클라이언트에 절대 노출되지 않고 Next.js Route Handlers를 통해 Proxy 형식으로 호출되도록 설계합니다.

---

## 2. 사용자 검토 요구사항 (User Review Required)

> [!IMPORTANT]
> **API Key 및 환경 변수 처리**
> 제공된 API Key를 `process.env.OPENDART_API_KEY` 환경 변수로 관리하여 배포 시 안전하게 취급되도록 합니다. 로컬 개발 환경용 `.env.local`을 빌드 시 자동 생성합니다.

> [!NOTE]
> **회사 고유번호 데이터 캐싱 방식**
> `corpCode.xml` (약 10MB 이상의 대용량 ZIP 파싱 필요)을 서버 실행 시점에 단 한 번 금융감독원 서버에서 다운로드 받아 로컬 디스크에 JSON 형식으로 변환 및 캐싱합니다. 이로써 사용자 검색 시 지연 없는(0.1초 이내) 자동완성 조회가 가능합니다. 이를 위해 `adm-zip`과 `xml2js` 라이브러리를 사용합니다.

---

## 3. 제안하는 변경 사항 (Proposed Changes)

프로젝트 루트는 `c:\Users\user\Desktop\codexwork\nexrjs` 입니다. 해당 디렉토리에 Next.js 프로젝트를 생성하고 아래 파일들을 구현합니다.

### 3.1. [NEW] 프로젝트 환경 설정 및 패키지 설치
* **의존성 라이브러리**:
  * `adm-zip`: ZIP 압축 해제용
  * `xml2js`: DART 고유번호 XML 파싱용
  * `lucide-react`: 프리미엄 대시보드 아이콘 팩

### 3.2. [NEW] Next.js Route Handlers (API Proxy)
DART API는 CORS 제한이 있을 수 있으며 API Key 노출 방지를 위해 필수적으로 프록시 라우트가 필요합니다.

* `app/api/dart/corp-cache/route.js`: 고유번호 XML을 최초 1회 로딩하여 캐싱하고 검색 결과를 반환하는 API
* `app/api/dart/list/route.js`: 공시검색 API Proxy
* `app/api/dart/company/route.js`: 기업개황 API Proxy

### 3.3. [NEW] UI 디자인 및 컴포넌트 개발
Vanilla CSS를 사용하여 극도의 시각적 완성도와 성능을 구현합니다.
* **다크/라이트 듀얼 테마 구현**:
  * CSS Custom Variables (`--bg-primary`, `--text-primary`, `--accent` 등)를 사용하여 `:root` 및 `[data-theme="dark"]`, `[data-theme="light"]`에 따라 다르게 변수를 선언합니다.
  * React Context 또는 훅을 생성하여 브라우저 로컬 스토리지에 테마 설정을 동기화하고, `document.documentElement.setAttribute('data-theme', theme)` 코드를 실행하여 테마를 전환합니다.
* `app/globals.css`: 메인 다크/라이트 테마 스타일링 정의, Glassmorphism, 펄스 애니메이션 등
* `app/layout.js`: SEO를 위한 메타데이터 설정 및 기본 HTML5 뼈대, 테마 상태 유지를 위한 초기 스크립트 주입
* `app/page.js`: 대시보드 메인 화면. 최근 공시 목록 리스트, 검색/필터 컴포넌트, 기업개황 드로워/팝업 컴포넌트 결합 및 테마 스위처 컴포넌트 포함

---

## 4. 검증 계획 (Verification Plan)

### Automated Tests
- 없음

### Manual Verification
1. **서버 구동 검증**: `npm run dev` 실행 시 DART 고유번호 캐싱 로그가 성공적으로 출력되는지 확인.
2. **검색 및 자동완성 테스트**: 상단 검색창에 '삼성전자' 또는 'SK하이닉스'를 입력했을 때 자동완성 목록이 즉시 노출되고, 선택 시 기업개황 카드에 정식 회사 정보가 렌더링되는지 확인.
3. **필터링 테스트**: 기간 변경, 공시유형 선택(예: 정기공시만 선택) 시 목록이 조건에 맞게 업데이트되는지 확인.
4. **테마 전환 테스트**: 헤더의 테마 토글 버튼을 눌렀을 때, 다크 모드와 라이트 모드가 즉각 전환되는지 및 새로고침 후에도 유지되는지 확인.
5. **접수번호 링크 이동**: 공시 보고서명 클릭 시 DART 공식 뷰어 새 탭이 열리고 올바른 보고서가 로드되는지 확인.
