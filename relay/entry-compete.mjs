/* 이 워커가 받는 경로는 entry.mjs 의 OWN.compete. Durable Object 클래스도 이 문에서 내보낸다.
   cron(wrangler.compete.toml 의 triggers)은 하루 한 번 daily — 키 기록 보존 기한 삭제 · 봇 CPM 표 보정 */
import { only } from './entry.mjs';
import { daily } from './compete-do.mjs';
const door = only('compete');
export default { fetch: door.fetch, scheduled: (ev, env, ctx) => ctx.waitUntil(daily(env)) };
export { CompeteLobby, CompeteMatch } from './compete-do.mjs';
