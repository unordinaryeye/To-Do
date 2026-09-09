# Daily Routine 리뉴얼 — 프론트엔드 아키텍처 계획

작성일: 2026-09-09 · 역할: 시니어 프론트엔드 아키텍트 · 범위: 계획만 작성, 앱 코드 수정 없음

## 0. 조사 범위와 핵심 결정

BRIEF.md를 읽고 `To-Do/index.html` 1~448줄 전체를 정독했다. `conference/KakaoTalk_20260909_114258234.png` 및 `_01`~`_10.png` 11장을 각각 직접 열어 확인했다. MCP 프로젝트 목록에는 To-Do 인덱스가 없어 지정된 소스 파일을 직접 읽었다. 운영 Firestore의 실제 데이터, Rules, 사용량과 iPhone 실행 상태는 접근·검증하지 않았다.

권장 방향은 **바닐라 ES module + 불변 store + 순수 날짜/통계 함수 + localStorage 복구 가능한 저장 + 엔터티 단위 Firestore 동기화**다. 프레임워크, 번들러, 서버 라우팅 없이 기존 GitHub Pages 주소를 유지한다. 파일 분리, 데이터 전환, 시각 개편을 각각 배포 가능한 단계로 나눈다.

가장 먼저 고정할 제품 의미는 다음과 같다.

- 기존 `routines` 한 항목은 새 모델의 `habit`이다. 새 `routine`은 여러 habit의 묶음이며 별도 체크를 갖지 않는다.
- 습관 진행률·주간 파이·초록불·스트릭은 동일한 예정일 계산기를 사용한다. 투두 완료율은 별도로 표시한다.
- 반복 요일, 하루 목표 횟수, 상태, 목표 태그, 표시 순서는 적용일 이력으로 관리한다. 오늘의 설정 변경이 과거 통계의 분모를 바꾸지 않는다.
- 오프라인 변경은 먼저 로컬에 영속화하고, 원격 수신 데이터 위에 미전송 변경을 다시 적용한다. 단순한 수신 후 전체 교체를 없앤다.
- 알림 설정 데이터는 지원하되, 앱이 닫혀 있을 때의 정시 알림은 GitHub Pages와 Firestore만으로 보장하지 않는다. 정적 배포 범위에서는 앱 내 알림을 제공하고, 백그라운드 Push는 별도 발송 서비스 도입 단계로 둔다.

### 이미지별 관찰과 설계 연결

파일명 공통 접두사는 `KakaoTalk_20260909_114258234`다. 노란 안내 표시와 손가락은 튜토리얼이며 실제 제품의 상시 UI로 복제하지 않는다.

| PNG | 직접 확인한 내용 | 반영할 설계 |
|---|---|---|
| 접미사 없음 | 체크 셀의 이모지를 다시 터치하면 달성 취소 | 목표 1회는 토글, 여러 회는 횟수 조절 제공 |
| _01 | 습관 이름 영역을 눌러 수정 메뉴 진입 | 이름 버튼과 체크 버튼의 이벤트 분리 |
| _02 | 월간 기록·수정·복사·쉬어가기·끝내기·삭제 메뉴 | 습관 액션 시트, 상태 전환과 삭제 의미 분리 |
| _03 | FAB에 습관 1개 추가/2개 이상 묶음인 루틴 추가 | habit과 routine 도메인 분리 |
| _04 | 이모지, 이름, 알림, 하루 달성 수, 반복, 시간/상황, 난이도, 목표 태그 | 단일 습관 편집 폼과 선택 시트 |
| _05 | 월요일 알약 선택, 비어 있는 체크 셀 | 선택일과 달성 상태를 독립 표현 |
| _06 | 부분 달성 시 노란 파이, 튜토리얼의 60% 문구 | 부분율 시각화만 참고; 실제 계산식은 아래에 정의 |
| _07 | 달성 시 초록 파이와 채워진 이모지 | 반올림 표시가 아닌 실제 완료 판정으로 초록불 |
| _08 | 드래그 핸들, 오늘부터 적용되는 순서, 저장 버튼 | 순서 편집 draft와 effectiveFrom 이력 |
| _09 | 월간/주간/초록불 탭, 목표 태그, 87% 샘플, 습관별 월간 캘린더 | 월간 카드와 예정/미예정 셀 구분; 유료 샘플 수치는 복제하지 않음 |
| _10 | 투두 표의 빈 시간 열, 달력, 구독 잠금 | 시간 열에 HH:MM, 투두 리스트/4분면 전환; 잠금/광고 제외 |

하단 내비게이션은 홈·통계·목표·설정 4개를 권장한다. 목표 화면 안에 목표 태그 목록/만다라트를 배치한다. 홈의 루틴/투두 탭을 유지하고, 투두 탭 안에서 목록/4분면을 전환한다. 좁은 화면에서는 4분면 요약 2×2와 선택 분면의 세로 목록을 제공하고, 넓은 화면에서는 각 분면 내 목록을 바로 보여준다. 만다라트 9×9 전체는 축소 개요로 보여주고 블록을 누르면 해당 3×3 편집 화면을 연다.

## 1. 현재 코드 문제점 진단

| 근거: index.html 줄 | 현재 동작과 문제 | 목표 |
|---|---|---|
| 17~140, 148~446 | 스타일·상태·저장·통계·마크업을 한 파일에 결합; 짧은 줄 수가 실제 복잡도를 숨김 | 역할별 모듈, 함수 50줄 이하, 일반 파일 200~400줄 이내 |
| 196~206 | 영속 도메인 상태와 선택일·입력 중 값·모달 상태가 전역 변수로 혼재 | data/ui/runtime 분리, 액션을 통한 변경 |
| 196~198 | JSON.parse에 복구 경로가 없어 손상된 localStorage 한 값으로 부팅 실패 | 안전 파싱, 검증, 원본 보존, 복구 화면 |
| 184~191, 196, 339 | DEFAULT_ROUTINES를 배열만 복사하여 객체는 공유; 이름 직접 수정 후 초기화하면 기본 이름도 변했을 수 있음 | 초기 상태 생성 함수로 매번 독립 객체 생성 |
| 209~221 | 세 키를 순차 저장; 중간 실패 시 세대 혼합, quota 예외 처리 없음; 500ms 후 원격 저장 | 한 envelope 저장, pending outbox도 같은 commit에 포함 |
| 224~254 | `{routines,checks,todos}` 전체 set, 전체 JSON 문자열 비교, remote로 전체 대체 | 엔터티/필드 단위 변경, outbox와 snapshot 병합 |
| 248~254 | skipNextSync를 1초간 켜므로 그 사이 로컬 변경이 전송 예약에서 빠질 수 있음 | local/remote 액션 출처 구분, ack 기반 중복 억제 |
| 237~258 | 리스너 연결 전부터 연결됨 표시; 쓰기 실패는 콘솔만 출력 | 연결 상태와 저장 대기/오류/확정 상태 분리 |
| 264~293 | 해제 시 타이머 취소 없음; 콜백이 실행 시점의 전역 syncCode를 읽음; 코드 충돌 존재 확인 없이 set | 큐를 workspace와 연결 세대에 묶고 취소/격리, 코드 생성 충돌 확인 |
| 299~305 | 코드 연결 시 기존 로컬 상태를 바로 대체 | 연결 전 로컬 백업, 원격 가져오기/명시적 병합 미리보기 |
| 327, 336 | export의 version:2가 있지만 import 검증은 routines/checks truthy 여부뿐; todos 없는 백업 복원 시 기존 투두 잔존 | 포맷 버전과 도메인 버전 분리, 전체 검증, 누락 todos는 빈 데이터로 교체 |
| 339, 437~441 | '모든 데이터 삭제'와 달리 기본 루틴 재생성; 연결 상태에서 원격에도 저장 | 샘플 초기화/모든 기록 지우기/연결 해제의 의미 명시 |
| 345~347, 372 | 진행률은 습관+투두, 스트릭/점은 습관만; 주간 행은 월~일이 아닌 선택일 ±3일 | 공통 selector와 고정 월요일 시작 주간 |
| 346 | 오늘뿐 아니라 어떤 선택일의 미달성도 건너뜀; 365회 제한; 현행 목록으로 과거 평가 | 오늘 미완료 유예만 허용, 예정일과 이력 기반 순회 |
| 350~359, 412 | push, 속성 대입, 배열 swap, Date mutation; UI가 도메인 객체를 직접 수정 | 순수 reducer와 편집 draft, 저장 시 validation |
| 352 | 습관 삭제 뒤 checks 참조는 남고 목록은 사라져 과거 달성률 재계산 왜곡 | tombstone과 과거 정책 유지 |
| 353 | 화면은 카테고리별 필터 배열인데 이동은 원본 배열의 바로 옆 항목 검사 | 표시 순서 목록에서 이동하고 새 순서 이력 생성 |
| 362~442 | 81줄 render 함수가 앱과 overlay 전체 innerHTML 대체; 입력 포커스 복구를 50ms 타이머로 보정 | 안정된 shell, 키 기반 행 갱신, 모달 독립 생명주기 |
| 387, 396~412 | text/emoji/id를 HTML·속성·인라인 이벤트에 그대로 삽입; 따옴표도 입력을 깨뜨릴 수 있음 | textContent/value/DOM dataset, 이벤트 위임; 가져온 JSON도 같은 검증 |
| 5, 42, 75, 387 | 확대 금지, 작은 클릭 영역과 div 체크; 키보드/스크린리더 사용 미흡 | 확대 허용, 44px 이상 버튼, aria 상태, 모달 포커스 복귀 |
| 11, 14~15 | data URI manifest와 CDN SDK; 이 파일에는 서비스 워커 등록 없음 | 실제 manifest, 상대경로, 오프라인 앱 셸, CDN 장애에도 로컬 부팅 |

