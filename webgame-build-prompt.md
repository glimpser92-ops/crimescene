# Scenario Repair Notes

- Canon preserved: title, 천문관 배경, 사라진 운석 `아틀라스 블루`, 범인 차서윤, 21:08 실제 도난, 21:17 지연 경보, 별자리 지도 보관통 은닉, 4명 용의자, 4개 조사 장소, 24개 증거 카드.
- Author decisions added for web playability: single shared-device play, React single-file target, staged investigation rounds, contradiction board, 3단계 힌트, 점수 체계, 최종 고발 검증 규칙.
- No story repair required: 기존 시나리오는 최종 공개 전에도 두 개의 독립 증명 경로가 있으며, 최종 증거 E24는 확정용으로만 사용한다.

# Web Game Build Prompt: 0시 17분, 별이 사라진 밤

You are building a polished browser-based mystery investigation game in Korean.

## 1. Core Goal

Build a playable small-group deduction web game based on the mystery scenario `0시 17분, 별이 사라진 밤`. The game is for 2-6 players using one shared device in a 45-75 minute session. Players investigate a locked-room theft at a private planetarium, collect evidence cards, question suspects, connect contradictions on a reasoning board, and submit one final accusation.

The first screen must be the actual game experience, not a marketing page. The game should feel like a clean, premium classroom-safe crime-scene investigation tool: readable, atmospheric, evidence-first, and built for discussion.

## 2. Non-Negotiable Constraints

- Build as a single React component file with a default export.
- Keep all case data in structured constants near the top of the file.
- No backend, no network calls, no external fetch, no localStorage, no sessionStorage.
- Tailwind utility classes are allowed if available.
- `lucide-react` icons are allowed if available.
- Use Korean UI copy.
- Tone: tense mystery, but classroom-safe. No gore, horror, or adult content.
- Preserve all canon case facts below.
- Do not make the decisive final clue the only real proof. The culprit must be provable before the reveal.

## 3. Game Canon

- Apparent incident: At 21:17, during a final rehearsal at the private planetarium `오르빗 돔`, the security alarm rings and the blue meteorite fragment `아틀라스 블루` is discovered missing from its sealed display case. All outer doors and emergency exits are locked, and CCTV shows no one leaving.
- True incident: The real theft happened at 21:08. The 21:17 alarm was delayed by a magnet-based sensor trick.
- Culprit: 차서윤, the exhibition planner.
- Motive: 차서윤 wanted to expose that director 윤하린 stole credit for her father's discovery, and she also needed money to repay debt.
- Method: During a planned blackout in the rehearsal, 차서윤 left the control room, reached the exhibition hall through the service curtain route, used a copied master card to open the case, removed the real meteorite, placed a replica and magnet device to fool the weight sensor, then returned to the control room.
- Opportunity: 21:06-21:10, when the control room headset recording goes silent and the exhibition hall is dark.
- Staging/concealment: At 21:17, 차서윤 pulled a fishing line from the control room cable hole to drop the magnet device, causing a delayed alarm and making it look as if the theft occurred at that moment. She hid the real meteorite in a star-map storage tube, then put the tube back into an equipment box during the confusion.
- Decisive proof: The real `아틀라스 블루` is found inside the star-map storage tube with a fishing-line fragment tied in the same knot style as 차서윤's cue bracelet.
- Final lesson: The apparent time of an alarm is not always the time of the crime; players must prove time, route, method, motive, and elimination.

## 4. Required Data Constants

Create readable constants with this shape:

```js
const CASE = {};
const SUSPECTS = [];
const LOCATIONS = [];
const EVIDENCE = [];
const QUESTIONS = {};
const BOARD_RULES = [];
const UNLOCK_RULES = [];
const FINAL_ACCUSATION = {};
const REVEAL_STEPS = [];
```

Every evidence card must include:

```js
{
  id,
  title,
  source,
  location,
  round,
  tags,
  playerText,
  surfaceMeaning,
  trueMeaning,
  supports,
  implicates,
  clears,
  dependsOn,
  visualization
}
```

