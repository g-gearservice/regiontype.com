/* 로컬 개발용 문 — 경로를 가르지 않고 worker.mjs 전부와 경쟁전 DO 를 연다(wrangler.dev.toml ·
   .claude/launch.json 의 relay-dev). worker.mjs 를 main 으로 바로 쓰면 workerd 가 이름 붙은 export(상수)를
   진입점으로 읽다 멈춘다. 배포하지 않는다 */
export { default } from './worker.mjs';
export { CompeteLobby, CompeteMatch } from './compete-do.mjs';
