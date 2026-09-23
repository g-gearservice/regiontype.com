/* 카메라로 캐릭터가 사람 표정을 따라 하게 만든다. 계정 화면에서 단추를 눌렀을 때만
   불린다 — 이 파일도, 모델도, 아래 CDN 의 wasm 도 그 전에는 한 바이트도 받지 않는다.

   영상은 기기 밖으로 나가지 않는다. 판정은 전부 이 브라우저 안(WebAssembly)에서 돌고,
   프레임을 어디로도 올리지 않으며 남기지도 않는다. 끄면 카메라 트랙을 바로 멈춘다 —
   탭이 살아 있는 동안 불이 켜져 있지 않게.

   저장소 규칙("새로 들이지 않는다")을 처음으로 어기는 자리다. 브라우저에는 표정을 읽는
   기능이 없어 모델이 있어야 하고, 모델을 돌릴 것은 우리가 쓸 수 없다. 그래서:
     · 판정기(tasks-vision)는 버전을 못 박아 CDN 에서 받는다 — wasm 이 11MB 라 저장소에
       두면 받지도 않을 사람까지 무겁게 한다
     · 모델(.task, 3.6MB)은 저장소에 둔다 — 남이 언제든 갈 수 있는 값이라 우리가 쥔다
   ponytail: CDN 이 죽으면 이 기능만 안 켜진다. 나머지 화면은 이 파일을 부르지 않는다. */
const LIB = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';

/* MediaPipe 가 내주는 얼굴 근육 값(0~1) 을 엔진 표정으로 옮기는 표.
   위에서부터 먼저 맞는 것을 쓴다 — 놀란 얼굴은 입도 벌어지므로 순서가 곧 우선순위다.
   문턱은 카메라 앞에서 맞춰 본 값이다: 낮추면 표정이 쉴 새 없이 튀고, 높이면 안 바뀐다.
   ponytail: 사람마다 평소 얼굴이 달라 한 벌의 문턱은 누구에게도 딱 맞진 않는다.
   맞춰 쓸 손잡이가 필요해지면 이 문턱을 설정으로 빼면 된다. */
const FACES = [
  ['hilare',    b => b.mouthSmile > .55 && b.jawOpen > .3],
  ['surpris',   b => b.jawOpen > .42 && b.eyeWide > .28],
  ['heureux',   b => b.mouthSmile > .34],
  ['colere',    b => b.browDown > .5 && b.mouthFrown > .12],
  ['triste',    b => b.mouthFrown > .28],
  ['excite',    b => b.browUp > .55 && b.jawOpen > .22],
  ['surpris',   b => b.browUp > .62],
  ['mefiant',   b => b.eyeSquint > .45],
  ['somnolent', b => b.eyeBlink > .62],
  ['curieux',   b => b.browUp > .3],
];
/* 표정이 한 프레임씩 튀지 않게 — 새 표정이 이만큼 이어져야 바꾼다(초).
   짧을수록 반응이 날래고 길수록 진득하다. 따라쟁이는 날랜 쪽이 재미있다 */
const HOLD = 0.1;
/* 고갯짓을 얼마나 부풀릴지. 사람은 고개를 조금만 움직이는데 그대로 옮기면
   캐릭터는 거의 가만히 있는 것처럼 보인다 — 과감하게 넘긴다 */
const SWING = 4.2;

const avg = (a, b) => (a + b) / 2;
const pick = (list, name) => list.find(c => c.categoryName === name)?.score ?? 0;

/* 52개 중 쓰는 것만 추려 좌우를 평균한다 — 한쪽 눈만 찡긋한 것을 표정으로 읽지 않는다 */
export function muscles(list) {
  return {
    jawOpen:    pick(list, 'jawOpen'),
    mouthSmile: avg(pick(list, 'mouthSmileLeft'), pick(list, 'mouthSmileRight')),
    mouthFrown: avg(pick(list, 'mouthFrownLeft'), pick(list, 'mouthFrownRight')),
    browDown:   avg(pick(list, 'browDownLeft'), pick(list, 'browDownRight')),
    browUp:     Math.max(pick(list, 'browInnerUp'),
                         avg(pick(list, 'browOuterUpLeft'), pick(list, 'browOuterUpRight'))),
    eyeWide:    avg(pick(list, 'eyeWideLeft'), pick(list, 'eyeWideRight')),
    eyeSquint:  avg(pick(list, 'eyeSquintLeft'), pick(list, 'eyeSquintRight')),
    eyeBlink:   avg(pick(list, 'eyeBlinkLeft'), pick(list, 'eyeBlinkRight')),
    cheekPuff:  pick(list, 'cheekPuff'),
  };
}