## 5. Player Flow

1. Team setup: players enter team name and optionally assign collaboration roles: 현장 리더, 증거 기록관, 심문 담당, 추리 보드 담당.
2. Case briefing: show the incident, victim object, location map, and four suspect cards.
3. Investigation hub: show locations, evidence notebook, suspect files, contradiction board, hints, and final accusation gate.
4. Location search: players inspect four locations and unlock evidence by round.
5. Evidence notebook: searchable/filterable evidence cards with tags such as 시간, 동선, 수단, 동기, 알리바이, 은폐, 결백.
6. Suspect questioning: players can read base statements and present selected evidence to suspects.
7. Contradiction board: players select 2-4 evidence cards to submit reasoning links. Correct links unlock deeper evidence or final readiness.
8. Decision evidence: unlock E24 only after enough core rules are solved.
9. Final accusation: require culprit, motive, method, true theft time, staging method, hidden location, and supporting evidence.
10. Staged reveal and result screen: replay timeline, explain red herrings, score the team.

## 6. Suspects

| id | name | role | surface suspicion | real secret | claimed alibi | real alibi | clearing evidence | key reactions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seoyun | 차서윤 | 전시기획자 | 조정실 공백, 보관통 대여, 수집상 메시지 | 아버지의 현장노트와 사채 독촉장을 숨김 | 21:05-21:20 조정실에서 자막 점검 | 21:06-21:10 전시홀, 21:11 조정실 복귀, 21:17 낚시줄 당김 | 없음. 증거 종합으로 범인 확정 | E14에 흔들리고, E16을 "소품 확인"이라 둘러대며, E20에는 답변을 회피한다. |
| harin | 윤하린 | 천문관장 | 빚, 마스터 카드 기록, 발견 공로 표절 의혹 | 차서윤 아버지의 발견 기록을 자기 명의로 발표 | 옥상 관측실에서 렌즈 점검 | 21:03-21:15 옥상, 21:16 계단 | E09, E10 | E04에는 당황하지만, E09/E10 제시 시 케이스를 연 사람이 자신은 아니라고 주장한다. |
| dohyun | 백도현 | 후원사 이사 | 독점 전시권 계약과 해외 전시 압박 | 운석을 상업 전시 상품으로 이용하려 함 | VIP 라운지에서 투자자 통화 | 21:04-21:16 라운지 통화, 21:17 복도 | E11, E12 | E05에는 방어적이고, E11이 나오면 거래 욕심과 도난은 별개라고 말한다. |
| eunbyeol | 고은별 | 박사과정 연구원 | 형광가루 묻은 장갑과 정밀 도구 | 실험 중 렌즈를 깨뜨려 숨김 | 분석실에서 분광기 보정 | 21:02-21:13 분석실, 21:14 장비실 | E13 | E06에는 말을 흐리지만, E13 이후 렌즈를 숨긴 사실만 인정한다. |

## 7. Locations

| id | name | round | scene state | available evidence | unlock condition | visual role |
| --- | --- | --- | --- | --- | --- | --- |
| exhibition | 전시홀 | briefing/round1/round2 | 케이스는 멀쩡하지만 운석은 사라졌고 바닥에 푸른 가루가 있다. | E01, E02, E03, E18, E19 | E18/E19는 Round 2 또는 board rule R2 이후 공개 | 중심 범행 현장, 케이스 다이어그램 표시 |
| control | 플라네타리움 조정실 | round1/round2 | 자막 콘솔, 헤드셋, 케이블 홀, 리허설 큐시트가 있다. | E07, E14, E20 | E20은 R1 또는 R3 이후 공개 | 시간 공백과 원격 조작의 핵심 |
| lab | 분석실/장비실 | round1/round2 | 분광기, 깨진 렌즈, 장갑, 별자리 지도 보관통 관련 장비가 있다. | E06, E13, E16, E17, E23, E24 | E23은 R5 이후, E24는 final unlock 이후 공개 | 고은별 해소와 운석 은닉 장소 |
| lounge | VIP 라운지 | round1/round2 | 계약서, 통화 기록, 금속 케이스가 있다. | E05, E11, E12 | E11/E12는 백도현 심문 또는 Round 2 이후 공개 | 백도현 의심과 해소 |
| records | 기록/문서 보관함 | round2 | 과거 발견 기록과 차서윤의 숨은 동기를 담은 자료가 있다. | E04, E10, E21, E22 | E21/E22는 board rule R4 이후 공개 | 동기와 관계 갈등 강화 |

