# Daily Routine 리뉴얼 통합 계획 (최종)

- 작성일: 2026-09-09
- 근거: `01-ux-plan-claude.md`(제품/UX), `02-architecture-plan-codex.md`(아키텍처). 두 문서가 다른 결론을 낸 항목은 이 문서의 결정을 따른다.
- 참고 앱 이미지: `../../conference/KakaoTalk_20260909_114258234*.png` 11장(습관 앱), `KakaoTalk_20260909_113029932.png`(다른 앱의 루틴 편집 폼: 시작/종료 날짜·반복 요일·시간·삭제), `KakaoTalk_20260909_113051346.jpg`(현재 앱 체크박스 열에 빨간 표시 = 이 옆에 시간·반복 요일을 넣어 달라는 요청)

---

## 1. 한눈에 보는 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 하단 탭바 | 처음부터 4탭: 홈 / 통계 / 목표 / 내정보 | 탭 위치를 나중에 바꾸지 않기 위해. R1의 목표 탭은 목표 태그 목록만 |
| 홈 구조 | 참고 앱 그대로: 월 헤더+🔥스트릭 → 주간 행(도넛) → 루틴/투두 세그먼트 → 필터 행 → 표 목록 → FAB | UX 계획 W-1, W-2 |
| 요일 반복 변경 시 과거 기록 | 적용일 이력(policies)로 보존. 과거 분모는 변하지 않음 | 아키텍처 계획 3.2. 단, 별도 컬렉션이 아니라 habit 안의 배열로 단순화 |
| Firestore 구조 | 문서 1개 통째 저장 → 워크스페이스 아래 소수 문서로 분할(habits 1개, todos/checks는 월별 1개) + merge 쓰기 | 1MiB 한도와 충돌 범위 축소. outbox/3-way 병합은 도입하지 않음 |
| 렌더링 | 안정된 shell + 화면 단위 부분 렌더 + 이벤트 위임 + textContent(인라인 onclick/innerHTML 문자열 삽입 제거) | 포커스 손실 및 XSS 해결 |
| 파일 구조 | ES module 약 20개 파일, 빌드 없음 | 46개 파일안은 과함. 200~400줄 기준 |
| 4분면 매트릭스 | 홈 > 투두 탭의 보기 전환(리스트 ⇄ 매트릭스) | 별도 화면 아님. 같은 todo 데이터 |
| 만다라트 | 목표 탭 > 목표 상세. 3×3 개요 → 세부목표 탭하면 3×3 확대 | 81칸을 한 화면에 넣지 않음 |
| 할 일 시간 | 투두 폼 🕒 필드 + 표 2열 시간 셀 + 시간순 정렬 | |
| 루틴 요일별 | 습관 폼 📅 반복 주기 시트(매일/매주 요일 선택) + isScheduled 기반 계산 | 모든 지표의 분모 |
| 알림 | R3. 앱 열려 있을 때 로컬 알림만. 백그라운드 푸시는 서버가 필요해 범위 밖 | GitHub Pages 정적 배포 제약 |

---

## 2. 현재 화면 → 새 화면 매핑 (무엇을 어디에 넣나)

### 2.1 홈 탭 (현재 "체크리스트" 뷰를 대체)

```
┌────────────────────────────────────────┐
│ 2026년 9월 ▾            🔥 12   ↕   ⋯  │  월 피커 / 전체 스트릭 / 순서변경 / 더보기
├────────────────────────────────────────┤
│  월    화    수    목    금    토    일 │
│ (◕)  (●)  [◑]  ( )  ( )  ( )  ( )     │  도넛=그날 달성률, ●초록=100%(초록불), [ ]=선택일
│  7     8     9    10    11    12    13 │
├────────────────────────────────────────┤
│ ≡  │      루틴       │      투두       │  세그먼트 탭
├────────────────────────────────────────┤
│ (하루 ▾) (💪건강)(☀️규칙) …      [📋]   │  기간 보기 / 목표 태그 칩 / 월간기록
├────────────────────────────────────────┤
│ ☀️ │ 일어나자마자 │ ☀️ 기상 시간 기록 🔥3│  체크 셀(체크됨: 이모지 채움) / 시간·요일 셀 / 이름
│    │   매일       │                      │
│    │  AM 9:00     │ 🏃 30분 운동         │  미체크: 빈 셀
│    │  월·수·금    │                      │
│    │   출근길     │ 📖 독서 30분         │  상황 트리거는 시간 대신 텍스트
│    │   평일       │                      │
│                                  (+)   │  FAB
├────────────────────────────────────────┤
│   🏠홈     📊통계     🎯목표    👤내정보 │
└────────────────────────────────────────┘
```

