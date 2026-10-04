/* 경쟁전 튜닝 수치는 전부 여기 한 곳이다. 코어(compete.mjs)·봇·서버·화면이 이 값을 읽고,
   코드 안에는 숫자를 흩뿌리지 않는다. */

/* 타수(두벌식 물리 키). Shift 는 세지 않는다 — 쌍자음·ㅒ·ㅖ 는 Shift+키 한 번이다.
   app.js 의 keysOf 와 같은 값이어야 한다(?rt=1 이 서울 풀 전부로 견준다) */
export const STROKE = {
  compoundVowel: 2,   // ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ
  compoundFinal: 2,   // ㄳ ㄵ ㄶ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅄ
  jamo: 1,            // 그 밖의 자모(쌍자음·ㅒ·ㅖ 포함)
  other: 1,           // 숫자·가운뎃점·공백 등 한글 아닌 글자 하나
  commit: 1,          // 확정 키(Enter·스페이스). 항목 하나에 한 번
};

/* 랭크 코스 풀. 시작은 서울 — 구 25 + 행정동(구마다 코스 하나). 같은 이름(신사동)은 한 번만 */
export const RANKED_POOL = ['seoul-gu',
  ...['dobong', 'dongdaemun', 'dongjak', 'eunpyeong', 'gangbuk', 'gangdong', 'gangnam', 'gangseo',
      'geumcheon', 'guro', 'gwanak', 'gwangjin', 'jongno', 'jung', 'jungnang', 'mapo', 'nowon',
      'seocho', 'seodaemun', 'seongbuk', 'seongdong', 'songpa', 'yangcheon', 'yeongdeungpo', 'yongsan']
    .map(g => g + '-dong')];

/* 문제 세트. 예산은 N × 풀 평균 타수(확정 키 포함)의 ±tolerance. 길이는 풀을 타수로 셋(짧음·중간·김)으로
   가른 비율대로 뽑는다. tries 안에 예산을 못 맞추면 가장 가까운 세트를 쓴다 */
export const SET = { size: 15, tolerance: .03, bins: [1 / 3, 1 / 3, 1 / 3], tries: 2000 };

/* 모드 */
export const SPRINT = {
  secs: 120,
  countdownMs: 3000,
  tieMs: 50,          // 두 완주가 이만큼 안이면 동시 — 정확도로 가린다
};
export const TERRITORY = {
  secs: 90,
  countdownMs: 3000,
  labels: true,       // 지도에 이름을 보인다
};

/* 실시간 서버(로비·판 DO) */
export const NET = {
  ticketMs: 30000,      // /compete/ticket 이 내는 일회용 표의 수명
  authMs: 5000,         // 소켓을 연 뒤 이 안에 auth 가 없으면 끊는다. 그 전 메시지는 전부 무시
  joinMs: 15000,        // 짝이 지어진 뒤 두 사람이 판 소켓에 붙어야 하는 시간 — 넘기면 무른다
  reconnectMs: 10000,   // 판 도중 끊긴 사람을 기다리는 시간 — 넘기면 기권
  tickMs: 100,          // 판이 도는 동안의 박자(상대 진행 10Hz)
  cleanupMs: 300000,    // 판이 끝난 뒤 DO 저장분을 지우기까지(늦게 붙은 사람이 결과를 받을 틈)
  maxMsgBytes: 8192,    // 메시지 하나의 크기
  maxMsgPerSec: 40,     // 소켓 하나가 1초에 보낼 수 있는 메시지 — 넘기면 끊는다
  maxKeysPerBatch: 200, // input.keys 한 묶음의 키 수
  pings: 5,             // 시계 맞추기 — 브라우저가 이만큼 핑을 보내 RTT 가 가장 짧은 표본을 쓴다
  saveRetryMs: 30000,   // 끝난 판을 D1 에 못 적었으면 이만큼 뒤 다시 — 실패할 때마다 두 배
  saveRetryMaxMs: 600000,
  /* 판을 치르는 사람은 다시 줄에 못 선다. 판 DO 가 끝(저장)이나 무름을 로비에 알리면 풀리고, 알림을 잃었을
     때를 대비해 붙을 시간 + 카운트다운 + 제한 시간 + 재접속 유예 + busyGraceMs 가 지나면 저절로 풀린다 */
  busyGraceMs: 60000,
};
/* 카운트다운 중 이탈(판 무르기)이 24시간에 이만큼이면 줄에 서기 전 2분을 기다린다 */
export const ABORT_PENALTY = { count: 3, windowMs: 864e5, waitMs: 120000 };