## 8. Evidence Cards

Use these exact IDs and meanings.

| id | title | source/location | round | tags | playerText | surfaceMeaning | trueMeaning | supports | implicates | clears | dependsOn |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E01 | 마스터 카드 개방 기록 | 전시홀 보안 로그 | briefing | 시간, 수단 | 케이스는 깨지지 않았고 21:08 `관장 마스터 카드`로 열린 기록이 있다. | 윤하린이 열었을 수 있다. | 복제 카드 가능성을 남긴다. | 수단, 시간 | 윤하린 |  |  |
| E02 | 경보 직전 녹음 | 전시홀 보안 녹음 | briefing | 시간, 은폐 | 녹음에는 유리 파손음이 아니라 `딸깍, 스르륵` 소리가 난다. | 장치 조작이 있었다. | 낚시줄과 자석 제거 소리다. | 은폐, 수단 | 차서윤 |  |  |
| E03 | 푸른 형광가루 흔적 | 전시홀 바닥 | briefing | 동선, 흔적 | 푸른 가루가 커튼 뒤까지 이어진다. | 고은별의 실험 흔적일 수 있다. | 운석 이동 경로다. | 동선 | 고은별, 차서윤 |  |  |
| E04 | 채무 조정 문서 | 기록 보관함 | round1 | 동기, 문서 | 윤하린의 채무 조정 문서가 발견된다. | 윤하린에게 금전 동기가 있다. | 강한 동기지만 실행 시간은 없다. | 동기 | 윤하린 |  |  |
| E05 | 독점 전시권 계약서 | VIP 라운지 | round1 | 동기, 문서 | 백도현이 운석 독점 전시권을 압박한 계약서다. | 백도현이 운석을 노렸다. | 상업적 욕심은 있으나 직접 실행 증거는 아니다. | 동기 | 백도현 |  |  |
| E06 | 깨진 렌즈와 장갑 | 분석실 | round1 | 수단, 흔적 | 고은별의 숨긴 장갑과 깨진 렌즈가 있다. | 고은별이 무언가를 숨겼다. | 렌즈 파손 은폐용 거짓말이다. | 알리바이, 결백 | 고은별 | 고은별 |  |
| E07 | 암전 큐시트 | 조정실 | round1 | 시간, 동선 | 차서윤의 리허설 큐시트에 `21:06 암전 유지`가 표시되어 있다. | 단순 연출 일정일 수 있다. | 범행 이동 시간을 만든 표시다. | 시간, 기회 | 차서윤 |  |  |
| E08 | 네 사람의 알리바이 | 공통 브리핑 | briefing | 알리바이 | 네 명의 알리바이 진술서다. | 모두 자신의 위치를 주장한다. | 이후 증거와 대조하는 기준이다. | 알리바이 | 모두 |  |  |
| E09 | 옥상 열화상 | 옥상 기록 | round2 | 알리바이, 결백 | 윤하린은 21:03-21:15 옥상 열화상에 계속 잡힌다. | 윤하린의 알리바이가 강해진다. | 21:08 전시홀 접근이 어렵다. | 결백 |  | 윤하린 | E08 |
| E10 | 마스터 카드 보관함 기록 | 기록 보관함 | round2 | 수단, 결백 | 마스터 카드는 21:00 이후 관장실 금고 안에 있었다. | 로그가 이상하다. | 케이스 기록은 복제 카드 번호다. | 수단, 결백 | 차서윤 | 윤하린 | E01 |
| E11 | VIP 통화 녹음 | VIP 라운지 | round2 | 알리바이, 결백 | 백도현 목소리가 21:04-21:16 통화 녹음에 이어진다. | 백도현은 라운지에 있었다. | 21:08 전시홀 접근이 어렵다. | 결백 |  | 백도현 | E08 |
| E12 | 알루미늄 금속 케이스 | VIP 라운지 | round2 | 수단, 결백 | 백도현의 금속 케이스는 자석이 붙지 않는 알루미늄이다. | 자석 장치를 숨겼을 수 있다. | 자석 장치 출처가 아니다. | 결백 |  | 백도현 | E18 |
| E13 | 분광기 로그와 렌즈 파편 | 분석실 | round2 | 알리바이, 결백 | 분광기 로그와 고은별 지문 묻은 렌즈 파편이 있다. | 고은별은 실험실에서 사고를 숨겼다. | 고은별은 렌즈를 숨겼지 운석을 옮기지 않았다. | 결백 |  | 고은별 | E06 |
| E14 | 헤드셋 녹음 공백 | 조정실 | round2 | 알리바이, 시간 | 조정실 헤드셋 녹음은 21:06-21:10만 비어 있다. | 차서윤의 알리바이에 구멍이 있다. | 차서윤이 움직일 수 있는 정확한 시간대다. | 기회, 알리바이 | 차서윤 |  | E08 |
| E15 | 은색 글리터 흔적 | 서비스 커튼 | round2 | 동선, 흔적 | 커튼 뒤에서 차서윤 구두와 같은 은색 글리터가 발견된다. | 차서윤이 커튼 뒤를 지나갔다. | 조정실에서 전시홀로 간 이동 경로다. | 동선 | 차서윤 |  | E14 |
| E16 | 보관통 대여 기록 | 전시 소품 대장 | round2 | 물건, 은폐 | 차서윤이 20:58 별자리 지도 보관통을 빌렸다. | 소품 업무일 수 있다. | 운석 은닉 용기를 미리 확보했다. | 은폐, 준비 | 차서윤 |  |  |
| E17 | 도려낸 완충재 | 보관통 내부 | round2 | 물건, 은폐 | 보관통 내부 완충재가 운석 케이스와 같은 타원형으로 도려져 있다. | 무언가를 넣기 위한 준비다. | 운석을 숨기기 위한 사전 준비다. | 은폐, 준비 | 차서윤 |  | E16 |
| E18 | 자석 테이프 잔여물 | 전시대 아래 | round2 | 수단, 은폐 | 전시대 아래에 자석 테이프 잔여물이 있다. | 센서를 속였을 수 있다. | 센서 지연 장치의 흔적이다. | 수단, 은폐 | 차서윤 |  | E02 |
| E19 | 보안 매뉴얼 | 전시홀 매뉴얼 | round2 | 수단, 시간 | 무게 센서는 자석 보조판이 떨어지는 순간 경보가 울린다. | 경보 시점이 실제 도난 시점과 다를 수 있다. | 21:17 경보가 실제 도난 시간이 아님을 증명한다. | 시간, 수단 | 차서윤 |  | E18 |
| E20 | 케이블 홀의 낚시줄 | 조정실/커튼 뒤 | late | 동선, 은폐 | 커튼 뒤 낚시줄 끝이 조정실 케이블 홀로 이어진다. | 조정실에서 장치를 조작했다. | 차서윤이 경보를 원격으로 터뜨렸다. | 은폐, 동선 | 차서윤 |  | E14, E18 |
| E21 | 무기명 유심 메시지 | 차서윤 가방 | late | 동기, 은폐 | `21:40 북문 보관함` 메시지가 있다. | 외부 전달 계획이 있다. | 훔친 물건을 외부로 넘기려 했다. | 동기, 후속계획 | 차서윤 |  | E16 |
| E22 | 오래된 현장노트 | 기록 보관함 | late | 동기, 관계 | 차서윤 아버지의 오래된 현장노트다. | 윤하린의 과거가 수상하다. | 윤하린 표절이 차서윤 동기의 뿌리다. | 동기, 관계 | 차서윤, 윤하린 |  | E04 |
| E23 | 새 봉인 스티커 | 장비 상자 | late | 은폐, 시간 | 장비 상자에 되돌아간 보관통 봉인 스티커가 21:21 새것이다. | 누군가 혼란 중 보관통을 만졌다. | 차서윤이 은닉을 마무리했다. | 은폐, 시간 | 차서윤 |  | E16, E17 |
| E24 | 보관통 속 아틀라스 블루 | 장비 상자 | final | 결정적, 은폐 | 보관통 안에서 진품 운석과 차서윤 큐팔찌 매듭과 같은 낚시줄 조각이 발견된다. | 진품의 위치가 확인된다. | 범인과 운석 위치를 확정한다. | 결정적 증거 | 차서윤 | 모두 | E16, E17, E20, E23 |