| 현재 요소 | 처리 |
|---|---|
| 헤더 제목 + 탭(체크리스트/루틴 관리) + ⚙️ | 제거. 월 헤더 + 하단 탭바로 대체. 루틴 관리 탭은 FAB + 액션 시트로 흡수 |
| 날짜 ‹ › + 선택일 ±3일 주간 행 + 3색 점 | 월~일 고정 주간 행 + 도넛 파이 + 초록불로 교체. 좌우 스와이프로 주 이동 |
| 진행률 카드 + 스트릭 카드 | 삭제. 주간 도넛과 헤더 🔥 배지가 대체 |
| 카테고리 그룹(6종 고정) | 제거. 6개 카테고리는 마이그레이션 시 목표 태그 6개로 변환. 필터 칩으로 노출 |
| 체크박스 리스트 | 3열 표(체크 셀 / **시간·반복 요일 셀** / 이모지+이름+🔥). 체크 셀은 현재 위치(왼쪽) 유지, 그 바로 옆 셀에 시간(위)과 반복 요일 축약(아래) 2줄 표시. 이 셀을 탭하면 전체 폼으로 가지 않고 **빠른 설정 시트**(요일 칩 7개 + 시간 입력 + 시작/종료 날짜)가 바로 열림 |
| 오늘의 할 일 섹션 | 투두 탭으로 분리. 빠른 입력창은 투두 탭 하단에 유지 |
| ▲▼ 이동 버튼 | ↕ 순서변경 화면(드래그 + ▲▼ 폴백) |
| 인라인 이름 수정 / × 삭제 | 습관 행 이름 탭 → 액션 시트(월간 기록/수정/복사/쉬어가기/끝내기/삭제) |

### 2.2 투두 탭 (리스트 / 매트릭스 전환)

```
리스트                                      매트릭스
(하루 ▾)          [☰][⊞]   [📅]           (하루 ▾)          [☰][⊞]   [📅]
1 │ 09:30  │ 🔥 택배 찾아오기      │ ✔     ┌ 🔥⭐ 지금 하기 (2) ┬ ⭐ 계획하기 (1) ┐
2 │ 14:00  │ ⭐ 병원 예약 전화     │       │ ☐ 18:30 보고서    │ ☐ 14:00 병원   │
3 │ 18:30! │ 🔥⭐ 보고서 제출      │       ├ 🔥 빨리 끝내기 (0)┼ 나중에 (2)     ┤
4 │   –    │ 달리기               │       │                   │ ☐ 달리기        │
[ 할 일 빠른 추가…                    ↵ ]  └ 미분류 (1) ☐ 회의 참석 [사분면에 넣기] ┘
```

- 정렬: 시간 있는 항목 시간순 → 시간 없는 항목(사분면 Q1→Q4 → 수동 순서).
- 지난 시간 + 미완료 + 오늘 = 빨간 `!`.
- 사분면은 `urgent`/`important` 두 boolean에서 파생. 매트릭스에서 드래그 또는 길게 눌러 이동.

### 2.3 습관 추가/수정 폼 (전체 화면)

두 번째 참고 이미지(113029932)의 단순한 행 목록 형태를 따른다. 상단은 `‹ 루틴 확인` 헤더, 이름 입력은 밑줄 한 줄.

```
┌────────────────────────────────────────┐
│ ‹              루틴               확인 │
│ [☀️] 루틴 입력_____________________     │
│ ┌ 시작 날짜              2026. 9. 9. › │
│ └ 종료 날짜              없음        › │  선택. 지정하면 그날까지만 예정
│ ┌ 반복      월요일, 수요일, 금요일   › │  탭 → 요일 칩 시트 (매일/평일/주말 프리셋)
│ ┌ 시간                   AM 9:00    › │  탭 → 시간 / 상황("출근길") 세그먼트 시트
│ ┌ 목표 태그              💪 건강     › │  R2
│ ┌ 투두 탭에도 표시          [ OFF ]   │  R2. 참고 앱의 "수동으로 할 일 추가"에 해당
│ ┌ 알림 / 하루 달성 수 / 난이도        │  R3
│                                        │
│ [              삭제(빨강)            ] │  수정 모드에서만. 확인 다이얼로그 후 삭제
└────────────────────────────────────────┘
```