/* 봇 — 사람처럼 치는 가상 클라이언트(compete-bot.mjs). 판 DO 안에서 사람과 같은 입력 길로 들어간다 */
export const BOT = {
  /* 레이팅 → 목표 CPM(선형 보간, 양 끝은 고정). 목표는 '판에서 실제로 재는 CPM' 이다 — 키 간격은 시작 지연·
     망설임·오타에 드는 시간을 빼고 남은 만큼으로 잡는다. mobile 은 pc 표 × mobileScale 로 시작하고,
     보정 루프(calibrate · regress)가 실제 판으로 고친다 */
  cpm: [[1000, 150], [1500, 300], [2000, 500], [2500, 700]],
  mobileScale: .55,
  cv: .35,                       // 키 간격 로그정규분포의 변동계수
  minGapMs: 25,                  // 키 간격 평균의 바닥(아주 빠른 목표에서)
  alternate: .9, sameHand: 1.1,  // 두벌식 손 교대(자음 왼손 ↔ 모음 오른손) / 같은 손 연속
  startDelay: [600, 250],        // 항목 시작 지연(신호 읽기) — 레이팅 1000 → 2500 사이를 보간
  startJitter: 50,
  /* 판마다 컨디션 ~ N(1, sd). 0.07 이면 봇끼리 승패가 레이팅을 너무 그대로 따른다(50점 차 69%, Elo 57%).
     차이 구간마다 1000판씩 재(2026-10-04) 0.18 은 최악 7.9%p 로 ±8%p 에 걸치고, 0.24 가 최악 3.0%p 다.
     node relay/test.mjs --sim 이 ±8%p 를 지킨다 */
  condition: { sd: .24, clamp: [.5, 1.5] },
  hesitate: { p: .5, ms: [80, 200] },        // 드문 음절(겹모음·겹받침·쌍받침) 앞에서 망설임
  long: { at: 12, ms: 25 },                  // 이름 타수가 at 을 넘으면 넘는 타마다 ms 를 시작 지연에 더한다
  typo: { base: .06, slope: .00003, min: .005, max: .08,   // 키당 오타 p = clamp(base − (R−1000)·slope, min, max)
          wrong: [1, 3], notice: [150, 400], back: .6 },     // 틀린 키 수 · 알아채는 지연 · 백스페이스 간격 배율
  wrongSubmit: { p: .01, notice: [300, 600] },  // 항목당 — 끝 음절을 빼먹고 확정했다가 고친다
  rating: 1500, ratingJitter: 50,  // Phase 4 전까지의 봇 레이팅(그 뒤로는 상대 r ±50)
  name: 'Bot',
  /* 보정 루프: 레이팅 구간별 사람 대 봇 승률이 target 밖이면 그 구간 CPM 을 step 만큼 고친다.
     구간 판이 minGames 보다 적으면 건드리지 않는다. 판이 regressGames 를 넘으면 회귀로 표를 다시 잡는다 */
  calib: { target: [.48, .52], step: .03, minGames: 30, band: 250, regressGames: 500, days: 14,
           /* 보정은 점마다 배율로 따로 쌓는다(bot_calib.mult). 쓰는 표 = 기본 표(회귀 또는 BOT.cpm) × 배율, 배율은 이 안에 묶는다 */
           mult: [.8, 1.2] },
};

