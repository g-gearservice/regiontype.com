/* 복구 메일 워커. 공개 라우트는 없다 — relay 의 MAIL 서비스 바인딩만 이 fetch 를 부른다.
   보내는 일은 Cloudflare Email Service(유료)의 send_email 바인딩이다.
   주소는 regiontype.com 에 온보딩된 도메인이어야 한다. */
import { handle } from './mail.mjs';

export default {
  fetch(req, env) {
    return handle(req, env);
  },
};