## 9. Timeline and Movement

| time | real event | player-facing contradiction |
| --- | --- | --- |
| 20:45 | 차서윤이 보관통에 운석 크기 완충재를 준비한다. | 보관통이 왜 미리 가공되었는가? |
| 20:58 | 차서윤이 전시 소품 확인 명목으로 보관통을 빌린다. | 소품 대여가 범행 준비였는가? |
| 21:03 | 윤하린은 옥상, 백도현은 VIP 라운지, 고은별은 분석실로 이동한다. | 세 사람의 알리바이는 나중에 검증된다. |
| 21:05 | 플라네타리움 리허설로 전시홀이 어두워진다. | 암전은 단순 연출인가, 기회인가? |
| 21:06 | 차서윤이 조정실 마이크를 음소거하고 전시홀로 이동한다. | 조정실 녹음 공백이 발생한다. |
| 21:08 | 차서윤이 복제 마스터 카드로 케이스를 열고 진품을 보관통에 넣는다. | 보안 로그에는 관장 카드처럼 남는다. |
| 21:11 | 차서윤이 조정실로 복귀한다. | 알리바이 일부는 진짜다. |
| 21:17 | 차서윤이 낚시줄을 당겨 자석을 떨어뜨리고 경보를 울린다. | 플레이어는 처음에 이때 도난이 발생했다고 믿는다. |
| 21:20 | 네 사람이 전시홀에 모인다. | 모두가 발견자처럼 보인다. |
| 21:21 | 차서윤이 보관통을 장비 상자에 되돌려 놓는다. | 봉인 스티커 시간이 은닉을 드러낸다. |

