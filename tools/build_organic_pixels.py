"""행정경계 GeoJSON 또는 기존 격자 지형 → 유기적 픽셀(Organic Pixels) 격자 및 위상 생성기.
tools/build_pixels.py 의 계승편.

스캔라인으로 래스터화한 뒤, 2x2 꼭짓점 위상 분석을 통해 인접 셀 간의 매끄러운 결합(Adjacent Merge),
대각선 교차점의 필릿 브릿지(Diagonal Merge), 오목 모서리 라운딩(Inner Corner Fillets) 정보를
계산하여 유기적 반응형 비트맵을 생성한다.

    # 1. 기존 geom.json(예: 강서구)에서 유기적 픽셀 데이터 생성
    python3 tools/build_organic_pixels.py data/gangseo-dong.geom.json data/gangseo-organic.json

    # 2. GeoJSON(예: 대한민국, 일본)으로부터 스캔라인 래스터화 및 유기적 픽셀 생성
    python3 tools/build_organic_pixels.py kr.json data/korea-organic.json 34
    python3 tools/build_organic_pixels.py ne-admin0.geojson data/jp-organic.json 34 JP
"""
import json, math, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from optimize_pixels import optimize_local, plain_rows
except ImportError:
    optimize_local = lambda d: d
    plain_rows = lambda d: d.get('rows', [])

SYM = (
    '0123456789abcdefghijklmnopqrstuvwxyz'
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    'αβγδεζηθικλμνξοπρστυφχψω'
    'àáâãäåæçèéêëìíîïñòóôõöøùúûüýþ'
    'ăąćčďđęěğįłńňőřśşťůźżž'
    'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ'
    'ΑΒΓΔΕΖΗΘΙΚЛМНОПРСТУФХЦЧШЩЭЮЯ'
    'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝÞ'
    'ĀĒĪŌŪ'
    'ЙЪЫЬ'
    'абвгдежзийклмнопрстуфхцчшщъыьэюя'
)


def rings(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates'][0]]
    return [p[0] for p in geom['coordinates']]


def area(ring):
    return abs(sum(ax * by - bx * ay for (ax, ay), (bx, by)
                   in zip(ring, ring[1:] + ring[:1]))) / 2


def centroid(ring):
    return (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))


def iso_of(p):
    eh = p.get('ISO_A2_EH') or ''
    a2 = p.get('ISO_A2') or ''
    a3 = p.get('ADM0_A3') or ''
    if eh and eh not in ('-99', '-1'):
        return eh
    if a2 and a2 not in ('-99', '-1'):
        return a2
    return a3


