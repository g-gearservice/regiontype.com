"""픽셀 격자 JSON 을 RLE 로 줄인다.

    python3 tools/optimize_pixels.py
    python3 tools/optimize_pixels.py data/de-pixels.json
"""
import json
import re
import sys
from pathlib import Path

ENC = 'rle'
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / 'data'


def decode_row(row: str) -> str:
    if not row or row[0] in '.xSA':
        return row
    return ''.join(c * int(n) for n, c in re.findall(r'(\d+)(.)', row))


def encode_row(row: str) -> str:
    if not row:
        return ''
    out, i = [], 0
    while i < len(row):
        c = row[i]
        j = i + 1
        while j < len(row) and row[j] == c:
            j += 1
        out.append(f'{j - i}{c}')
        i = j
    return ''.join(out)


def plain_rows(data: dict) -> list[str]:
    rows = data['rows']
    if data.get('enc') == ENC:
        return [decode_row(r) for r in rows]
    return list(rows)


def trim_pixels(data: dict) -> dict:
    rows = plain_rows(data)
    anchor = int(data.get('anchor', len(rows[0]) - 1 if rows else 0))

    while rows and set(rows[0]) == {'.'}:
        rows.pop(0)
    while rows and set(rows[-1]) == {'.'}:
        rows.pop()

    def col_empty(c: int) -> bool:
        return all(r[c] == '.' for r in rows) if rows else True

    while rows and col_empty(0):
        rows = [r[1:] for r in rows]
        anchor -= 1
    while rows and col_empty(len(rows[0]) - 1):
        rows = [r[:-1] for r in rows]
    assert rows and rows[0], '픽셀이 비었다'
    anchor = min(max(anchor, 0), len(rows[0]) - 1)
    return {'w': len(rows[0]), 'h': len(rows), 'anchor': anchor, 'rows': rows}


def encode_grid(rows: list[str]) -> tuple[list[str], str | None]:
    encoded = [encode_row(r) for r in rows]
    plain = sum(len(r) for r in rows)
    rle = sum(len(r) for r in encoded)
    if rle < plain:
        return encoded, ENC
    return rows, None


def optimize_local(data: dict) -> dict:
    base = trim_pixels(data)
    rows, enc = encode_grid(base['rows'])
    out = {'w': base['w'], 'h': base['h'], 'anchor': base['anchor'], 'rows': rows}
    if enc:
        out['enc'] = enc
    return out


def pixel_files(args: list[str]) -> list[Path]:
    if args:
        return [Path(a) for a in args]
    return sorted(DATA.glob('*-pixels.json')) + ([DATA / 'korea-pixels.json'] if (DATA / 'korea-pixels.json').exists() else [])


def main() -> None:
    paths = pixel_files(sys.argv[1:])
    if not paths:
        print('픽셀 JSON 이 없다', file=sys.stderr)
        sys.exit(1)

    before = after = 0
    for path in paths:
        raw = json.loads(path.read_text())
        out = optimize_local(raw)
        text = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
        before += len(json.dumps(raw, ensure_ascii=False, separators=(',', ':')))
        after += len(text)
        path.write_text(text + '\n', encoding='utf-8')
        tag = f" enc={out.get('enc', 'plain')}"
        print(f'{path.name}: {len(text)}B{tag}')

    pct = (1 - after / before) * 100 if before else 0
    print(f'{len(paths)} files, {before}B → {after}B ({pct:.1f}% smaller)')


if __name__ == '__main__':
    main()