## 10. Contradiction Board Rules

Players submit evidence links. Implement exact required IDs for validation, but show only reasoning categories in wrong-link feedback.

Wrong-link feedback examples:
- "시간 단서끼리 더 비교해 보세요."
- "이 조합은 동기는 보이지만 실제 이동 경로를 설명하지 못합니다."
- "결백을 확인하려면 알리바이와 기록 단서를 함께 봐야 합니다."

Do not reveal exact missing IDs in wrong-link feedback.

| id | required | title | result | kind | suspect | unlocks | typeHints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | E07, E14 | 조정실 알리바이의 빈칸 | 차서윤의 조정실 알리바이는 21:06-21:10 사이 비어 있다. | contradiction | seoyun | E15 | 시간, 알리바이 |
| R2 | E02, E18, E19 | 경보는 범행 시간이 아니다 | 경보는 도난 순간이 아니라 센서 장치가 떨어진 순간 울렸다. | core | seoyun | E20 | 수단, 시간, 은폐 |
| R3 | E14, E15, E20 | 조정실에서 이어진 원격 조작 | 차서윤은 조정실과 커튼 뒤 경로를 이용해 장치를 조작할 수 있었다. | core | seoyun | finalReadiness + E23 | 동선, 은폐 |
| R4 | E04, E22 | 표절된 발견의 원한 | 차서윤의 범행 동기는 단순 돈 문제가 아니라 아버지의 발견을 빼앗긴 일과 연결된다. | insight | seoyun | E21 | 동기, 관계 |
| R5 | E16, E17, E23 | 보관통은 은닉 도구였다 | 별자리 지도 보관통은 전시 소품이 아니라 진품 운석을 숨기기 위한 용기였다. | core | seoyun | E24 gate | 물건, 은폐 |
| R6 | E09, E10 | 관장 카드 기록의 함정 | 윤하린은 수상하지만 21:08에 케이스를 직접 열 수 없었다. | elimination | harin | harinCleared | 알리바이, 수단 |
| R7 | E11, E12 | 후원사의 욕심과 실행 가능성 분리 | 백도현은 동기가 있지만 21:08 접근과 자석 장치 출처가 맞지 않는다. | elimination | dohyun | dohyunCleared | 알리바이, 수단 |
| R8 | E06, E13 | 연구원의 거짓말은 다른 사고였다 | 고은별은 렌즈 파손을 숨겼지만 운석 도난 경로와 맞지 않는다. | elimination | eunbyeol | eunbyeolCleared | 흔적, 알리바이 |