def analyze_organic_topology(grid, items=None, cell_size=31.25):
    """
    격자의 2x2 꼭짓점 및 셀 이웃 위상을 분석하여
    유기적 필릿(Inner Fillets)과 대각선 브릿지(Diagonal Bridges), 외곽 코너를 추출한다.
    """
    rows = len(grid)
    cols = len(grid[0]) if rows > 0 else 0

    # 각 꼭짓점 (r, c): 0 <= r <= rows, 0 <= c <= cols
    # 꼭짓점을 둘러싼 4개 사분면: TL (r-1, c-1), TR (r-1, c), BL (r, c-1), BR (r, c)
    fillets = []  # [row, col, quadrant, item_symbol, owner]
    bridges = []  # [vertex_r, vertex_c, type, sym1, sym2]
    outer_corners = []  # [row, col, corner]
    cell_masks = [[0] * cols for _ in range(rows)]

    # 8방향 오프셋: [N, NE, E, SE, S, SW, W, NW]
    DIRS = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]

    for r in range(rows):
        for c in range(cols):
            ch = grid[r][c]
            if ch == '.':
                continue
            mask = 0
            for i, (dr, dc) in enumerate(DIRS):
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] != '.':
                    mask |= (1 << i)
            cell_masks[r][c] = mask

    for vr in range(rows + 1):
        for vc in range(cols + 1):
            tl = grid[vr - 1][vc - 1] if vr > 0 and vc > 0 else '.'
            tr = grid[vr - 1][vc] if vr > 0 and vc < cols else '.'
            bl = grid[vr][vc - 1] if vr < rows and vc > 0 else '.'
            br = grid[vr][vc] if vr < rows and vc < cols else '.'

            # 1. 오목 모서리 필릿 (Concave Inner Corner)
            # 3개가 채워져 있고 1개가 빈 칸인 경우: 빈 칸 사분면에 오목 필릿이 들어간다
            cells_solid = [tl != '.', tr != '.', bl != '.', br != '.']
            k = sum(cells_solid)

            if k == 3:
                if not cells_solid[3]:  # BR이 비어 있음 (TL, TR, BL 채워짐)
                    owner = tr if tr == bl else (tl if tl != '.' else tr)
                    fillets.append({'r': vr, 'c': vc, 'quad': 'BR', 'sym': owner, 'kind': 'concave'})
                elif not cells_solid[2]:  # BL이 비어 있음 (TL, TR, BR 채워짐)
                    owner = tl if tl == br else (tr if tr != '.' else tl)
                    fillets.append({'r': vr, 'c': vc, 'quad': 'BL', 'sym': owner, 'kind': 'concave'})
                elif not cells_solid[1]:  # TR이 비어 있음 (TL, BL, BR 채워짐)
                    owner = tl if tl == br else (bl if bl != '.' else tl)
                    fillets.append({'r': vr, 'c': vc, 'quad': 'TR', 'sym': owner, 'kind': 'concave'})
                elif not cells_solid[0]:  # TL이 비어 있음 (TR, BL, BR 채워짐)
                    owner = tr if tr == bl else (br if br != '.' else tr)
                    fillets.append({'r': vr, 'c': vc, 'quad': 'TL', 'sym': owner, 'kind': 'concave'})

            # 2. 대각선 결합 브릿지 (Diagonal Bridges)
            # TL과 BR이 채워져 있고 TR과 BL이 비어 있는 경우
            elif k == 2:
                if cells_solid[0] and cells_solid[3] and not cells_solid[1] and not cells_solid[2]:
                    bridges.append({'r': vr, 'c': vc, 'dir': 'TL_BR', 'sym1': tl, 'sym2': br})
                    # TR과 BL 자리에 필릿이 파고들어 대각선 목(neck)을 형성
                    fillets.append({'r': vr, 'c': vc, 'quad': 'TR', 'sym': tl, 'kind': 'bridge'})
                    fillets.append({'r': vr, 'c': vc, 'quad': 'BL', 'sym': br, 'kind': 'bridge'})
                elif cells_solid[1] and cells_solid[2] and not cells_solid[0] and not cells_solid[3]:
                    bridges.append({'r': vr, 'c': vc, 'dir': 'TR_BL', 'sym1': tr, 'sym2': bl})
                    # TL과 BR 자리에 필릿이 파고들어 대각선 목 형성
                    fillets.append({'r': vr, 'c': vc, 'quad': 'TL', 'sym': tr, 'kind': 'bridge'})
                    fillets.append({'r': vr, 'c': vc, 'quad': 'BR', 'sym': bl, 'kind': 'bridge'})

            # 3. 돌출 모서리 (Convex Outer Corners)
            elif k == 1:
                if cells_solid[0]:
                    outer_corners.append({'r': vr - 1, 'c': vc - 1, 'corner': 'SE', 'sym': tl})
                elif cells_solid[1]:
                    outer_corners.append({'r': vr - 1, 'c': vc, 'corner': 'SW', 'sym': tr})
                elif cells_solid[2]:
                    outer_corners.append({'r': vr, 'c': vc - 1, 'corner': 'NE', 'sym': bl})
                elif cells_solid[3]:
                    outer_corners.append({'r': vr, 'c': vc, 'corner': 'NW', 'sym': br})

    return {
        'fillets': fillets,
        'bridges': bridges,
        'outer_corners': outer_corners,
        'masks': cell_masks,
        'stats': {
            'concave_fillets': sum(1 for f in fillets if f['kind'] == 'concave'),
            'bridge_fillets': sum(1 for f in fillets if f['kind'] == 'bridge'),
            'bridges': len(bridges),
            'outer_corners': len(outer_corners),
            'total_solid': sum(r.count(c) for r in grid for c in set(r) if c != '.')
        }
    }