/* 레이팅 — Glicko-2(glicko.mjs). 한 판 = 한 레이팅 기간. 쉰 기간(periodDays)마다 RD 가 표준식대로 자란다.
   표시 레이팅 = r − 2·RD(신규의 거품을 누른다). 배치 placement 판 전에는 티어를 숨긴다.
   봇 판은 봇을 RD botRd 로 보고 계산한 뒤 변화량의 botFactor 만 반영한다.
   시즌을 넘길 때: 'soft' 면 r' = 1500 + (r − 1500)·pull, RD' = min(RD + rdAdd, rd0). 'full' 이면 초기값 */
export const RATING = {
  mu0: 1500, rd0: 350, sigma0: .06, tau: .5,
  periodDays: 1,
  placement: 5,
  botRd: 50, botFactor: .5,
  soft: { pull: .5, rdAdd: 100 },
};
/* 티어 — 행정구역 위계, 각 세 단계(III → I). 표시 레이팅 from 에서 step 마다 한 단계, 끝은 고정 */
export const TIERS = {
  names: ['리', '읍', '동', '구', '시', '특별시'], steps: ['III', 'II', 'I'],
  from: 600, step: 100,
};
/* 매칭 — r 기준(표시 레이팅이 아니다). 허용폭은 기다린 만큼 넓어지고, 둘 다의 폭 안이어야 짝이다.
   botOfferMs 동안 짝이 없으면 봇을 권한다(autoBot 이면 바로 붙인다). 봇 레이팅 = r ±botSpread */
export const MATCH = {
  window: 75, widenEvery: 5000, widenBy: 25, windowMax: 400,
  botOfferMs: 25000, autoBot: false, botSpread: 50,
  sweepMs: 1000,   // 줄이 있는 동안 로비가 짝을 다시 찾는 박자
};
/* 부정 확정 시 상대에게 승리를 소급 반영(Phase 5 의 검토가 부른다). 확정 시점에 한 번, 부정행위자의 그 판
   직전 레이팅(mu·rd_before)을 상대로 이긴 것으로 갱신한다. 시즌당 사람마다 perSeason 번, 같은 두 계정 사이 perPair 번.
   확정 시점이 그 판의 시즌과 다르면 하지 않는다 */
export const RETRO = { enabled: true, perSeason: 3, perPair: 1 };

/* 부정 의심 — 판을 무르지 않는다. 플래그된 쪽은 레이팅 미반영 + 검토 큐, 상대는 무효(변화 0).
   판정 때(확정 키 수 · 붙여넣기)와 판이 끝날 때(audit) 본다. 키 간격은 브라우저 시계(dt)라 항목 안에서만 쓴다.
   clock: 한 항목의 dt 합이 서버가 본 그 항목 시간 + slackMs + rttMs 를 넘으면 그 항목의 dt 는 꾸민 것으로 보고
          간격 통계에서 뺀다. 그런 항목이 items 개 이상이면 플래그. 서버는 RTT 를 못 재서 rttMs 는 넉넉한 천장이다.
   device: 키에 code 가 실린 비율 — pc 판인데 minCode 보다 적거나 mobile 판인데 maxCode 보다 많으면 위장.
   fastRun 0 은 끈다 — 폰은 입력 하나가 여러 키로 풀려 dt 0 이 줄줄이 와도 정상이다 */
export const AUDIT = {
  clock: { slackMs: 300, rttMs: 500, items: 3 },
  pc:     { cpmMax: 1200, sustainMs: 10000, fastMs: 15, fastRun: 5, cvMin: .1, cvKeys: 40, minCode: .5, maxCode: 1, deviceKeys: 20 },
  mobile: { cpmMax: 900,  sustainMs: 10000, fastMs: 15, fastRun: 0, cvMin: .1, cvKeys: 40, minCode: 0, maxCode: .5, deviceKeys: 20 },
};
/* 키 기록 보존: 플래그 없는 판은 logDays, 검토가 끝난 플래그 판은 검토 뒤 reviewedDays. 검토 전에는 지우지 않는다 */
export const KEEP = { logDays: 30, reviewedDays: 90 };
