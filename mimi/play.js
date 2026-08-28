/* Mimi 타자 엔진 — 코스 JSON을 읽어 한 판을 굴린다.
   화면은 건드리지 않는다. 씬이 상태를 읽어 그린다. */

const cache = new Map();

/* 코스와 지형은 부모 사이트가 이미 만들어 둔 data/*.json 을 그대로 읽는다.
   지도 데이터는 디자인이 아니라 사실이라 다시 만들 이유가 없다. */
function grab(url) {
  if (!cache.has(url)) {
    /* fetch 는 404 에 reject 하지 않는다. ok 를 직접 본다.
       실패한 약속을 캐시에 남기면 잠깐 끊긴 네트워크가 영구 장애가 된다. */
    cache.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }).catch(err => { cache.delete(url); throw err }));
  }
  return cache.get(url);
}

const asset = (slug, kind) => `../data/${slug}.${kind}.json`;

/* 썸네일은 지형만 쓴다. 코스까지 끌어오면 카드 수만큼 요청이 두 배가 된다. */
export const loadGeom = slug => grab(asset(slug, 'geom'));

export const load = slug =>
  Promise.all([grab(asset(slug, 'course')), grab(asset(slug, 'geom'))])
    .then(([course, geom]) => ({ course, geom }));

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

/* 조합 중인 글자를 오타로 세지 않으려면 초성까지 봐야 한다.
   '화고'는 '화곡'의 오타가 아니라 아직 안 끝난 입력이다. */
function cho(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 0xAC00 && c <= 0xD7A3) return CHO[Math.floor((c - 0xAC00) / 588)];
  if (c >= 0x3131 && c <= 0x314E) return ch;
  return null;
}

export function initials(name) {
  return [...name].map(ch => cho(ch) || ch).join(' ');
}

function onTrack(target, value) {
  if (target.startsWith(value)) return true;
  if (!value) return true;
  const head = value.slice(0, -1);
  if (!target.startsWith(head) || head.length >= target.length) return false;
  const a = cho(value[value.length - 1]);
  return !!a && a === cho(target[head.length]);
}

const clock = ms => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const store = { run: null };

export function createRun({ course, geom }, mode) {
  const names = course.items.map(it => it.name);

  const run = {
    slug: course.slug,
    title: course.title,
    mode,
    names,
    geom,
    i: 0,
    typed: '',
    bad: false,
    hint: '',
    hits: 0,
    misses: 0,
    itemHits: 0,
    itemMisses: 0,
    t0: 0,
    tItem: 0,
    endedAt: 0,
    rows: [],

    get target() { return names[run.i] },
    get prev() { return names[run.i - 1] || '' },
    get next() { return names[run.i + 1] || '' },
    get over() { return run.i >= names.length },
    get elapsed() { return (run.endedAt || Date.now()) - run.t0 },
    get clock() { return clock(run.elapsed) },

    mark(name) {
      const at = names.indexOf(name);
      if (at < 0) return 'wait';
      return at < run.i ? 'done' : at === run.i ? 'now' : 'wait';
    },

    start() {
      run.t0 = run.tItem = Date.now();
    },

    /* 입력 한 번. 화면이 다시 그려야 하면 true. */
    feed(value) {
      if (run.over) return false;
      const target = run.target;
      if (value === target) { run.commit(true); return true }
      if (onTrack(target, value)) {
        run.typed = value;
        run.bad = false;
        run.hint = '';
      } else {
        run.misses++;
        run.itemMisses++;
        run.typed = value;
        run.bad = true;
        if (mode === 'learning') run.hint = initials(target);
        /* QUIZ는 오답 1회로 그 구간이 끝난다 (design.pen 05). */
        if (mode === 'quiz') run.commit(false);
      }
      return true;
    },

    /* PRACTICE는 오답 통과를 허용한다 (design.pen 05). */
    skip() {
      if (run.over || mode !== 'practice') return false;
      run.commit(false);
      return true;
    },

    commit(clean) {
      const now = Date.now();
      /* 타수는 실제로 쳐야 했던 글자 수로 센다. IME 조합 단계에 안 흔들린다. */
      const chars = run.target.length;
      run.hits += chars;
      run.itemHits += chars;
      const tries = run.itemHits + run.itemMisses;
      run.rows.push({
        name: run.target,
        time: clock(now - run.tItem),
        acc: tries ? Math.round((run.itemHits / tries) * 100) : 100,
        miss: !clean || run.itemMisses > 0
      });
      run.i++;
      run.typed = '';
      run.bad = false;
      run.hint = '';
      run.itemHits = run.itemMisses = 0;
      run.tItem = now;
      if (run.over) {
        run.endedAt = now;
        /* PRACTICE는 기록을 남기지 않는다 (design.pen 05). */
        if (mode !== 'practice') store.run = run;
      }
    },

    summary() {
      const tries = run.hits + run.misses;
      const min = run.elapsed / 60000;
      return {
        title: run.title,
        meta: `${mode.toUpperCase()} · ${course.mode === 'sequence' ? '순서형' : '자유형'} · ${new Date(run.endedAt).toLocaleDateString('ko-KR').replace(/\.$/, '')}`,
        ribbon: `완주 ${run.rows.length} / ${names.length}`,
        link: `regiontype.kr/c/${course.slug}`,
        stats: [
          { value: clock(run.elapsed), label: '소요 시간' },
          { value: tries ? Math.round((run.hits / tries) * 100) : 100, unit: '%', label: '정확도', flare: true },
          { value: min ? Math.round(run.hits / min) : 0, unit: '타/분', label: '입력 속도' },
          { value: run.rows.filter(r => !r.miss).length, unit: '곳', label: '무결점' }
        ],
        rows: run.rows.map(r => ({ ...r, acc: `${r.acc}%` }))
      };
    }
  };
  return run;
}