Final accusation should unlock when players solve at least R1, R2, R3, R5 and at least two elimination rules among R6, R7, R8. E24 should unlock only after R5 plus final readiness, or immediately after players submit a mostly correct final accusation as decision evidence.

## 11. Suspect Questioning

Use unlimited basic questioning, but require a consensus confirmation before presenting evidence to a suspect.

Each suspect must have:
- base statement
- alibi statement
- relationship statement
- reaction to key evidence
- clearing or pressure response
- final reveal explanation

Suggested evidence reactions:

```js
QUESTIONS = {
  seoyun: {
    base: "저는 조정실에서 자막과 조명을 맞추고 있었어요. 암전은 리허설 순서였고요.",
    alibi: "21시 5분부터 20분까지 거의 조정실에 있었습니다. 중간에 잠깐 콘솔 오류를 봤을 뿐이에요.",
    relationship: "관장님과 일로 부딪힌 적은 있지만, 전시를 망칠 이유는 없어요.",
    reactions: {
      E14: "녹음 공백은 장비 오류였을 거예요. 리허설 때는 그런 일이 자주 있어요.",
      E16: "보관통은 전시 소품 확인 때문에 빌린 겁니다.",
      E20: "그 줄이 왜 거기 있었는지는 저도 모릅니다.",
      E22: "그 노트는... 제 가족 일입니다. 사건과 엮지 말아 주세요."
    }
  },
  harin: {
    base: "이 운석은 천문관의 상징입니다. 제가 훔칠 이유가 없습니다.",
    alibi: "옥상에서 렌즈를 점검하고 있었습니다.",
    reactions: {
      E04: "재정 문제는 있었지만 운석을 팔 생각은 없었습니다.",
      E09: "보셨죠. 저는 그 시간 옥상에 있었습니다.",
      E10: "카드가 금고에 있었다면, 로그 자체를 의심해야 합니다."
    }
  },
  dohyun: {
    base: "저는 후원자입니다. 상품성을 논한 것과 도둑질은 다릅니다.",
    alibi: "VIP 라운지에서 계속 통화 중이었습니다.",
    reactions: {
      E05: "계약은 사업입니다. 불법은 아니죠.",
      E11: "그 통화가 제 위치를 증명합니다.",
      E12: "그 케이스는 자료 보관용입니다. 자석과는 관계 없습니다."
    }
  },
  eunbyeol: {
    base: "저는 분석실에 있었습니다. 전시홀에는 가지 않았어요.",
    alibi: "분광기를 보정하고 있었습니다.",
    reactions: {
      E06: "렌즈는... 제가 깨뜨렸습니다. 혼날까 봐 숨겼어요.",
      E13: "네, 제 거짓말은 그 사고 때문입니다. 운석은 아닙니다.",
      E03: "형광가루가 제 장갑에 묻었을 수는 있지만, 운석을 옮긴 건 아니에요."
    }
  }
};
```

## 12. Hints and Anti-Stuck Design

Add a 3-level hint ladder. Require a confirmation before using a hint.

Hints must not reveal exact evidence IDs, exact culprit-answer bundles, or the final hidden location.

Hint categories:

