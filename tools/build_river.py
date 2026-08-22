"""한강 = 북안 자치구와 남안 자치구가 공유하는 경계선.

이 데이터의 자치구 경계는 강 수면 한가운데를 지나므로 폴리곤 사이에 빈틈이
없다. 대신 북안 집합과 남안 집합이 맞닿은 변만 골라내면 그것이 강 중심선이다.
"""
import json, sys

NORTH = {'종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구',
         '강북구','도봉구','노원구','은평구','서대문구','마포구'}

src, dst = sys.argv[1], sys.argv[2]
g = json.load(open(src))

def pts(d):
    n = d.replace('M',' ').replace('Z',' ').replace('L',' ').split()
    return [(float(n[i]), float(n[i+1])) for i in range(0, len(n)-1, 2)]

def seg_set(names):
    s = set()
    for it in g['items']:
        if it['name'] not in names: continue
        p = pts(it['d'])
        for a, b in zip(p, p[1:] + p[:1]):
            s.add((a, b) if a <= b else (b, a))     # 방향 무시
    return s

north = seg_set(NORTH)
south = seg_set({it['name'] for it in g['items']} - NORTH)
shared = north & south
print(f'맞닿은 변 {len(shared)}개')

# 변들을 끝점으로 이어 하나의 선으로 만든다
adj = {}
for a, b in shared:
    adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
ends = [p for p, n in adj.items() if len(n) == 1]
start = min(ends or adj, key=lambda p: p[0])        # 가장 서쪽에서 출발
line, seen, cur = [start], {start}, start
while True:
    nxt = [q for q in adj[cur] if q not in seen]
    if not nxt: break
    cur = min(nxt, key=lambda q: q[0])              # 동쪽으로 진행
    line.append(cur); seen.add(cur)

g['river'] = 'M' + 'L'.join(f'{round(x,1)} {round(y,1)}' for x, y in line)
json.dump(g, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'중심선 {len(line)}점, x {line[0][0]:.0f} → {line[-1][0]:.0f}, '
      f'끝점 {len(ends)}개')
