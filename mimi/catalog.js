/* Mimi catalog — board-game records. Not the parent app's course JSON. */

export const modes = [
  {
    id: 'practice',
    kr: '연습',
    en: 'PRACTICE',
    paint: '#2F7DD1',
    desc: '지명이 지도 위에 그대로 보인다. 틀려도 멈추지 않고 계속 타이핑한다.',
    rules: ['지명 라벨 항상 표시', '오답 시 통과 허용', '기록 미저장']
  },
  {
    id: 'learning',
    kr: '학습',
    en: 'LEARNING',
    paint: '#4A3B31',
    desc: '순서대로 한 곳씩 제시된다. 틀리면 힌트가 나오고 다시 시도한다.',
    rules: ['이전·현재·다음 큐 표시', '오답 시 초성 힌트', '기록 저장']
  },
  {
    id: 'quiz',
    kr: '시험',
    en: 'QUIZ',
    paint: '#E8622B',
    desc: '지명은 숨겨지고 위치만 강조된다. 시간과 정확도가 모두 기록된다.',
    rules: ['지명 라벨 전부 숨김', '오답 1회 = 실패', '순위표 반영']
  }
];

export const ribbons = [
  '전체', '서울', '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
];

/* 코스 카드. 항목 수는 data/*.course.json 에서 뽑은 실제 값이다 —
   플레이 횟수처럼 지어낼 수 있는 숫자는 넣지 않는다. */
export const tiles = [
  { id: 'seoul-gu', region: '서울', count: 25, hard: 3, title: '서울 25개 자치구' },
  { id: 'gangseo-dong', region: '강서구', count: 20, hard: 3, title: '강서구 20개 행정동' },
  { id: 'dobong-dong', region: '도봉구', count: 14, hard: 1, title: '도봉구 14개 행정동' },
  { id: 'dongdaemun-dong', region: '동대문구', count: 14, hard: 1, title: '동대문구 14개 행정동' },
  { id: 'dongjak-dong', region: '동작구', count: 15, hard: 2, title: '동작구 15개 행정동' },
  { id: 'eunpyeong-dong', region: '은평구', count: 16, hard: 2, title: '은평구 16개 행정동' },
  { id: 'gangbuk-dong', region: '강북구', count: 13, hard: 1, title: '강북구 13개 행정동' },
  { id: 'gangdong-dong', region: '강동구', count: 18, hard: 2, title: '강동구 18개 행정동' },
  { id: 'gangnam-dong', region: '강남구', count: 22, hard: 3, title: '강남구 22개 행정동' },
  { id: 'geumcheon-dong', region: '금천구', count: 10, hard: 1, title: '금천구 10개 행정동' },
  { id: 'guro-dong', region: '구로구', count: 15, hard: 2, title: '구로구 15개 행정동' },
  { id: 'gwanak-dong', region: '관악구', count: 21, hard: 3, title: '관악구 21개 행정동' },
  { id: 'gwangjin-dong', region: '광진구', count: 15, hard: 2, title: '광진구 15개 행정동' },
  { id: 'jongno-dong', region: '종로구', count: 17, hard: 2, title: '종로구 17개 행정동' },
  { id: 'jung-dong', region: '중구', count: 15, hard: 2, title: '중구 15개 행정동' },
  { id: 'jungnang-dong', region: '중랑구', count: 16, hard: 2, title: '중랑구 16개 행정동' },
  { id: 'mapo-dong', region: '마포구', count: 16, hard: 2, title: '마포구 16개 행정동' },
  { id: 'nowon-dong', region: '노원구', count: 19, hard: 2, title: '노원구 19개 행정동' },
  { id: 'seocho-dong', region: '서초구', count: 18, hard: 2, title: '서초구 18개 행정동' },
  { id: 'seodaemun-dong', region: '서대문구', count: 14, hard: 1, title: '서대문구 14개 행정동' },
  { id: 'seongbuk-dong', region: '성북구', count: 20, hard: 3, title: '성북구 20개 행정동' },
  { id: 'seongdong-dong', region: '성동구', count: 17, hard: 2, title: '성동구 17개 행정동' },
  { id: 'songpa-dong', region: '송파구', count: 26, hard: 3, title: '송파구 26개 행정동' },
  { id: 'yangcheon-dong', region: '양천구', count: 18, hard: 2, title: '양천구 18개 행정동' },
  { id: 'yeongdeungpo-dong', region: '영등포구', count: 18, hard: 2, title: '영등포구 18개 행정동' },
  { id: 'yongsan-dong', region: '용산구', count: 16, hard: 2, title: '용산구 16개 행정동' }
];

export const sheet = {
  title: '강서구 20개 행정동',
  meta: 'LEARNING · 순서형 · 2026.08.25',
  ribbon: '완주 20 / 20',
  link: 'regiontype.kr/c/gangseo-dong',
  stats: [
    { value: '4:12', label: '소요 시간' },
    { value: '96', unit: '%', label: '정확도', flare: true },
    { value: '284', unit: '타/분', label: '입력 속도' },
    { value: '18', unit: '일', label: '연속 기록' }
  ],
  rows: [
    { name: '방화1동', time: '0:11', acc: '100%' },
    { name: '방화2동', time: '0:13', acc: '100%' },
    { name: '방화3동', time: '0:19', acc: '83%', miss: true },
    { name: '공항동', time: '0:09', acc: '100%' },
    { name: '가양1동', time: '0:12', acc: '100%' },
    { name: '가양2동', time: '0:14', acc: '100%' },
    { name: '가양3동', time: '0:22', acc: '75%', miss: true },
    { name: '발산1동', time: '0:10', acc: '100%' },
    { name: '화곡1동', time: '0:16', acc: '100%' },
    { name: '염창동', time: '0:12', acc: '100%' }
  ]
};

export const chips = {
  outer: [
    ['배경 외곽', '#F1E9DC'],
    ['지도 베이스', '#E2D8C6'],
    ['수계', '#8FD9C8'],
    ['녹지', '#BCCB90'],
    ['그리드', '#C97F6E'],
    ['스트라이프', '#E3B3A6'],
    ['그림자', '#8A7466'],
    ['포인트', '#E8622B']
  ],
  gangseo: [
    '#E2D8C6', '#BCCB90', '#9EC6DE', '#EFD79A',
    '#A9AEDA', '#E8A07A', '#A8BE7E', '#8FD9C8'
  ],
  jongno: [
    '#E9DCC0', '#7FC9BC', '#7E9464', '#D9B58A',
    '#E5C489', '#E0907F', '#B5654E', '#C1362B'
  ],
  safe: [
    '#E6DAC6', '#BEDCEC', '#7C93A6', '#F2DFB0', '#E2B85C',
    '#B9862A', '#8FA9BD', '#4E7999', '#D2601A'
  ],
  night: [
    '#241F1A', '#1E5B54', '#4A6B3F', '#7FB3A8', '#8496C0',
    '#C29A63', '#B87A6E', '#9AAE72', '#FF7A3D'
  ]
};

export const lifts = [
  { name: '중간', spec: '8 / 10 / blur 0', x: 8, y: 10 },
  { name: '강함', spec: '16 / 20 / blur 0', x: 16, y: 20 },
  { name: '매우 강함', spec: '28 / 34 / blur 0', x: 28, y: 34 }
];