1. Broad axis:
   - "경보가 울린 시각과 실제 도난 시각을 분리해서 보세요."
   - "각 용의자의 동기보다 이동 가능 시간을 먼저 검증하세요."
2. Reasoning question:
   - "조정실 알리바이에서 소리가 사라진 시간과 암전 큐시트의 시간이 겹치나요?"
   - "경보 직전 녹음 소리는 무엇이 깨진 소리인지, 무엇이 떨어진 소리인지 비교해 보세요."
3. Near-answer framing:
   - "누군가는 전시홀에서 직접 훔친 뒤, 나중에 다른 장소에서 경보만 울리게 만들었습니다."
   - "운석을 밖으로 빼낸 것이 아니라, 전시장 내부 물건 안에 잠시 숨겼을 가능성을 보세요."

Scoring should subtract a small amount for each hint, but never block progress.

## 13. Scoring

Use a 100-point system:

- Correct culprit: 20
- Correct motive: 15
- Correct true theft time: 10
- Correct method: 15
- Correct staging/concealment: 15
- Correct hidden location of the meteorite: 10
- Correctly clears at least two innocent suspects: 10
- Solved board rule bonus: up to 10
- Unused hint bonus: up to 5

Penalties:

- Wrong final accusation attempt: -10
- Each hint used: -3
- Excessive random board attempts: -1 after the third wrong attempt, if tracked

Result tiers:

- 90-100: 완벽한 수사팀
- 75-89: 결정적 추리 성공
- 55-74: 핵심은 맞혔지만 빈틈 있음
- 0-54: 재수사 필요

## 14. Final Accusation

Players must submit:

```js
{
  culprit: "seoyun",
  motive: selected or written answer,
  method: selected or written answer,
  trueTime: "21:08",
  staging: selected or written answer,
  hiddenLocation: "별자리 지도 보관통 / 장비 상자",
  evidenceIds: []
}
```

Validation should accept the final accusation as strong if:

- culprit is `seoyun`
- true theft time includes `21:08`
- method mentions copied master card, replica/magnet, or sensor trick
- staging mentions delayed alarm, fishing line, or remote trigger from control room
- hidden location mentions star-map storage tube or equipment box
- selected evidence includes at least four of: E14, E15, E16, E17, E18, E19, E20, E21, E22, E23

After submission, show feedback by category first. Do not immediately reveal the full answer unless players choose to proceed to reveal.

## 15. Reveal Sequence

Create 9 staged reveal cards:

1. Apparent incident: "21:17, 경보가 울렸고 운석은 사라져 있었다."
2. Key hidden fact: "경보는 도난 순간이 아니라 장치가 떨어진 순간 울렸다."
3. True timeline: "진짜 도난은 21:08, 암전과 조정실 녹음 공백 사이에 일어났다."
4. Movement route: "차서윤은 조정실에서 서비스 커튼 뒤 통로를 통해 전시홀로 이동했다."
5. Method proof: "복제 마스터 카드, 복제 운석, 자석 보조판이 케이스 센서를 속였다."
6. Staging proof: "낚시줄은 조정실 케이블 홀에서 커튼 뒤 장치까지 이어져 있었다."
7. Motive reframing: "차서윤은 아버지의 발견을 빼앗긴 사실과 빚 때문에 운석을 노렸다."
8. Why innocents looked guilty: "윤하린은 표절과 채무, 백도현은 계약 욕심, 고은별은 렌즈 파손 때문에 수상해 보였다."
9. Decisive convergence: "진품은 별자리 지도 보관통 안에 있었고, 매듭은 차서윤의 큐팔찌와 같았다."

End with a clear reflection line:
"수사는 가장 시끄러운 순간이 아니라, 가장 조용히 비어 있는 시간을 따라갈 때 진실에 닿는다."

## 16. Visual and UX Direction

