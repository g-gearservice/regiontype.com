/* 복구 문자 워커. 공개 라우트는 없다 — relay 의 SMS 서비스 바인딩만 이 fetch 를 부른다.
   실제 발송은 공급자 HTTP API 로만 나간다. */
import { handle } from './sms.mjs';

export default {
  fetch(req, env) {
    return handle(req, env);
  },
};
