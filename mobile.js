/* 폰·태블릿(pointer:coarse)은 데스크톱 안내(/desktop/)로 넘긴다 — 타자연습은 실제 자판에서 친다.
   head 맨 위에서 동기로 돌아 앱이 그려지기 전에 비킨다. replace 라 뒤로 가기가 되돌아오지 않는다 */
if (matchMedia('(pointer:coarse)').matches) location.replace('/desktop/');