| 순서 | 필드 | 데이터 | 릴리스 |
|---|---|---|---|
| 1 | 이름 + 이모지 | `name`, `emoji` | R1 |
| 2 | 시작 날짜 (기본 오늘) | `startDate` | R1 |
| 3 | 종료 날짜 (기본 없음) | `endDate` | R1 |
| 4 | 반복 → 요일 칩 시트(매일 / 평일 / 주말 프리셋 + 월~일 토글) | `repeat.days[]` | R1 |
| 5 | 시간 → 시트(시간 탭 `<input type=time>` / 상황 탭 "출근길" 등) | `trigger{type,value}` | R1 |
| 6 | 🏷 목표 태그(다중) | `goalTagIds[]` | R2 |
| 7 | 투두 탭에도 표시 토글 | `showInTodo` | R2 |
| 8 | 🔔 알림(앱 내) | `reminder` | R3 |
| 9 | ✔ 하루 달성 수 | `targetCount` | R3 |
| 10 | ⭕ 미니/플러스/맥스 | `levels` | R3 |
| 11 | 🔗 만다라트 연결(읽기 전용, 프리필로만) | `mandalaRef` | R3 |

- 저장 버튼은 헤더 우측 "확인". 수정 모드 하단에 빨간 "삭제" 버튼(참고 폼과 동일). 액션 시트의 삭제와 같은 동작.
- 반복/시간 두 행은 홈 표의 시간·요일 셀에서 여는 **빠른 설정 시트**와 같은 컴포넌트를 재사용한다. 즉 홈에서 셀 탭 → 요일·시간·시작/종료만 있는 축약 시트, 폼에서 행 탭 → 같은 시트.
- 반복 표시 규칙: 7일 전체 = "매일", 월~금 = "평일", 토·일 = "주말", 그 외 = "월, 수, 금" 식 나열. 홈 셀에서는 "월·수·금"으로 더 짧게.

### 2.4 통계 탭 (신규)

- 세그먼트: 월간 / 주간 / 초록불.
- 월간: 목표 달성률 카드(% + 초록불 N일 + 최장 연속) → 습관별 카드 2열(1~말일 그리드, 달성률%, 달성 횟수) → 투두 카드.
- 주간: 습관 × 요일 표(■체크 □미체크 – 예정 아님 · 미래) + 요일별 달성률.
- 초록불: 월 캘린더(● 초록불 ◔ 부분 ○ 0% ─ 예정 없음) + 최근 12개월 미니 막대. 날짜 탭 → 홈으로 이동.

### 2.5 목표 탭 (신규)

- 목록: 목표 태그 카드(이모지, 이름, 습관 수, 이번 달 달성률, 만다라트 유무).
- 상세: 만다라트 3×3 개요(중앙=목표, 주변 8=세부목표, 배경 채움=달성률) → 세부목표 탭 → 3×3 확대(실천항목 8개) → 실천항목 탭 → 셀 시트(습관으로 만들기 / 투두로 만들기 / 기존 습관 연결).
- 상단 [표] 버튼: 9×9 전체 읽기 전용 가로 스크롤.

### 2.6 내정보 탭 (현재 ⚙️ 설정 이동)

동기화 코드, 백업/복원, 주 시작 요일(신규), 내 기록, 전체 초기화, 버전/스키마 표시.

---

## 3. 데이터 모델 v3

```js
{
  schemaVersion: 3,
  settings: { weekStart: 1, todoView: 'list', clock24: true },
  habits: {            // id → Habit (배열 대신 맵)
    [id]: {
      id, name, emoji, order, startDate, endDate: null, deletedAt: null,   // startDate/endDate는 폼에서 직접 편집
      showInTodo: false,                                                    // R2. 켜면 예정일의 투두 탭에도 노출
      policies: [      // 적용일 이력. effectiveFrom 내림차순으로 첫 매칭 사용
        { effectiveFrom: '2026-09-09', status: 'active'|'paused'|'ended',
          repeat: { days: [1,2,3,4,5,6,7] },        // 월=1 … 일=7. 매일 = 전체
          trigger: { type: 'time'|'context'|null, value },
          goalTagIds: [], targetCount: 1 }
      ],
      reminder: null, levels: null, mandalaRef: null, legacyCategory: null
    }
  },
  checks: { 'YYYY-MM-DD': { [habitId]: 1 } },       // count. true→1로 이관. R3에서 N회
  todos:  { [id]: { id, title, date, time: 'HH:MM'|null, urgent: false, important: false,
                    done, completedAt, order, goalTagIds: [] } },
  goalTags: { [id]: { id, name, emoji, color, archived: false,
                      mandala: null | { sectors: [ { text, actions: [ { text, habitIds: [] } ×8 ] } ×8 ] } } },
  routines: { [id]: { id, name, emoji, habitIds: [] } }   // R3. 습관 묶음
}
```