/* 근육값 한 벌을 표정 하나로 접는다. 카메라도 DOM 도 안 타는 순수 함수라
   여기만 따로 검사한다(relay/test.mjs 의 '표정' 절). */
export const faceFrom = list => {
  const b = muscles(list);
  return FACES.find(([, test]) => test(b))?.[0] ?? 'neutre';
};

/* 카메라를 켜고 얼굴을 읽어 넘긴다.
   onFace({ expression, look:[x,y] }) 가 프레임마다 불리고, stop() 이 전부 되돌린다.
   base 는 이 파일이 놓인 곳(모델을 그 옆에서 찾는다).

   안 되면 치운 뒤 그대로 던진다 — 실패했는데도 손잡이를 돌려주면 부르는 쪽이
   켜진 줄 알고 '카메라 끄기'를 걸어 둔다(실제로 그렇게 틀렸던 자리다). */
export async function startMimic({ base, onFace }) {
  let stream = null, landmarker = null, video = null, raf = 0, dead = false;

  const stop = () => {
    dead = true;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t => t.stop());
    /* 재생을 끊고 프레임 참조도 버린다 — 멈춘 그림이 메모리에 남을 이유가 없다 */
    if (video) { video.pause(); video.srcObject = null; video.remove(); video = null; }
    landmarker?.close();
    landmarker = null; stream = null;
  };

  try {
    /* 카메라를 먼저 묻는다. 거절하면 무거운 것을 받을 이유가 없다 */
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 320, height: 240 }, audio: false,
    });
    if (dead) { stop(); throw new Error('cancelled'); }

    const { FilesetResolver, FaceLandmarker } = await import(`${LIB}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${LIB}/wasm`);
    landmarker = await FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: new URL('face_landmarker.task', base).href, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
    if (dead) { stop(); throw new Error('cancelled'); }

    video = document.createElement('video');
    video.playsInline = true; video.muted = true;
    video.srcObject = stream;
    await video.play();

    let face = 'neutre', want = face, since = 0, last = -1;
    const tick = now => {
      raf = requestAnimationFrame(tick);
      if (dead || video.readyState < 2) return;
      /* 같은 프레임을 두 번 넣으면 detectForVideo 가 시각이 안 늘었다고 거른다 */
      const ms = Math.max(now, last + 1); last = ms;
      let out;
      try { out = landmarker.detectForVideo(video, ms); } catch { return; }
      const marks = out.faceLandmarks?.[0];
      if (!marks) return;

      const next = faceFrom(out.faceBlendshapes?.[0]?.categories || []);
      if (next !== want) { want = next; since = now; }
      if (want !== face && now - since > HOLD * 1000) face = want;

      /* 고개 방향은 코끝(1번 점)이 화면 어디에 있는지로 본다. 셀카는 좌우가 뒤집혀
         보이므로 x 를 뒤집어야 내가 오른쪽을 보면 캐릭터도 오른쪽을 본다.
         한가운데(.5)에서 얼마나 벗어났는지를 -1..1 로 펴고 SWING 배로 부풀린다. */
      const nose = marks[1];
      const span = v => Math.max(-1, Math.min(1, (v - .5) * SWING));
      /* 고개 기울기(roll)는 두 눈 바깥 끝을 잇는 선의 각도다. 이것 하나로 따라쟁이가
         확 산다 — 고개를 갸웃하면 캐릭터도 같이 갸웃한다 */
      const [lo, ro] = [marks[33], marks[263]];
      const roll = Math.max(-32, Math.min(32,
        -Math.atan2(ro.y - lo.y, ro.x - lo.x) * 180 / Math.PI * 1.6));
      /* 볼을 부풀리면 몸도 부푼다 — 과장은 부르는 쪽이 한다 */
      const puff = Math.max(0, Math.min(1, muscles(out.faceBlendshapes?.[0]?.categories || []).cheekPuff * 1.2));
      onFace({ expression: face, look: [-span(nose.x), span(nose.y)], roll, puff });
    };
    raf = requestAnimationFrame(tick);
  } catch (err) {
    stop();
    throw err;
  }
  return { stop };
}