- Atmosphere: modern private planetarium, midnight blue, starlight cyan, warm brass accents, clean glass-panel surfaces.
- Avoid a one-color interface; use restrained dark neutrals with cyan, brass, and off-white contrast.
- No decorative gradient blobs or generic marketing hero sections.
- First viewport should show the case briefing and actionable game controls.
- Use icons for evidence, suspects, map, board, hints, final accusation, and reveal.
- Evidence cards should be compact and scannable, with tags and source clearly visible.
- Use a location map layout: four main investigation zones plus records/archive.
- The contradiction board should make selected evidence visible as chips/cards, with a short reasoning note field.
- Ensure mobile and tablet layouts have no horizontal overflow.
- Buttons and cards should have stable dimensions and large tap targets.
- Dense text should be collapsible or staged, not dumped all at once.
- Include accessible labels, keyboard-friendly controls, and visible focus states.

## 17. Suggested Components

- `GameShell`
- `TeamSetup`
- `CaseBriefing`
- `InvestigationHub`
- `LocationMap`
- `LocationScene`
- `EvidenceNotebook`
- `EvidenceCard`
- `SuspectPanel`
- `QuestioningModal`
- `ContradictionBoard`
- `HintPanel`
- `FinalAccusation`
- `RevealSequence`
- `ScoreSummary`

Use data-driven rendering. Avoid hardcoding separate UI for each evidence card or suspect when the constants can drive it.

## 18. Technical Implementation Requirements

- Keep state simple with React hooks.
- Track discovered evidence, solved board rules, cleared suspects, used hints, wrong board attempts, final accusation status, and reveal step.
- Implement helper functions:
  - `getEvidenceById(id)`
  - `isEvidenceDiscovered(id)`
  - `canUnlockEvidence(evidence)`
  - `checkBoardRule(selectedIds)`
  - `getUnlockedLocations()`
  - `getFinalReadiness()`
  - `validateFinalAccusation(answer)`
  - `calculateScore(state)`
- Board rule matching should be order-independent.
- Wrong board feedback must use categories only, not exact missing evidence IDs.
- Include no placeholder screens. Every main button should do something.
- All 24 evidence cards must be discoverable through normal play.
- The final reveal must remain locked until final accusation is submitted or the team explicitly chooses "정답 보기" after a warning.

## 19. Acceptance Checklist

- [ ] Game starts at the playable investigation experience.
- [ ] All case data is stored in readable constants near the top.
- [ ] All 4 suspects are represented with suspicion, secret, alibi, and clearing path.
- [ ] All 5 locations are usable and evidence is discoverable through normal play.
- [ ] All 24 evidence cards are implemented with tags, source, player text, surface meaning, true meaning, supports, implicates, clears, dependencies, and reveal phase.
- [ ] Contradiction board has exact rule validation for R1-R8.
- [ ] Wrong board feedback does not reveal exact answer bundles.
- [ ] Hints use a 3-level ladder and do not leak exact final answers.
- [ ] Final accusation validates culprit, motive, method, true time, staging, hidden location, and evidence.
- [ ] The culprit can be proven before E24 and before the reveal.
- [ ] At least two proof paths converge on 차서윤.
- [ ] 윤하린, 백도현, and 고은별 each have a suspicious path and clearing path.
- [ ] Reveal explains timeline, motive, method, staging, and all red herrings.
- [ ] Score screen reflects evidence, board rules, hints, and final accusation quality.
- [ ] Mobile/tablet layout has no horizontal overflow.
- [ ] No backend, network call, localStorage, or sessionStorage is used.

# QA Checklist

- Pass: culprit, motive, method, opportunity, and concealment are explicit.
- Pass: apparent incident and true incident are separated.
- Pass: culprit is provable before the reveal through R1, R2, R3, R5 and supporting evidence.
- Pass: two proof paths converge: 알리바이 붕괴 path and 센서 조작/은폐 path.
- Pass: E24 removes ambiguity but is not the only proof.
- Pass: every innocent suspect has suspicion plus clearing evidence.
- Pass: red herrings are explained by reveal step 8.
- Pass: web flow, state, unlocks, contradiction board, hints, scoring, and final validation are specified.
- Remaining risk: if the builder targets a non-React framework, adapt the file/component constraints but preserve the data contract and mystery logic.
