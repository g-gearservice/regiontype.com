/* 이 워커가 받는 경로는 entry.mjs 의 OWN.auth */
import { only } from './entry.mjs';
export default only('auth');