핵심 함수 하나가 모든 지표의 기준이다.

```
policyAt(habit, d)   = habit.policies 중 effectiveFrom <= d 인 최신
isScheduled(h, d)    = h.startDate <= d && (h.endDate == null || d <= h.endDate)
                       && policyAt(h,d).status === 'active'
                       && policyAt(h,d).repeat.days.includes(isoWeekday(d))
dayRate(d)           = Σ min(count,target)/target  ÷  |scheduled(d)|   (예정 0이면 null)
greenLight(d)        = |scheduled(d)| > 0 && 모든 예정 습관 count >= target
streak(h)            = 예정된 날만 거슬러 올라가며 연속 완료 수 (오늘 미완료면 어제부터)
```

### 마이그레이션 v2 → v3

1. 기존 `routines/checks/todos` 키를 `routines_v2_backup` 등으로 원본 보존 후 변환. 실패 시 원본 유지.
2. routine → habit: `policies=[{effectiveFrom: 가장 이른 checks 날짜 또는 오늘, status:'active', repeat:{days:[1..7]}, trigger:null, goalTagIds:[카테고리 태그], targetCount:1}]`.
3. 카테고리 6종 → goalTags 6개(같은 이모지/색). `legacyCategory` 보존.
4. checks `true` → `1`. 현재 목록에 없는 habitId 기록은 보존하되 분모/분자 제외.
5. todos 날짜별 배열 → id 맵 + `date` 필드. `time/urgent/important` 기본값.
6. 백업 파일 `version:2` 복원 시 같은 변환 적용. 새 export는 `schemaVersion:3`.

---

## 4. 파일 구조 (빌드 없음, ES module)

```
index.html                 셸(app/overlay/toast 루트) + <script type=module src=./src/main.js>
manifest.webmanifest       (data URI에서 파일로)
styles/tokens.css  base.css  components.css  layout.css
src/main.js                로드 → 마이그레이션 → store → 라우터 → 동기화
src/config.js              Firebase public config, 상수(EMOJI, 프리셋 트리거, 팔레트)
src/state/store.js         getState / dispatch / subscribe. 불변 갱신
src/state/reducers.js      habits / checks / todos / goals / settings 리듀서
src/state/selectors.js     선택일 목록, 정렬, 필터, 사분면
src/domain/schedule.js     policyAt, isScheduled, 주간/월간 날짜 생성
src/domain/metrics.js      dayRate, greenLight, streak, 월간/주간 집계
src/domain/migrate.js      v2→v3, 백업 import 변환, 검증
src/storage/local.js       localStorage envelope, 안전 파싱, 백업/복원
src/sync/firestore.js      워크스페이스 문서 구독/merge 쓰기, 레거시 문서 이관
src/ui/router.js           hash 라우트(#/home #/stats #/goals #/settings), 탭바
src/ui/home.js             헤더, 주간 행, 세그먼트, 필터, 루틴 표
src/ui/todo.js             리스트/매트릭스, 빠른 입력
src/ui/forms.js            습관 폼, 투두 폼, 반복/트리거 시트
src/ui/sheets.js           액션 시트, 확인 다이얼로그, 토스트, FAB
src/ui/stats.js            월간/주간/초록불
src/ui/goals.js            목표 목록, 만다라트 개요/확대/셀 시트
src/ui/settings.js         내정보
src/ui/reorder.js          순서변경(Pointer Events + ▲▼ 폴백)
src/utils/date.js  dom.js  id.js
tests/index.html + tests/*.test.js   브라우저에서 여는 순수 모듈 테스트
```

의존 방향: `ui → state/selectors → domain`. domain은 DOM/localStorage/Firebase를 import하지 않는다.

### Firestore 경로