def main():
    if len(sys.argv) < 3:
        print("사용법: python3 tools/build_organic_pixels.py <입력 파일> <출력 파일> [COLS] [ISO/옵션]")
        print("예시: python3 tools/build_organic_pixels.py data/gangseo-dong.geom.json data/gangseo-organic.json")
        sys.exit(1)

    src = sys.argv[1]
    dst = sys.argv[2]
    COLS = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else None
    ISO = sys.argv[4].upper() if len(sys.argv) > 4 else ''

    raw_data = json.load(open(src))

    # 케이스 A: 이미 지형 격자가 있는 geom.json (강서구 등)
    if isinstance(raw_data, dict) and 'grid' in raw_data:
        geom = raw_data
        grid = [list(r) for r in geom['grid']]
        ROWS = len(grid)
        COLS = len(grid[0])
        cell_size = geom.get('cell', 31.25)
        items = geom.get('items', [])
        anchor = COLS - 1
        topo = analyze_organic_topology([''.join(r) for r in grid], items, cell_size)

        out = {
            'title': geom.get('slug', 'organic-pixels'),
            'w': geom.get('w', COLS * cell_size),
            'h': geom.get('h', ROWS * cell_size),
            'cols': COLS,
            'rows_n': ROWS,
            'cell': cell_size,
            'grid': [''.join(r) for r in grid],
            'items': items,
            'organic': topo
        }
    # 케이스 B: GeoJSON 스캔라인 래스터화 (build_pixels.py 의 본 기능 계승)
    else:
        feats_raw = raw_data['features']
        COLS = COLS or 30
        if ISO:
            feats = [f for f in feats_raw if iso_of(f['properties']) == ISO]
            assert feats, f'ISO {ISO} 인 나라가 없다'
            HILITE, ANCHOR = None, ()
        else:
            feats = feats_raw
            HILITE = '서울특별시'
            ANCHOR = ('부산광역시', '울산광역시')

        all_rings = [r for f in feats for r in rings(f['geometry'])]
        if ISO and all_rings:
            home = max(all_rings, key=area)
            hx, hy = centroid(home)
            near = [r for r in all_rings
                    if abs(centroid(r)[0] - hx) < 25 and abs(centroid(r)[1] - hy) < 25]
            if near:
                all_rings = near

        pts = [c for r in all_rings for c in r]
        lon0, lon1 = min(p[0] for p in pts), max(p[0] for p in pts)
        lat0, lat1 = min(p[1] for p in pts), max(p[1] for p in pts)
        k = math.cos(math.radians((lat0 + lat1) / 2))
        cell = (lon1 - lon0) * k / COLS
        ROWS = max(1, round((lat1 - lat0) / cell))

        grid = [['.'] * COLS for _ in range(ROWS)]

        def cell_of(lon, lat):
            return round((lat1 - lat) / cell - .5), round((lon - lon0) * k / cell - .5)

        def in_box(ring):
            x, y = centroid(ring)
            return lon0 <= x <= lon1 and lat0 <= y <= lat1

        def paint(geom, mark):
            for ring in rings(geom):
                if ISO and not in_box(ring):
                    continue
                hit = False
                for row in range(ROWS):
                    y = lat1 - (row + .5) * cell
                    xs = []
                    for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
                        if (ay > y) != (by > y):
                            xs.append(ax + (y - ay) * (bx - ax) / (by - ay))
                    xs.sort()
                    for i in range(0, len(xs) - 1, 2):
                        c0 = max(0, math.ceil((xs[i] * k - lon0 * k) / cell - .5))
                        c1 = min(COLS - 1, math.floor((xs[i + 1] * k - lon0 * k) / cell - .5))
                        for c in range(c0, c1 + 1):
                            grid[row][c] = mark
                            hit = True
                if hit:
                    continue
                lons = [p[0] for p in ring]; lats = [p[1] for p in ring]
                r, c = cell_of((min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2)
                if 0 <= r < ROWS and 0 <= c < COLS:
                    grid[r][c] = mark

        for f in feats:
            if not HILITE or f['properties'].get('name') != HILITE:
                paint(f['geometry'], 'x')
        for f in feats:
            if HILITE and f['properties'].get('name') == HILITE:
                paint(f['geometry'], 'S')

        if ANCHOR:
            mark = [['.'] * COLS for _ in range(ROWS)]
            grid, mark = mark, grid
            for f in feats:
                if f['properties'].get('name') in ANCHOR:
                    paint(f['geometry'], 'A')
            anchor_cols = [c for r in grid for c in range(COLS) if r[c] == 'A']
            grid, mark = mark, grid
            anchor = max(anchor_cols) if anchor_cols else COLS - 1
        else:
            anchor = COLS - 1

        while grid and set(grid[0]) == {'.'}: grid.pop(0)
        while grid and set(grid[-1]) == {'.'}: grid.pop()
        def col_empty(c): return all(r[c] == '.' for r in grid)
        while grid and col_empty(0):
            grid = [r[1:] for r in grid]; anchor -= 1
        while grid and col_empty(len(grid[0]) - 1): grid = [r[:-1] for r in grid]
        assert grid and grid[0], f'{ISO or "map"} 픽셀이 비었다'
        COLS, ROWS = len(grid[0]), len(grid)

        rows_str = [''.join(r) for r in grid]
        topo = analyze_organic_topology(rows_str, None, cell)

        out = {
            'w': COLS,
            'h': ROWS,
            'cols': COLS,
            'rows_n': ROWS,
            'cell': cell,
            'anchor': anchor,
            'rows': rows_str,
            'grid': rows_str,
            'organic': topo
        }

    # 파일 출력
    with open(dst, 'w', encoding='utf-8') as fp:
        json.dump(out, fp, ensure_ascii=False, indent=2)

    stats = topo['stats']
    print(f"=== Organic Pixels Engine ===")
    print(f"출력: {dst}")
    print(f"격자: {out['cols']} x {out['rows_n']} (셀 크기 {out.get('cell', 0)})")
    print(f"채워진 픽셀 수: {stats['total_solid']}")
    print(f"오목 필릿 수: {stats['concave_fillets']}")
    print(f"대각선 브릿지 수: {stats['bridges']}")
    print(f"외곽 코너 수: {stats['outer_corners']}")
    print("=============================")


if __name__ == '__main__':
    main()