현재 Firebase 설정이 공개되어 있다는 사실 자체를 비밀키 노출로 판단하지 않는다. 코드에 인증 절차가 보이지 않으며 실제 Rules는 확인하지 않았으므로 권한 보장 여부는 미확인이다. 새 경로의 Rules와 기존 코드 연결 권한을 구현 착수 시 함께 점검해야 한다.

## 2. 빌드 없는 목표 파일 구조

`index.html`은 `<script type="module" src="./src/main.js">`를 사용한다. 모든 내부 import는 `.js` 확장자가 있는 상대경로로 쓰며, 배포가 `/To-Do/` 하위 경로임을 전제로 `/src/...` 같은 도메인 루트 경로를 쓰지 않는다. 페이지 이동은 `#/home`, `#/stats`, `#/goals`, `#/settings`로 하여 GitHub Pages의 직접 접근 404를 피한다.

아래 줄 수는 읽기 쉬운 포맷의 최종 예상치다. 200줄에 못 미치는 응집된 파일을 채우려고 코드를 늘리지 않는다. 400줄 초과 시 실제 책임 경계로 분리한다. 한 번에 전부 생성하지 않고 해당 기능 단계에서 추가한다.

| 파일 | 책임 | 예상 줄 |
|---|---|---:|
| index.html | head, 안정된 앱/overlay/toast 루트, module 진입 | 50~80 |
| manifest.webmanifest | name, id, start_url, scope, display, 아이콘 | 25~40 |
| sw.js | 앱 셸 버전 캐시, 업데이트 안내, 데이터 요청 제외 | 130~200 |
| styles/tokens.css | 색·간격·타입·높이·z-index 변수 | 70~110 |
| styles/base.css | reset, 폰트, 접근성, safe area | 120~180 |
| styles/layout.css | shell, 하단바, 표/4분면/만다라트 반응형 | 200~300 |
| styles/components.css | 버튼, 체크, 칩, 시트, 상태 표시 | 250~350 |
| src/main.js | 저장 로드→마이그레이션→store→뷰→동기화 조립 | 100~160 |
| src/config.js | 기존 Firebase public config, 제한값, 기능 플래그 | 60~100 |
| src/state/store.js | getState, dispatch, subscribe(selector), commit 파이프라인 | 150~220 |
| src/state/reducer.js | 도메인 reducer 조합, UI 액션, remote 적용 | 180~250 |
| src/state/habit-reducer.js | 습관 CRUD, 정책/상태 이력, checks 명령 | 230~330 |
| src/state/planning-reducer.js | routine, todo, goalTag, mandalart 편집 | 250~380 |
| src/state/selectors.js | 선택일 목록, 태그/루틴 필터, 투두 정렬/분면 | 180~260 |
| src/domain/schema.js | JSDoc 타입, 공통 불변조건, factory | 230~340 |
| src/domain/validation.js | 백업/액션/원격 데이터의 구조·범위·참조 검증 | 250~380 |
| src/domain/schedule.js | 날짜별 policy/status/order 해석, 예정 여부 | 200~300 |
| src/domain/metrics.js | 진행률, habit/global 스트릭, 주·월 통계 | 220~330 |
| src/domain/mandalart.js | 9×9 좌표 투영, 블록과 연결 무결성 | 160~240 |
| src/storage/local.js | namespaced envelope, 저장 실패, 복구 슬롯 | 200~300 |
| src/storage/migrate.js | 버전 라우팅, legacy→v3, 검증 보고 | 250~380 |
| src/storage/backup.js | JSON export/import 미리보기와 교체 commit | 200~280 |
| src/sync/firebase-client.js | SDK 로드, Firestore adapter, 구독 dispose | 150~230 |
| src/sync/legacy.js | 기존 sync 문서 읽기와 호환 전환 | 180~280 |
| src/sync/engine.js | workspace 연결, 수신 병합, 큐 전송, 상태 | 250~380 |
| src/sync/outbox.js | 영속 op 생성·ack·재시도·충돌 보류 | 200~300 |
| src/sync/merge.js | 3-way 필드 병합, revision 비교, tombstone 규칙 | 200~300 |
| src/views/shell.js | 내비게이션, hash route, 구독 생명주기 | 150~220 |
| src/views/home.js | 주간/필터와 habit/todo 하위 뷰 연결 | 200~300 |
| src/views/habit-list.js | routine 묶음과 키 기반 습관 행 | 220~300 |
| src/views/todo-list.js | 날짜·시간 목록과 완료/편집 | 180~250 |
| src/views/matrix.js | 4분면, 모바일 선택 분면, 이동 액션 | 180~260 |
| src/views/stats.js | 월간/주간/초록불, 로딩/빈 상태 | 230~340 |
| src/views/goals.js | goalTag 목록, 만다라트 개요/블록 편집 | 240~360 |
| src/views/settings.js | 동기화, 복구, 백업, 초기화, 앱 업데이트 | 230~330 |
| src/components/week-strip.js | 월~일 버튼, 파이와 접근 가능한 설명 | 140~210 |
| src/components/habit-form.js | 반복·목표수·트리거·태그·상태 draft | 250~380 |
| src/components/todo-form.js | 제목·날짜·시간·긴급/중요 draft | 160~240 |
| src/components/routine-form.js | 습관 선택과 그룹 순서 편집 | 160~240 |
| src/components/action-sheet.js | 액션 메뉴, dialog 포커스, 닫기 | 140~210 |
| src/components/reorder.js | pointer 조작과 위/아래 대체 동작 | 200~300 |
| src/components/feedback.js | toast, 저장 상태, 확인 dialog | 140~200 |
| src/utils/date.js | DateKey, 월요일, 월 범위, 날짜 덧셈 | 160~230 |
| src/utils/dom.js | 안전 노드 생성, keyed 목록/포커스 보조 | 140~220 |
| src/utils/id.js | 신규 UUID, legacy 결정적 ID 변환 | 50~90 |
| src/services/reminders.js | 앱 내 알림, device 권한/중복 방지 adapter | 140~220 |
| tests/index.html, tests/harness.js | 브라우저 ESM 테스트 결과 화면/가벼운 assert | 각 40~180 |
| tests/*.test.js | migration/schedule/metrics/store/merge/dom별 케이스 | 각 150~350 |
| tests/fixtures/*.json | legacy, 손상, 충돌, 윤년 fixture | 사례별 |

의존성은 `views → dispatch/selectors → domain`과 `main → storage/sync adapters`로 제한한다. domain은 DOM, localStorage, Firebase를 import하지 않는다. store에 저장 adapter를 주입하고 reducer가 직접 IO를 하지 않는다. Firebase compat SDK는 초기 추출 단계에서는 그대로 격리하고, 새 모듈 SDK 전환은 별도 검증 단계로 둔다. SDK 정적 import 실패가 전체 부팅을 막지 않게 동적 로드를 catch한다.

## 3. 새 데이터 모델과 마이그레이션

### 3.1 저장 envelope와 공통 규칙

도메인 최신 버전은 `schemaVersion: 3`으로 시작한다. 기존 JSON `version: 2`는 legacy export 형식이며 같은 의미로 해석하지 않는다.

```text
LocalEnvelope {
  schemaVersion: 3,
  workspaceId: string,              // 로컬 전용 공간 또는 연결된 공간
  revision: integer,
  data: {
    settings: { calendarTimeZone, weekStartsOn: 1 },
    habits: Record<HabitId, Habit>,
    habitPolicies: Record<PolicyId, HabitPolicy>,
    routines: Record<RoutineId, Routine>,
    todos: Record<TodoId, Todo>,
    goalTags: Record<TagId, GoalTag>,
    mandalarts: Record<BoardId, Mandalart>,
    checks: Record<DateKey, Record<HabitId, Check>>,
    orderRevisions: Record<OrderRevisionId, OrderRevision>
  },
  outbox: PendingOperation[],
  conflicts: Conflict[],
  migration: { sourceVersion, migratedAt, legacyFingerprint, warnings[] }
}
```

`ui`에는 route, selectedDateKey, rangeMode, selectedTagIds, todoMode, dialog, draft, focusedId를 둔다. `runtime`에는 구독 해제 함수, 타이머, 온라인 상태를 둔다. 이 둘을 클라우드 도메인에 넣지 않는다. deviceId, 동기화 연결 코드, 알림 권한/구독 정보는 기기 로컬 설정이며 일반 백업에서 제외한다.

모든 ID는 문자열이다. 새 ID는 UUID, legacy ID는 결정적 mapping을 쓴다. 날짜는 `YYYY-MM-DD`, 시간은 `HH:MM | null`, 실제 시각은 ISO UTC로 구분한다. calendarTimeZone은 최초 기기에서 설정하고 기기 간 공유한다. 여행·기기 timezone 변경으로 체크 날짜를 재배치하지 않는다. timezone 정책 변경도 적용일부터 반영하며 과거 DateKey는 보존한다.

원격 엔터티에는 공통 `{ id, schemaVersion:3, rev, createdAt, updatedAt, lastOpId, deletedAt:null|ISO }`를 둔다. timestamp는 표시/감사 용도이며 충돌 순서의 유일한 근거로 쓰지 않는다. 로컬 미전송 시각과 서버 확정 시각은 구별한다.

### 3.2 Habit과 적용일 정책

```text
Habit {
  ...EntityMeta,
  name: string, emoji: string,
  legacyCategory: string|null,
  startDate: DateKey,
  origin: "user"|"legacy"|"legacy-orphan",
  historyAccuracy: "exact"|"estimated"|"unknown",
  difficulty: null | { mini:string, plus:string, max:string }
}
HabitPolicy {
  ...EntityMeta,
  habitId: HabitId,
  effectiveFrom: DateKey,
  status: "active"|"paused"|"ended",
  repeat: { type:"weekly", weekdays:[1,2,3,4,5,6,7] },
  cue: { type:"none"|"time"|"trigger", time:HHMM|null, text:string|null },
  targetCount: positive integer,
  goalTagIds: TagId[],
  reminder: { enabled:boolean, mode:"in-app"|"push", time:HHMM|null }
}
```

매일은 weekdays 1~7이며 월=1, 일=7이다. weekly 활성 정책에서 빈 요일 배열은 저장 불가다. targetCount는 1 이상이고 상한은 config에 둔다(초기 제안 99). trigger는 상황 설명일 뿐 발생 감지가 아니므로 알림을 켜려면 별도 시간을 입력한다.

날짜 d에 유효한 policy는 `effectiveFrom <= d`인 것 중 가장 최신이다. 같은 habit+effectiveFrom은 단일 정책으로 유지해 중복을 막고, 같은 날짜 동시 편집은 충돌 해결 대상이다. current status는 이력으로부터 도출하며 Habit에 두 번 저장하지 않는다. 새 정책을 만들 때 repeat/targetCount/tag/status를 완전한 정책 스냅샷으로 복사하여 해석을 단순하게 한다.

쉬어가기부터 재개 전날까지 예정일이 아니며 스트릭을 끊거나 늘리지 않는다. 끝내기는 해당 적용일부터 더 이상 예정되지 않고 기록은 남는다. ended의 단순 재개는 허용하지 않고 복사로 새 습관을 시작한다. 사용자에게 오늘/내일부터 적용을 선택하게 하며, 오늘 이미 기록이 있으면 내일을 기본값으로 제안한다. 과거 일괄 소급 변경은 일반 편집과 분리한다.

삭제는 tombstone + 그날부터 ended 정책으로 처리하여 과거를 지우지 않는다. 기록까지 영구 삭제는 별도 확인되는 복구 불가능 작업이다. 복사는 새 ID/오늘 startDate를 생성하며 체크·스트릭을 복사하지 않는다.

### 3.3 Routine, Todo, GoalTag

```text
Routine {
  ...EntityMeta, name, emoji,
  membershipRevisions: [ { effectiveFrom, habitIds:[HabitId,...] } ]
}
Todo {
  ...EntityMeta, title,
  date:DateKey, time:HHMM|null,
  urgent:boolean, important:boolean,
  done:boolean, completedAt:ISO|null,
  goalTagIds:TagId[], order:number
}
GoalTag {
  ...EntityMeta, name, emoji, colorToken,
  description:string, archived:boolean
}
OrderRevision {
  ...EntityMeta,
  scope:"home-habits"|"routine:<id>",
  effectiveFrom:DateKey, orderedIds:HabitId[]
}
```

routine 생성 시 활성 참조 2개 이상을 검증한다. 이후 습관 종료로 1개가 되어도 자동 삭제하지 않고 편집 안내를 표시한다. routine 자체 반복 규칙을 두지 않아 habit 규칙과의 충돌을 피한다. 여러 routine에서 같은 habit을 참조해도 통계는 habit ID로 한 번만 센다. 루틴 완료는 그날 예정된 구성 습관이 모두 완료한 파생값이고 구성원이 없으면 N/A다.

membershipRevisions가 커지면 개별 문서로 분리하되 처음에는 작은 routine 문서에 유지한다. habit 전역 순서와 루틴 내부 순서를 구분한다. 순서에 없는 새 ID는 생성 순서/ID 순으로 뒤에 붙이고 tombstone ID는 해당 날짜 정책에 따라 제외한다.

투두는 시간 지정/미지정 모두 허용하고 긴급과 중요를 독립 boolean으로 저장한다. '긴급'을 오늘 날짜라는 이유로 자동 true로 바꾸지 않는다. 기본 정렬은 `date → 시간 있음 우선 → HH:MM → order → id`이고 같은 시간은 안정적으로 유지한다. 수동 순서 모드와 시간순 모드를 표시한다. 완료 항목 맨 아래 모드는 명시적 옵션이며 기본 시간순을 몰래 바꾸지 않는다. 분면 이동은 urgent/important만 변경하고 날짜·시간·done은 유지한다.

목표 태그는 조직화와 필터의 단일 원천이다. 카테고리와 목표는 의미가 완전히 같지 않으므로 legacy category는 보존하면서 초기 태그로 매핑했음을 사용자에게 알린다. 태그 이름 변경은 연결 ID를 바꾸지 않는다. 아카이브 태그는 새 선택에서 숨기되 과거 정책 참조는 유지한다.

### 3.4 Mandalart: 81셀을 중복 저장하지 않기

```text
Mandalart {
  ...EntityMeta, title,
  center: { text:string, goalTagId:TagId|null },
  sectors: [                         // 정확히 8개, slot 0..7
    { id, slot, text, goalTagId:TagId|null,
      actions: [                     // 정확히 8개, slot 0..7
        { id, slot, text,
          habitIds:HabitId[], todoIds:TodoId[],
          completionMode:"manual"|"linked",
          manualDone:boolean }
      ]
    }
  ]
}
```

실제 원본 항목은 중심 1 + 세부목표 8 + 실천항목 64 = 73개이며, 81셀에서 8개 세부목표가 바깥 블록 중앙에도 반복 표시된다. 동일 sector 객체를 중앙 주변 셀과 바깥 블록 중앙에 투영하여 양쪽 제목이 어긋나지 않게 한다. slot 순서는 좌상·상·우상·좌·우·좌하·하·우하로 고정한다.

sector의 목표 태그와 action의 habit/todo 참조를 연결하되, 연결만으로 습관의 태그를 자동 변경하지 않는다. '습관으로 만들기'는 새 habit과 action 참조를 하나의 로컬 액션으로 생성하고 태그 적용은 폼에서 확인한다. 이미 연결된 습관은 ID로 재사용한다.

실천항목의 반복 습관은 영구 완료로 볼 수 없으므로 linked 모드에서는 선택 기간의 습관 달성률/투두 완료수를 보여준다. manualDone은 명시적 수동 목표 판정에만 사용한다. 만다라트 전체에 근거 없는 단일 '목표 달성률'을 붙이지 않고, 계획 입력 수와 선택 기간 실천 달성률을 구분한다. 참조 대상 종료/삭제 시 깨진 링크 안내와 과거 제목 정보를 유지하며 참조 삭제를 자동 전파하지 않는다.

### 3.5 Checks

```text
checks["2026-09-09"]["h_..."] = {
  id:"<date>__<habitId>", schemaVersion:3,
  date:"2026-09-09", habitId:"h_...",
  count:1,
  policyId:"hp_...", targetCountSnapshot:2,
  rev:7, lastOpId:"device:uuid", updatedAt:ISO,
  deletedAt:null
}
```

count는 0 이상 정수이며 단순 체크는 0↔1이다. 여러 회 목표에서는 +1/−1 또는 횟수 편집으로 0~targetCount를 다룬다. UI의 단순 재터치를 '전체 취소'로 쓰면 다회 기록을 실수로 없애기 쉬우므로 목표 1회와 구분한다. 초과 횟수 import는 원본 유지와 경고를 하되 기여율은 100%에서 자른다.

0은 실제 취소 의사이므로 동기화에서 '키 없음'으로 지우지 않는다. 체크 없는 예정일은 count=0으로 계산한다. 미예정일의 legacy 체크는 기록으로 보존하지만 달성률에는 넣지 않는다. 일반 UI는 미래일 체크를 금지하고 미래 투두/습관 계획만 허용한다. 과거 체크 편집은 해당 날짜 policy를 따른다.

policy 이력이 분모의 원천이며 snapshot은 검증/복구 보조다. 이미 체크가 존재하는 날짜의 목표를 소급 변경하는 특수 작업은 해당 체크 snapshot과 함께 명시적으로 재계산한다. snapshot과 policy가 불일치하면 조용히 어느 쪽을 선택하지 않고 복구 대상으로 표시한다.

### 3.6 마이그레이션 함수 계약

계획용 의사코드이며 이 작업에서 구현하지 않았다.

```text
migrate(input, { todayKey, calendarTimeZone })
  -> { dataV3, warnings, quarantined, legacyIdMap }

parseSource(raw): legacyLocal | legacyBackupV1V2 | envelopeV3 | futureVersion
validateLegacy(source): structural issues + preserved raw
migrateLegacyToV3(source, context): deterministic transformation
validateV3(result): date/id/reference/count/policy integrity
commitMigration(result): save pending -> readback -> publish active pointer
```

1. 로컬의 routines/checks/todos 세 키와 lastBackup을 먼저 raw 상태로 보존한다. 기존 키를 읽는 도중 오류가 나면 초기값을 덮어쓰지 않고 복구 화면으로 이동한다. 키 없음과 빈 배열은 구분하며, 최초 설치일 때만 샘플을 생성한다.
2. schemaVersion 없는 legacy JSON과 `version:1/2` 백업을 인정한다. todos가 없으면 빈 객체로 해석한다. schemaVersion이 지원 버전보다 크면 읽기 전용 안내와 원본 export를 제공하고 다운그레이드 저장하지 않는다.
3. 기존 routine ID를 안전한 `legacy-h-<encoded-id>`로 결정적 변환한다. 동일 원본을 두 기기가 변환해도 같은 ID가 나오게 한다. 중복 ID나 잘못된 날짜는 자동 추측 병합하지 않고 경고/격리 목록에 원본을 남긴다. input 배열/객체를 mutate하지 않는다.
4. 모든 기존 항목을 매일, targetCount=1, cue=none, reminder=false, status=active로 이관한다. 기존 배열의 상대순서와 category를 보존한다. 기존 category별 goalTag를 만들되 의미 추정임을 표시한다. 새 routine 묶음은 자동 생성하지 않는다.
5. true 체크는 count=1, false는 count=0으로 보존하고 ID를 재매핑한다. 현 목록에 없는 체크 ID는 제목 '이전 습관(이름 미상)'인 legacy-orphan 기록으로 보존한다. 이 항목은 일반 예정 목록과 분모에서 제외하고 과거 기록 목록에서만 확인한다.
6. 기존 데이터는 습관 생성·삭제·요일 변경 시점이 없다. 정확한 과거 분모 복원은 불가능하다. 이관 정책은 가장 이른 유효 checks 날짜부터 현재 존재하는 습관을 매일 예정으로 간주하는 기존 계산 방식의 근사이며 historyAccuracy=estimated로 표시한다. checks가 없으면 오늘부터 시작한다. 원래 미완료였던 날과 습관이 없던 날을 구별했다고 주장하지 않는다.
7. 기존 todos[date]를 정규화하고 날짜+기존 ID 기반 새 ID를 만든다. time=null, urgent=false, important=false, goalTagIds=[], order=기존 인덱스다. done=true지만 완료 시각을 알 수 없으면 completedAt=null로 두며 이관 시각을 실제 완료 시각으로 만들지 않는다.
8. 원본 체크의 알 수 없는 속성과 잘못된 레코드는 격리하되 누락 보고에 수량을 표시한다. 유효 데이터라도 원본을 복구 슬롯에 유지한다. 단순한 검증 통과가 모든 원본 의미를 복원했다는 뜻은 아니다.
9. `dailyRoutine:v3:<workspaceId>:pending`에 envelope를 저장하고 다시 파싱·검증한 뒤 active pointer를 마지막에 변경한다. quota 등 실패 시 pointer와 legacy 데이터는 그대로 둔다. 성공 후에도 최소 이전 유효 envelope와 legacy 원본을 유지한다.
10. v3 입력은 같은 도메인 값으로 반환하는 멱등 변환이다. migration timestamp는 이미 존재하면 재생성하지 않는다. legacyFingerprint는 중복 import 탐지 보조이며 비밀/권한 수단이 아니다.

신규 export는 `{format:"daily-routine-backup", formatVersion:1, schemaVersion:3, exportedAt, data}`로 정의한다. syncCode, 인증/Push 자격정보, outbox는 일반 공유 백업에서 제외한다. 별도 내부 복구 snapshot에는 outbox를 포함한다. 구형 백업 읽기는 계속 지원하지만 v3를 구형 앱이 손실 없이 읽는 것은 불가능하다. 구형 포맷 export가 필요하면 새 필드가 빠지는 제한적 export임을 명시한다.

복원은 파싱→마이그레이션→검증→변경 수량 미리보기→기존 상태 백업→한 번의 교체 액션 순이다. 동기화 중 복원은 새 작업 공간에 복원하는 것을 기본으로 제안한다. 기존 공유 공간을 교체할 때는 누락 엔터티에 tombstone을 만드는 명시적 교체 작업이 필요하며, 단순 merge를 '복원 완료'라고 표시하지 않는다.

## 4. 요일 반복과 달성률·스트릭·주간 파이 알고리즘

### 예정일의 단일 정의

`isScheduled(habit, d)`는 startDate≤d, 날짜별 policy.status=active, ISO weekday(d)가 repeat.weekdays에 포함되고 해당 시점에 삭제/종료되지 않았을 때 true다. 과거 기록 계산에서는 현재 deletedAt만 보고 과거 전체를 제외하지 않는다. 미래일은 계획에는 보이지만 집계 기간에서는 제외한다.

`date.js`는 날짜 문자열을 달력 성분으로 파싱하고 UTC 달력 산술을 사용할 수 있으나 DateKey를 시각으로 취급하지 않는다. `new Date('YYYY-MM-DD')`의 로컬 표시와 `toISOString().slice(0,10)`로 현재 날짜를 만드는 방식을 피한다. 현재 날짜 추출에는 공유 calendarTimeZone을 명시한다. 하루 이동에 고정 86,400,000ms를 더하지 않아 DST 경계를 피한다.

### 달성률

날짜 d의 예정 habit ID 집합을 S(d), 목표수를 T(h,d), 체크수를 C(h,d)라 한다.

- 습관별 기여 `q(h,d)=min(max(C,0),T)/T`.
- 하루 달성률 `P(d)=sum(q)/|S(d)|`로 **습관별 동일 가중치**를 권장한다. 물 8회 습관이 운동 1회보다 8배 비중을 갖지 않는다.
- 완전 달성 습관 수 `F(d)=count(C>=T)`도 별도로 제공한다. 예: '1/2 습관 완료 · 75%'는 목표 1회 완료와 목표 2회 중 1회 완료일 때다.
- S(d)가 비면 P(d)=null, UI는 '예정 없음'과 중립 원이다. 0/0을 100% 처리하거나 초록불을 켜지 않는다.
- 초록불은 `|S(d)|>0 && every(C>=T)`로 판정한다. 반올림 100%로 초록불을 켜지 않는다.
- 주간/월간 전체율은 기간 내 `sum(q)/sum(|S(d)|)`로 계산한다. 날짜별 백분율 단순 평균은 예정 습관 수가 다른 날을 왜곡하므로 쓰지 않는다.
- habit 월간율은 해당 habit 예정일에 대한 q 평균, 완전 달성일 수와 실제 횟수는 다른 지표로 표시한다.
- 오늘은 진행 중으로 포함, 미래일은 분모 제외한다. 예정/미예정/미완료/부분/완료/미래를 월간 그리드에서 구별한다.

태그 필터는 해당 날짜의 policy.goalTagIds로 습관 집합을 제한하며 중복 ID를 제거한다. 헤더의 전체 스트릭과 주간 파이는 전체 습관 기준으로 유지하고, 필터 통계는 '선택 목표'라고 표시한다. routine 필터에서도 같은 habit을 중복 집계하지 않는다. 투두 탭의 파이는 별도의 투두 완료율임을 레이블로 표시하고 습관 스트릭을 바꾸지 않는다.

### 스트릭

습관 스트릭은 연속된 **예정 회차**의 완전 달성 수다. 월·수·금 습관에서 월/수/금 완료는 3회이며 화/목/주말은 건너뛴다. 숫자 옆 단위는 '예정일 연속' 또는 '회'로 하여 달력 7일 연속으로 오해하지 않게 한다.

```text
streak(habit, anchor=today):
  d = min(anchor, today)
  if d == today and scheduled(d) and not complete(d):
    d = previousCalendarDate(d)        // 오늘만 진행 중 유예
  result = 0
  for scheduled date s descending from d to startDate:
    if not complete(s): break
    result += 1
  return result
```

과거 선택일이 미완료이면 즉시 0이며 현재 코드처럼 모든 anchor 미완료를 건너뛰지 않는다. 오늘이 휴무이면 이전 예정일부터 계산한다. pause 구간은 휴무와 같이 건너뛰고 ended 항목은 종료 전까지의 최종 기록을 표시한다. 전역 스트릭은 예정 습관이 있는 날에 모든 예정 습관을 달성했는지로 같은 규칙을 적용한다. 예정 없는 날은 늘지도 끊기지도 않는다. 모든 습관을 종료했다면 헤더 활성 스트릭은 숨기고 최종 기록을 통계에 보관한다.

365일 상한은 제거하되 무제한 역순 loop를 만들지 않는다. startDate와 데이터 시작일을 하한으로 사용하고, 요일 집합에서 직전 예정일을 찾으며 기간별 selector 결과를 캐시한다. legacy 추정 구간은 스트릭도 추정 기록임을 표시한다.

### 주간 행과 예시 검증

선택일의 월요일을 구한 뒤 7개 DateKey를 생성한다. 각 날짜의 파이는 공통 P(d)를 CSS conic-gradient 또는 SVG로 표시하며 보조 텍스트 '9월 9일, 예정 습관 2개, 75%'를 제공한다. 0%도 예정 없음과 다르게 표현한다.

| 상황 | 기대 결과 |
|---|---|
| 월/수/금 습관 A, 월·수 완료, 목요일 오늘 | A 스트릭 2; 목요일만으로 실패하지 않음 |
| 위에서 금요일 미완료, 토요일 현재 | 스트릭 0; 금요일 오늘이었다면 2 유예 |
| A 목표 1회 완료, B 목표 2회 중 1회 | 하루율 75%, 완전 달성 1/2, 초록불 아님 |
| 그날 예정 습관 0 | null/N/A, 스트릭에 영향 없음 |
| 9/10부터 매일→월/수/금 변경 | 9/9 이전 예정일/분모 유지 |
| 쉬기 9/10, 재개 9/15 | [9/10,9/15) 예정 제외 |
| 두 routine에서 A를 함께 참조 | 전체 통계에 A 한 번 |
| 과거 월요일 미완료를 선택 | 그 날짜 기준 스트릭 0 |
| 미래일 legacy 체크 존재 | 기록 보존, 현재 주·월 분모/분자 제외 |

## 5. Firestore 동기화 개선

### 5.1 선택지와 권장안

| 방식 | 장점 | 한계/적용 |
|---|---|---|
| 기존 문서에 merge:true만 추가 | 수정량 작음 | routines/todos 배열 교체와 동일 키 충돌은 그대로; 근본 대책 아님 |
| 정규화 map + 정확한 필드 경로 부분 갱신 | 다른 필드 변경 피해 축소 | 문서 성장, hot document, 경로·삭제 의미 관리 필요; 과도기만 |
| 엔터티 문서 + 날짜별 체크 문서 | 다른 habit/todo/날짜를 독립 저장, 필요한 기간만 구독 | 초기 조회/구독 수 증가; 본안 |

Firestore 문서 최대 크기는 1MiB이므로 모든 과거 checks를 하나의 문서에 무한 추가하는 구조는 지속할 수 없다. 문서 분리는 주로 충돌 범위와 전송량 개선이며 읽기 과금이 자동으로 줄어든다고 보장하지 않는다. [Firestore 한도](https://firebase.google.com/docs/firestore/quotas)

### 5.2 권장 원격 경로

```text
sync/{legacyCode}                     # 기존 원본을 보존; 새 데이터 저장하지 않음
workspaces/{workspaceId}              # schemaVersion, minClientVersion, activeGeneration
workspaces/{id}/habits/{habitId}
workspaces/{id}/habitPolicies/{policyId}
workspaces/{id}/routines/{routineId}
workspaces/{id}/todos/{todoId}          # date로 조회; 배열 저장 안 함
workspaces/{id}/goalTags/{tagId}
workspaces/{id}/mandalarts/{boardId}     # 1보드 1문서, 필드 충돌 검증
workspaces/{id}/checks/{date__habitId}   # date, habitId, count, rev
workspaces/{id}/orders/{scope__effectiveFrom}
workspaces/{id}/meta/migration         # generation, fingerprint, 진행/검증/완료
```

위 엔터티 경로는 논리 경로다. 실제 저장에서는 workspace 아래 `generations/{generationId}` 문서를 추가하고, habits부터 orders까지의 컬렉션을 그 아래 둔다. 예를 들어 체크 실제 경로는 `workspaces/{id}/generations/{generationId}/checks/{date__habitId}`다. root의 activeGeneration을 읽은 뒤 해당 세대만 구독하며, outbox에도 generationId를 포함한다. 비활성 세대에 이관한 데이터가 검증 전 화면에 노출되지 않고, 복원·전환 후 구세대 outbox가 새세대에 기록되지 않도록 한다.

초기에는 작은 habit/policy/tag/routine 메타를 구독하고 checks/todos는 표시 주·월 범위를 구독한다. 스트릭이 현재 로딩 구간을 넘으면 이전 범위를 추가로 읽는다. **아직 안 읽은 기록을 0회로 간주하면 안 된다.** 범위별 loaded/unknown 상태를 두고 계산에 필요한 이력이 없으면 '계산 중'으로 표시한다. 장기 집계 캐시는 이후 프로파일링 후 추가하고 원본이 아니다.

### 5.3 저장과 충돌 처리 계약

권장 초기 구현은 **영속 outbox + 온라인 transaction 기반 revision/3-way 병합**이다. Firestore transaction은 오프라인에서 실패하므로 로컬 앱 편집은 outbox에 저장하고 네트워크 복귀 후 transaction을 실행한다. transaction 콜백 재시도 중 UI나 localStorage를 변경하지 않는다. [Firestore transaction 동작](https://firebase.google.com/docs/firestore/manage-data/transactions)

각 PendingOperation은 `{opId,workspaceId,entityPath,baseRev,baseValues,patch,createdAt,status}`를 갖는다. 같은 엔터티는 순차 전송하며 새로운 로컬 편집은 앞선 op의 낙관 상태를 기반으로 쌓는다. 재시도는 동일 opId로 실행하고, 서버 lastOpId를 확인한 뒤 이미 적용되었으면 ack한다. 서버 commit 직후 브라우저가 종료되어도 증가가 두 번 적용되지 않게 절대 count 값을 보낸다.

다른 기기가 이후 수정하면 lastOpId가 바뀔 수 있으므로 완전한 재시도 식별은 별도 `generations/{generationId}/operations/{opId}` receipt로 보강한다. transaction에서 receipt 존재 여부와 대상 revision을 읽고, 변경 문서와 receipt를 함께 commit한다. 영속 receipt 확인 시 로컬 op를 ack하고 최신 원격 상태를 유지한다. receipt 정리는 모든 기기 ack 또는 명시적 최대 오프라인 보존 정책이 정해진 뒤 도입한다. 무조건 짧은 TTL로 지워 오래된 재시도가 다시 적용되게 하지 않는다.

수신 흐름은 `검증한 remote base → 미전송 local patch 재적용 → UI selector 갱신`이다. 원격 데이터 적용 자체는 새 outbox를 만들지 않는다. 비교는 전체 JSON 문자열이 아니라 rev/opId와 변경 필드다.

| 충돌 | 결정 규칙 |
|---|---|
| 다른 문서 편집 | 독립 처리 |
| 같은 todo의 제목과 시간처럼 다른 필드 | remote 값이 baseValues와 같거나 patch 대상이 다르면 병합 |
| 동일 필드를 두 기기에서 다르게 수정 | base와 remote가 다르면 conflicts에 보류, 두 값 비교 선택 제공 |
| 같은 체크에서 양쪽이 동일한 1회 완료 | 같은 목표값이므로 합산 없이 수렴 |
| 같은 체크에서 완료/취소 또는 서로 다른 count | 원격을 조용히 이기게 하지 않고 충돌 보류; 선택 결과 새 revision |
| 편집과 삭제 충돌 | tombstone 우선, 편집 초안은 복구 가능하게 유지; 자동 부활 금지 |
| 같은 effectiveFrom의 정책/순서 | 한 정책/한 순서 단위 충돌; 배열을 합쳐 의도 없는 순서를 만들지 않음 |
| 오래 오프라인이던 기기 재접속 | 최신 remote를 기준으로 outbox 재검사; deletedAt/세대 변경 검사 |

동일 필드 충돌을 사용자가 해결해야 하는 비용을 수용하는 대신 데이터 유실을 숨기지 않는다. 향후 요구가 단순하면 체크에 한해 서버 최종 쓰기 우선 정책으로 바꿀 수 있으나, 오프라인 지연 입력이 나중에 도착해 최신 의도를 덮을 수 있다는 제품 의미를 먼저 승인받아야 한다. Firestore 기본 오프라인 동작은 같은 문서의 변경에서 최종 쓰기 우선이며 자동으로 앱 도메인의 충돌을 해결해 주지 않는다. [오프라인 데이터 동작](https://firebase.google.com/docs/firestore/manage-data/enable-offline)

쓰기 Promise 확정 전에는 '저장 대기'를 유지한다. fromCache/hasPendingWrites 등 SDK 메타데이터와 실제 write ack를 구분해 '연결됨'을 '저장 완료'로 사용하지 않는다. 오류는 재시도 가능 네트워크 오류/권한·검증 오류로 나누고 지수 backoff를 둔다. 연결 해제 시 timer, listener, connection generation을 정리하고 이전 workspace outbox는 격리한다.

같은 브라우저 다중 탭도 localStorage lost update를 만들 수 있다. 쓰기 critical section은 기능 감지한 Web Locks로 직렬화하고 lock 안에서 최신 envelope를 다시 읽어 액션을 적용한다. 미지원이면 두 번째 탭을 읽기 전용으로 제한하고 활성 편집 탭으로 이동시키는 정책을 사용한다. storage 이벤트/BroadcastChannel은 변경 알림용이며 락 자체를 대체하지 않는다.

### 5.4 구버전 기기와 전환

새 schemaVersion 필드만 추가해도 **현재 구버전 코드는 이를 무시하고 기존 set으로 지운다.** 모든 기기가 즉시 업데이트된다고 가정할 수 없으므로 무기한 양방향 dual-write를 채택하지 않는다.

1. 먼저 기존 UI/legacy 데이터 형식을 유지하는 준비 릴리스를 배포한다. 이 릴리스는 버전/전환 표식과 export를 이해한다.
2. 기존 문서 raw snapshot을 보존하고 새 workspace의 비활성 generation에 migration을 작성한다. 문서 수가 많으면 chunk별 진행을 기록하며 deterministic ID로 재실행 가능하게 한다.
3. 원본 fingerprint, 엔터티 수, 체크 참조와 표본 통계를 검증한다. 기존 원본이 변했다면 cutover 직전에 다시 비교하여 조용히 완료 처리하지 않는다.
4. 완료 메타와 activeGeneration을 마지막에 바꾸고 새 클라이언트만 새 공간을 사용한다. 새 클라이언트의 연결 코드 입력은 legacy 경로도 인식해 읽기·이관 안내를 지원한다.
5. 이전 클라이언트의 legacy 쓰기를 차단할 수 있는 Rules/전환 제어 경로를 배포하고 emulator로 검증한다. 현재 코드만으로는 이 fencing을 강제할 수 없다. Rules 변경 없이 전환하면 legacy와 새 공간이 갈라진다는 제한을 명확히 표시해야 하며 이를 무손실 동기화라고 부르지 않는다.
6. 오프라인 구버전 기기의 미전송 변경은 새 버전으로 갱신 후 legacy export/import 비교를 통해 회수한다. cutover 후 legacy snapshot을 새 공간에 자동 재수입하지 않는다.

새 공간에 쓰기가 생긴 후 앱 바이너리를 legacy로 롤백하면 데이터 호환성이 깨진다. 이 시점의 롤백은 v3를 읽는 직전 안정 릴리스로만 한다. 이전 데이터로 복원은 별도 복구 절차다. 기존 연결 코드 UX를 유지하는 것과 구버전 앱이 새 기능 데이터를 계속 쓰는 것은 다른 호환성 계약이다.

권한 모델은 실제 Rules 확인 후 확정한다. 기존 짧은 코드를 아는 것만으로 접근하는 모델이라면 데이터 분리만으로 권한이 개선되지 않는다. 코드 충돌 방지, 새 경로 허용·검증, 필요 시 인증/소유권 전환을 동일 릴리스에서 검증해야 한다. 서비스 계정이나 Push 발송 비밀을 정적 파일에 넣지 않는다.

## 6. 렌더링 및 모바일 실행 전략

### 불변 상태 흐름

`UI 이벤트 → validate command → pure reducer → local commit → subscribers → sync outbox` 순서로 처리한다. reducer는 변경 경로만 복사한다. 대형 state 전체 structuredClone을 매 클릭마다 실행하지 않는다. development 테스트에서는 이전 상태 deepFreeze로 mutation을 검출한다. 로컬 저장 실패 시 영속 성공처럼 표시하지 않고 이전 committed 상태를 유지하며 draft/실패 액션을 재시도할 수 있게 한다.

selectors는 habits, policies, selectedDate, checks 날짜의 참조/revision을 입력으로 memoize한다. 서브트리 구독은 선택한 slice가 바뀐 경우만 실행한다. UI 입력 중 문자열은 draft이며 저장/취소/blur 규칙을 폼에 명시한다. 한글 composition 중 Enter를 저장으로 처리하지 않는다.

### 부분 렌더 범위

| 이벤트 | 갱신 범위 |
|---|---|
| 체크 1회 변경 | 해당 체크 셀/행, 해당 날짜 파이, 요약, 관련 스트릭 |
| 투두 시간·분면 변경 | 해당 todo 행 이동 및 관련 분면 카운트 |
| 입력 중 타이핑 | input 자체와 폼 validation 영역 |
| 원격 변경 | 변경 ID를 사용하는 현재 화면 부분; 편집 draft는 유지 |
| 날짜/태그/보기 변경 | 홈의 목록/요약 범위 교체, shell과 입력 모달 유지 |
| route 변경 | main-view mount/unmount, 하단 내비게이션 상태 |
| 모달 열기/닫기 | overlay-root만; 기존 포커스 복귀 |
| 동기화 상태 변경 | 상태 표시 컴포넌트만 |

초기 파일 추출 단계의 전체 렌더는 잠시 유지할 수 있다. 최종적으로 keyed DOM 목록에서 기존 ID 노드를 재사용하고 변경 노드의 textContent, value, class, aria-checked만 수정한다. 작고 입력 상태가 없는 빈 화면/통계 카드 영역은 서브트리 전체 replaceChildren을 허용한다. 전역 가상 DOM 프레임워크나 일반 diff 엔진을 새로 만들 필요는 없다.

안정된 app root에 click/change/submit 등을 한 번 위임하고 `event.target.closest('[data-action]')`를 확인한다. data-action은 고정 action map으로 처리하며 임의 문자열 eval/함수 이름 실행을 하지 않는다. 이름 영역은 메뉴 버튼, 체크 영역은 체크 버튼으로 명확히 분리한다. 폼 IME 이벤트와 드래그 pointer 이벤트처럼 국소 생명주기가 필요한 것은 해당 컴포넌트에 붙이고 dispose에서 해제한다.

모달은 role=dialog, aria-modal, focus trap, Escape/배경 탭 닫기, 이전 포커스 복귀를 제공한다. drag-only 대신 위/아래 이동 버튼을 함께 제공한다. 완료 애니메이션은 방금 변경한 행에서만 실행하고 prefers-reduced-motion을 따른다. 숫자/색만으로 상태를 전달하지 않는다.

### iOS PWA와 알림

safe-area 상하 여백, 하단바 위 FAB, 키보드 표시 시 폼 버튼 접근, 100dvh 지원/폴백, 큰 글씨와 확대를 실제 기기에서 확인한다. 문서가 visible로 돌아올 때와 자정 경계에 오늘 DateKey를 갱신하되 과거를 선택한 사용자의 selectedDate를 무조건 오늘로 돌리지 않는다.

서비스 워커는 앱 셸에만 캐시 정책을 적용한다. manifest와 모듈을 한 릴리스 버전으로 묶고 새 캐시 전체 준비가 끝난 뒤 업데이트 가능 상태를 알린다. 편집 중 강제 skipWaiting/reload를 하지 않는다. 구버전 HTML과 새 JS가 혼재하지 않도록 한 버전의 파일 집합을 유지하며 데이터 마이그레이션은 서비스 워커가 아니라 앱에서 실행한다. Firestore 응답과 백업 파일을 일반 앱 셸 캐시에 넣지 않는다. 최초 온라인 방문 없이 완전 오프라인 부팅이 된다고 주장하지 않는다.

iOS/iPadOS 홈 화면 웹 앱의 Web Push는 지원되지만 사용자 동작으로 권한을 요청해야 하며 푸시 발송 경로가 필요하다. 정적 앱의 setTimeout이나 서비스 워커를 정시 백그라운드 스케줄러로 간주하지 않는다. 우선 앱 내 시간 알림을 구현하고, 닫힌 앱 알림은 발송 서비스·구독 관리·중복 방지가 결정된 뒤 별도 단계로 제공한다. 이 제약은 알림 설정 화면의 선택 가능 옵션에 반영한다. [WebKit Web Push 안내](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## 7. 독립 배포 가능한 구현 순서와 단계별 위험

| 단계 | 구현 범위 | 독립 배포 완료 조건 | 위험과 대응 |
|---|---|---|---|
| 0. 기준 고정 | legacy fixture, 현재 기능 시나리오, 코드/데이터 백업 절차 | 기능 변화 없이 테스트 페이지로 현행 동작 재현 | 현행 버그를 새 계약으로 굳히지 않도록 현행/목표 기대값 분리 |
| 1. 파일 추출 | CSS, date/helper, storage, Firebase adapter, render 분리 | 기존 UI와 legacy schema로 모든 CRUD/백업/동기화 동작 | module scope에서 inline handler 접근 불가: 임시 명시적 bridge 후 단계 2에서 제거 |
| 2. store·안전 렌더 | 불변 action, draft, delegation, textContent, 부분 렌더 | 기능 동일, IME/포커스와 원격 수신 안정 | 대규모 UI 개편을 섞지 않고 상태 변경별 테스트 |
| 3. v3 로컬 모델 | migration, validation, 새 export, policy/selector 구현; 새 기능 UI는 숨김 | legacy fixture 전량 이관, 재시작/실패 복구, 기존 화면으로 사용 가능 | legacy로 표현 가능한 필드만 켜둠; 두 authoritative store를 동시에 운영하지 않음 |
| 4. 동기화 전환 | v3 원격 경로, outbox, revision 병합, migration fencing, Rules | 2기기 offline/재시도/구버전 전환 케이스 통과; 기존 코드 연결 경로 지원 | 가장 높은 위험; staging 공간 검증 후 opt-in 전환, rollback은 v3 호환 버전 |
| 5. 습관 기능 | 반복 요일, 목표수, cue, tag, pause/end, 복사, routine 묶음 | 해당 요일 노출·과거 분모 보존·정확한 저장/동기화 | schedule/date 의미 오류; 표의 알고리즘 fixture를 배포 게이트로 사용 |
| 6. 홈 시각 개편 | 월 선택/월~일 파이/표/FAB/액션 시트/순서 이력/하단바 | 핵심 사용 흐름 실제 iPhone 통과 | 드래그와 키보드, 좁은 폭; 대체 이동 UI 유지 |
| 7. 투두 확장 | HH:MM, 시간순, urgent/important, 4분면 | 목록과 분면에서 동일 데이터 편집 반영 | 두 화면에 별도 배열 저장 금지; 정렬 tie 규칙 검사 |
| 8. 통계 | 월간/주간/초록불, 목표 필터, 장기 스트릭 구간 로드 | 전체/필터 합계와 예정일 일치, 미로딩≠미완료 | 이력 로딩 누락, 계산 비용; cache와 범위 로딩 상태 |
| 9. 목표/만다라트 | 태그 관리, 9×9 개요/3×3 편집, habit/todo 링크 | 73개 원본 항목의 81셀 투영 일치, 연결 CRUD 복구 | 중복 원본/양방향 자동 갱신 피함; 모바일 개요+확대 |
| 10. PWA 마감 | manifest, 셸 캐시, 업데이트/복귀, 앱 내 알림, 접근성 | iPhone standalone에서 오프라인 재실행·업데이트·입력 검증 | stale cache와 schema 혼재, 백그라운드 알림 오해 |

3단계는 데이터 어댑터와 계산기를 배포하되 v3 전용 편집을 아직 활성화하지 않는 준비 릴리스다. 4단계가 검증되기 전 연결된 사용자의 새 필드를 legacy 문서에 쓰지 않는다. 로컬 전용 사용자는 검증된 v3 저장 후 기능을 사용할 수 있다. 기능 플래그는 표시 기능만 숨기며 이미 생성된 v3 데이터를 삭제하거나 다운그레이드하지 않는다.

각 단계에서 release version, 지원 schema 범위, migration 수행 여부, 되돌릴 수 있는 앱 버전을 기록한다. 기존 릴리스 태그와 백업으로 복구 시나리오를 확인한다. 단계마다 '독립 배포'는 이전 단계 위에서 안정적으로 사용할 수 있다는 의미이지 데이터 호환성이 없는 임의 버전으로 되돌릴 수 있다는 의미가 아니다.

## 8. 빌드 없이 가능한 테스트 전략

이 문서는 계획이므로 테스트 코드를 작성하거나 실행하지 않았다. 아래는 구현 단계에서 실행할 검증 계약이다. 앱 배포에 npm build는 필요 없으며 테스트 도구 사용과 제품 빌드 스텝을 구분한다.

### 브라우저 순수 모듈 테스트

저장소 루트에서 `python -m http.server 8000`으로 정적 서버를 실행하고 `/tests/index.html`을 연다. 이 페이지가 실제 domain/store/migrate 모듈을 import해 `assertEqual`, `assertDeepEqual`, `assertThrows` 결과를 표로 표시하도록 한다. 테스트는 실제 사용자 localStorage를 사용하지 않고 메모리 adapter 또는 고유 test prefix를 사용한다. Firebase adapter도 fake를 주입하며 기본 테스트가 운영 클라우드에 쓰지 않게 한다.

필수 케이스:

- migration: legacy local 세 키, version 1/2 백업, todos 누락, 빈 routines, false 체크, orphan ID, 중복 ID, 잘못된 날짜, 손상 JSON, 알 수 없는 미래 버전, 한국어·이모지·따옴표. 결정적 ID, 원본 불변성, v3 멱등성, 전후 기록수 보존을 확인한다.
- 저장: quota/권한 예외, pending 저장 직후 중단, pointer 변경 전 중단, 재부팅 복구, outbox commit과 도메인 commit 일치, 백업 왕복을 검사한다.
- schedule: 월~일, 일요일→월요일, 연말/윤년 2월, timezone별 오늘, DST 경계, startDate, pause/resume/end, 정책 적용일 직전·당일, 과거 체크 수정.
- metrics: 분모 0, 목표수 1/2/8, partial, 다중 routine 중복, 태그 이력, 미래 제외, rounding 초록불 오류, 과거 미완료 anchor, 오늘 유예, 365일 이상 연속, 미로딩 구간.
- reducer: deepFreeze된 기존 state를 변경하지 않음, 관련 없는 slice 참조 유지, 취소 draft가 영속 도메인을 바꾸지 않음.
- todo/mandalart: 시간 미지정 후순위, 동일 시간 stable sort, 분면 4조합, 분면 이동 후 시간 보존, 8개 sector/각 8개 action, 중복 렌더되는 sector 중앙 제목 일치.
- DOM: 입력 문자열 `<img ...>`/따옴표가 텍스트로 보임, 클릭 위임 중복 없음, 체크 변경 후 input 노드와 포커스 유지, 모달 닫기 후 포커스 복귀, 한글 composition Enter 무시.

### 동기화 통합 검증

Firestore Emulator Suite를 개발 검증에 사용한다. emulator 실행 도구 설치는 배포 빌드가 아니며 앱 산출물은 그대로 정적 파일이다. Rules, transaction, 구독·실패는 fake만으로 증명할 수 없으므로 emulator와 별도 staging Firebase 공간에서 확인한다. 테스트 전 endpoint가 emulator/staging인지 화면과 설정으로 확인한다.

브라우저 두 프로필을 A/B 기기로 열어 다음을 실행한다.

1. A/B가 다른 habit을 체크하고 재접속해 둘 다 유지되는지 확인.
2. 같은 체크를 동일 값으로 설정하면 중복 합산되지 않고, 완료/취소 충돌은 보류되는지 확인.
3. 같은 todo의 제목/시간은 병합되고 같은 제목 편집은 충돌하는지 확인.
4. 삭제와 오프라인 편집 후 재접속 시 자동 부활하지 않는지 확인.
5. 서버 commit 직후 ack 이전에 앱 종료 후 재시도해 같은 op가 한 번만 적용되는지 확인.
6. 코드 연결/해제/새 공간 연결 사이 남은 타이머가 잘못된 공간에 쓰지 않는지 확인.
7. legacy 기기가 migration 도중 쓰기, cutover 뒤 쓰기, 장기 오프라인 뒤 복귀할 때 차단·복구되는지 확인.
8. Rules 권한 거부, 리스너 오류, 네트워크 복귀가 올바른 저장 상태로 보이는지 확인.
9. 동일 브라우저 다중 탭에서 lock/reload 병합이 동작하고 미지원 환경은 두 번째 탭이 읽기 전용인지 확인.

### 실제 iPhone과 배포 확인

모바일 Safari와 홈 화면 standalone을 각각 검사한다. 체크→시간 편집→모달→뒤로가기→백그라운드→복귀, 키보드 열린 상태에서 원격 변경, 자정 전후, 오프라인 기록 후 앱 재실행, JSON 백업 다운로드/파일 선택 복원, 글자 확대·VoiceOver, 회전과 safe-area를 확인한다. 백업 다운로드를 호출했다는 것만으로 실제 파일 저장 확인을 보장하지 않으므로 파일 앱에서 복원까지 수행한다.

GitHub Pages의 실제 `/To-Do/` 경로에서 모든 module/CSS/manifest/icon이 200인지, hash 경로 새로고침이 되는지, CDN 실패에도 로컬 상태가 열리는지 검사한다. 서비스 워커 업데이트는 구버전 열린 탭과 새 버전을 함께 두고 draft 보존·전체 캐시 준비·v3 읽기 호환을 확인한다.

성능 기준은 우선 습관 100개·1년 기록과 투두 1,000개 fixture로 목표 기기에서 측정한다. 체크 반응은 즉시 낙관 표시하고 큰 전체 HTML 대체가 없는지 Performance/DOM 검사로 확인한다. 50ms 이상 긴 작업이 반복되면 JSON 직렬화/통계 구간을 먼저 측정하고, 그 근거가 생긴 뒤 IndexedDB 저장이나 월별 캐시를 검토한다. 근거 없이 가상 스크롤과 전체 상태 관리 라이브러리를 추가하지 않는다.

## 9. 구현자가 유지할 결정과 남은 확인

이 계획의 기본값은 습관 동일 가중 달성률, 예정 회차 스트릭, pause 중 스트릭 보존, 종료 후 복사 재시작, 오늘부터 설정 적용(기록 있으면 내일 제안), legacy 근사 통계 표시, 충돌 명시적 해결이다. 추가 사용자 결정을 기다리지 않고 이 기본값으로 설계·테스트를 구체화할 수 있다.

구현 전 실제 환경에서 확인할 것은 Firestore Rules/연결 권한, 활성 기기와 legacy 전환 가능성, 대표 데이터 크기, 지원할 iOS 버전, 앱이 닫힌 상태의 알림을 위해 발송 서비스를 추가할지 여부다. 이 확인은 계획 문서 작성의 미완료 사항이 아니라 각 구현 단계의 착수·배포 조건이다. 앱 코드와 기존 데이터는 이번 작업에서 수정하지 않았다.