```
sync/{code}                           레거시. 읽기 전용으로 남겨 이관에만 사용
workspaces/{code}                     { schemaVersion, updatedAt }
workspaces/{code}/data/habits         { habits, goalTags, routines, settings }
workspaces/{code}/data/todos-2026-09  월별 todos
workspaces/{code}/data/checks-2026-09 월별 checks
```

- 쓰기는 `set(..., {merge:true})`로 변경 필드만. 엔터티 단위 `updatedAt` 비교로 최신 우선.
- 구독은 habits 문서 + 표시 중인 월(±1개월)만. 통계에서 과거 월은 필요 시 추가 로드.
- v2 클라이언트가 남아 있을 수 있으므로 `sync/{code}`는 지우지 않고, v3 앱은 첫 연결 시 레거시 문서를 읽어 이관한 뒤 새 경로만 사용한다.

---

## 5. 릴리스 계획

### R0 리팩토링 (UI 변화 없음)
1. 현재 index.html을 위 파일 구조로 분리. 기능 동일 확인.
2. store/reducer 도입, 인라인 onclick → 이벤트 위임, innerHTML 문자열 삽입 → textContent.
3. v3 마이그레이션 + 스키마 v3 저장. 기존 화면은 v3 데이터를 읽어 동일하게 동작.
4. Firestore 분할 경로 + 레거시 이관. 두 기기 테스트.
5. tests/ 페이지에 migrate/schedule/metrics 케이스.

완료 기준: 기존 사용자가 업데이트 후 루틴·기록·투두·동기화가 그대로이고 스트릭 값이 동일.

### R1 새 뼈대 (P0)
- 4탭 라우터 + 하단 탭바 (통계 탭은 월간만, 목표 탭은 태그 목록만)
- 홈: 월 헤더, 🔥 배지, 월~일 주간 행 도넛/초록불, 루틴/투두 세그먼트, 3열 표, FAB
- 습관 폼(이름/이모지/시작·종료 날짜/반복/시간, 하단 삭제) + 액션 시트(수정/삭제)
- 홈 표의 시간·요일 셀 + 셀 탭 시 빠른 설정 시트(요일 칩·시간·시작/종료)
- **D. 요일별 반복** + isScheduled 기반 달성률/스트릭
- **C. 투두 시간** 필드 + 시간 셀 + 시간순 정렬 + 투두 폼(바텀시트)
- 내정보 탭(설정 이동 + 주 시작 요일)

### R2 목표·통계·매트릭스 (P1)
- 통계 3탭 완성(주간, 초록불), 습관별 월간 그리드
- 목표 태그 CRUD + 홈 필터 칩 + 습관 폼 태그 필드
- **A. 4분면 매트릭스** 보기 + 긴급/중요 칩 + 사분면 이동
- 순서변경 화면(드래그), 액션 시트 확장(월간 기록/복사/쉬어가기/끝내기), 습관별 🔥
- 하루/주 보기 드롭다운, 투두 📅 날짜 피커, 미완료 이월 배너

### R3 만다라트·확장 (P2)
- **B. 만다라트** 개요/확대/편집/셀→습관·투두 프리필/달성률 채움
- 앱 내 알림, 하루 달성 수(N회), 미니/플러스/맥스, 추천 습관 칩, 루틴 묶음, 월 보기, 다크 테마
- manifest 파일화 + 서비스 워커 앱 셸 캐시

---

## 6. 위험과 대응

| 위험 | 대응 |
|---|---|
| v2 앱이 남은 기기가 레거시 문서를 덮어씀 | v3는 새 경로만 쓰고 레거시 문서는 읽기 전용. 첫 이관 후 "다른 기기도 업데이트하세요" 안내 |
| iOS 드래그가 스크롤과 충돌 | 핸들에만 `touch-action:none`, ▲▼ 폴백 유지 |
| 전체 재렌더로 입력 포커스 손실(현행 버그) | 화면 단위 부분 렌더, 폼 입력은 draft 상태로 분리, 한글 composition 중 Enter 무시 |
| 알림 기대 불일치 | 폼 도움말에 "앱이 열려 있을 때만" 명시 |
| Firestore Rules 미확인 | R0 착수 시 콘솔에서 규칙 확인. 코드만 알면 접근되는 모델이면 최소한 새 경로 규칙을 같이 배포 |

## 7. 남은 확인 사항
- Firestore Rules 현재 상태
- 지금 사용 중인 기기 수(레거시 전환 범위)
- 지원 최소 iOS 버전
