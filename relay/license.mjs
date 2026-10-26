/* ── 라이선스 시험 판정 ──
   모든 등급 공통 조건: 120초 안에 완주 (done: true). 완주하지 못하면 등급 없음 (null).
   A부터 F까지 위에서부터 순서대로 조건을 견주어 첫 번째로 부합하는 등급을 부여한다.
   E·D의 오타 허용 기준은 F의 10회 이하를 물려받는다. */
export const EXAM_GRADES = [
  { g: 'A', acc: 98, cpm: 600, miss: 1 },
  { g: 'B', acc: 95, cpm: 500, miss: 3 },
  { g: 'C', acc: 93, cpm: 400, miss: 5 },
  { g: 'D', acc: 90, cpm: 300, miss: 10 },
  { g: 'E', acc: 85, cpm: 200, miss: 10 },
  { g: 'F', acc: 80, cpm: 0, miss: 10 },
];

export const GRADE_WEIGHT = { A: 6, B: 5, C: 4, D: 3, E: 2, F: 1 };

export function gradeOf({ done, acc, cpm, misses }) {
  if (!done) return null;
  for (const r of EXAM_GRADES) {
    if (acc >= r.acc && cpm >= r.cpm && misses <= r.miss) return r.g;
  }
  return null;
}

export function nextConditionOf({ done, acc, cpm, misses, grade }) {
  if (!done) return { kind: 'done' };
  if (!grade) {
    if (misses > 10) return { g: 'F', kind: 'miss', need: 10 };
    return { g: 'F', kind: 'acc', need: 80 };
  }
  const order = ['F', 'E', 'D', 'C', 'B', 'A'];
  const idx = order.indexOf(grade);
  if (idx < 0 || idx >= order.length - 1) return { kind: 'max' };
  const next = order[idx + 1];
  const req = EXAM_GRADES.find(x => x.g === next);
  if (!req) return { kind: 'max' };
  if (misses > req.miss) return { g: next, kind: 'miss', need: req.miss };
  if (cpm < req.cpm) return { g: next, kind: 'cpm', need: req.cpm };
  if (acc < req.acc) return { g: next, kind: 'acc', need: req.acc };
  return { kind: 'max' };
}
