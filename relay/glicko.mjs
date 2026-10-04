/* Glicko-2 (Glickman, "Example of the Glicko-2 system", 2013). 순수 함수만 — 저장·시즌은 compete-do.mjs.
   레이팅 { r, rd, sigma } 는 Glicko 척도(1500 · 350)로 주고받고, 계산은 Glicko-2 척도(μ · φ)에서 한다. */
import { RATING, TIERS } from './compete-config.mjs';

const K = 173.7178, EPS = 1e-6;
const g = phi => 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
const E = (mu, muj, phij) => 1 / (1 + Math.exp(-g(phij) * (mu - muj)));

export const fresh = () => ({ r: RATING.mu0, rd: RATING.rd0, sigma: RATING.sigma0 });

/** 한 레이팅 기간의 결과로 새 레이팅. results = [{ r, rd, s }] (s: 1 이김 · .5 비김 · 0 짐).
 *  결과가 없으면 RD 만 자란다(쉰 기간) */
export function rate(p, results, tau = RATING.tau) {
  const mu = (p.r - 1500) / K, phi = p.rd / K, sigma = p.sigma;
  if (!results.length) return { ...p, rd: Math.min(RATING.rd0, Math.sqrt(phi * phi + sigma * sigma) * K) };
  const opp = results.map(o => ({ mu: (o.r - 1500) / K, phi: o.rd / K, s: o.s }));
  const v = 1 / opp.reduce((a, o) => { const e = E(mu, o.mu, o.phi); return a + g(o.phi) ** 2 * e * (1 - e); }, 0);
  const sum = opp.reduce((a, o) => a + g(o.phi) * (o.s - E(mu, o.mu, o.phi)), 0);
  const delta = v * sum;
  /* 변동성 σ' — Illinois 알고리즘(논문 5.1) */
  const a = Math.log(sigma * sigma);
  const f = x => {
    const ex = Math.exp(x);
    return ex * (delta * delta - phi * phi - v - ex) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (tau * tau);
  };
  let A = a, B;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else { let k = 1; while (f(a - k * tau) < 0) k++; B = a - k * tau; }
  let fA = f(A), fB = f(B);
  while (Math.abs(B - A) > EPS) {
    const C = A + (A - B) * fA / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const sigma2 = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + sigma2 * sigma2);
  const phi2 = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const mu2 = mu + phi2 * phi2 * sum;
  return { r: mu2 * K + 1500, rd: phi2 * K, sigma: sigma2 };
}

/** 쉰 기간 n 번 — RD 가 표준식대로 자란다(rd0 에서 멈춘다) */
export function idle(p, n) {
  let q = p;
  for (let k = 0; k < n && q.rd < RATING.rd0; k++) q = rate(q, []);
  return q;
}

/** 봇 판은 변화량의 일부만(r · rd · σ 모두) */
export const blend = (before, after, f) => ({
  r: before.r + (after.r - before.r) * f, rd: before.rd + (after.rd - before.rd) * f, sigma: before.sigma + (after.sigma - before.sigma) * f });

/** 시즌 넘김. 'full' 은 초기값, 'soft' 는 1500 쪽으로 반 당기고 RD 를 늘린다 */
export const reset = (p, kind) => kind === 'soft'
  ? { r: 1500 + (p.r - 1500) * RATING.soft.pull, rd: Math.min(p.rd + RATING.soft.rdAdd, RATING.rd0), sigma: p.sigma }
  : fresh();

/** 표시 레이팅(보수적 값) */
export const display = p => Math.round(p.r - 2 * p.rd);

/** 티어 — 배치가 끝나기 전에는 null. { index, name: '동 II' } */
export function tier(p, games) {
  if (games < RATING.placement) return null;
  const n = TIERS.names.length * TIERS.steps.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor((display(p) - TIERS.from) / TIERS.step)));
  return { index: i, name: `${TIERS.names[Math.floor(i / TIERS.steps.length)]} ${TIERS.steps[i % TIERS.steps.length]}` };
}
