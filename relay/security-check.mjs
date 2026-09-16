#!/usr/bin/env node
/* 보안 룰 검사. 표는 relay/security-rules.mjs 에 있고, 여기서는 값만 떠 와 판정에 넘긴다.
 *
 *   node relay/security-check.mjs           라이브 + 저장소 전부
 *   node relay/security-check.mjs --offline 저장소 룰만 (네트워크 없이)
 *   node relay/security-check.mjs --json    한 줄 JSON — 사람이 아니라 기계가 읽는다
 *   node relay/security-check.mjs --facts f.json   밖에서 떠 온 값을 얹는다
 *
 * --facts 는 여기서 부를 수 없는 자리를 위한 문이다. Cloudflare MCP 를 부를 수 있는
 * 쪽(스케줄 세션)이 workers_list 를 떠서 {"cf:workers":["…"]} 로 넘기면, 판정은 그래도
 * 저장소 안의 룰 표가 한다 — 무엇이 정상인지가 대화가 아니라 파일에 적혀 있게.
 *
 * 나가는 요청은 GET 과 OPTIONS 뿐이다. 아무것도 쓰지 않고, 토큰도 쓰지 않는다.
 * 고치지도 않는다 — 어긋난 자리를 세어 보여주고 끝난다. 존 설정을 되돌리는 건
 * relay/harden-zone.mjs --apply 이고, 그건 사람이 부른다.
 *
 * 나가는 값: high 룰이 하나라도 깨지면 1, 아니면 0. 뜨지 못한 값은 통과가 아니라 skip 이다.
 */
import { readFileSync } from 'node:fs';
import { PROBES, RULES, check, tally } from './security-rules.mjs';

const OFFLINE = process.argv.includes('--offline');
const JSON_OUT = process.argv.includes('--json');
const root = new URL('../', import.meta.url);

/* 저장소 파일. 'file:relay' 는 relay 소스를 한 덩어리로 본다 — 비밀이 어느 파일에
   박혀도 걸리게. 읽지 못한 파일은 fact 를 만들지 않아 룰이 skip 으로 남는다. */
const RELAY_SRC = ['relay/worker.mjs', 'relay/auth.mjs', 'relay/wrangler.toml'];
const read = p => { try { return readFileSync(new URL(p, root), 'utf8'); } catch { return undefined; } };

const facts = {};
for (const rule of RULES) {
  if (!rule.need.startsWith('file:') || rule.need in facts) continue;
  const path = rule.need.slice(5);
  const text = path === 'relay' ? RELAY_SRC.map(read).filter(Boolean).join('\n') : read(path);
  if (text) facts[rule.need] = text;
}

/* 우리가 보는 호스트는 전부 Cloudflare 뒤에 있다. cf-ray 도 server: cloudflare 도 없으면
   그 응답은 원본이 아니라 중간에서 가로챈 것이다 — 사내 프록시나 캡티브 포털이 내놓는
   403 을 '헤더가 다 사라졌다' 로 읽으면 없는 사고를 열여덟 줄로 지어내게 된다.
   못 닿은 건 실패가 아니라 못 본 것이다. */
const reached = p => !!p.headers['cf-ray'] || /cloudflare/i.test(p.headers.server ?? '');

/* 라이브 값. 한 자리가 넘어져도 나머지는 계속 뜬다 — 그 자리만 skip 으로 남는다. */
if (!OFFLINE) {
  const probes = await Promise.all(Object.entries(PROBES).map(async ([key, p]) => {
    try {
      const r = await fetch(p.url, {
        method: p.method ?? 'GET',
        headers: p.headers,
        redirect: p.redirect ?? 'follow',
        signal: AbortSignal.timeout(15000),
      });
      const headers = Object.fromEntries([...r.headers].map(([k, v]) => [k.toLowerCase(), v]));
      return [key, { status: r.status, url: p.url, headers }];
    } catch (e) {
      return [key, { error: e.message, url: p.url }];
    }
  }));
  for (const [key, got] of probes) {
    if (got.error) console.error(`  ! ${key} (${got.url}) 를 뜨지 못했다: ${got.error}`);
    else if (!reached(got)) console.error(
      `  ! ${key} (${got.url}) 는 Cloudflare 가 답한 게 아니다 (${got.status}) — 중간에서 가로챘다`);
    else facts[`probe:${key}`] = got;
  }
}

/* 밖에서 떠 온 값. 룰이 모르는 열쇠는 그냥 남고, 아무도 안 보면 그만이다. */
const factsArg = process.argv[process.argv.indexOf('--facts') + 1];
if (process.argv.includes('--facts')) {
  try { Object.assign(facts, JSON.parse(readFileSync(factsArg, 'utf8'))); }
  catch (e) { console.error(`  ! --facts ${factsArg} 를 읽지 못했다: ${e.message}`); }
}

const res = check(facts);
const sum = tally(res);

if (JSON_OUT) {
  console.log(JSON.stringify({ at: new Date().toISOString(), offline: OFFLINE, ...sum, rules: res }));
  process.exit(sum.high ? 1 : 0);
}

const MARK = { pass: '✓', fail: '✗', skip: '·' };
for (const r of res) {
  const head = `  ${MARK[r.state]} ${r.id.padEnd(18)} ${r.sev.padEnd(4)}`;
  console.log(r.state === 'pass' ? `${head} ${r.want}` : `${head} ${r.why}`);
}
console.log(`\n${sum.pass} 통과 · ${sum.fail} 실패(high ${sum.high}) · ${sum.skip} 못 봄`);
if (sum.skip) console.log('못 본 자리는 통과가 아니다 — 값을 못 떠 왔을 뿐이다.');
process.exit(sum.high ? 1 : 0);
