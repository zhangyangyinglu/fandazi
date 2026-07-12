from pathlib import Path
from PIL import Image
from concurrent.futures import ProcessPoolExecutor, as_completed
import os
import re
import json
import time

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / 'public/dish-images'
BACKUP_DIR = ROOT / 'backups/dish-images-before-webp-compression-20260706'
MANIFEST_PATH = ROOT / 'backups/dish-images-webp-compression-manifest-20260706.json'


def convert_one(src_str: str) -> dict:
    src = Path(src_str)
    original_size = src.stat().st_size
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    alpha = im.getchannel('A')
    bbox = alpha.getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        bw, bh = x1 - x0, y1 - y0
        pad = max(8, int(max(bw, bh) * 0.035))
        x0 = max(0, x0 - pad)
        y0 = max(0, y0 - pad)
        x1 = min(w, x1 + pad)
        y1 = min(h, y1 + pad)
        im = im.crop((x0, y0, x1, y1))
    else:
        x0 = y0 = 0
        x1, y1 = w, h

    cw, ch = im.size
    max_dim = 720
    scale = min(max_dim / cw, max_dim / ch, 1.0)
    nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
    if (nw, nh) != (cw, ch):
        im = im.resize((nw, nh), Image.Resampling.LANCZOS)

    dst = src.with_suffix('.webp')
    im.save(dst, 'WEBP', quality=78, method=4, exact=False)
    return {
        'source': src.name,
        'output': dst.name,
        'original_px': [w, h],
        'crop_box': [x0, y0, x1, y1],
        'output_px': [nw, nh],
        'original_bytes': original_size,
        'webp_bytes': dst.stat().st_size,
    }


def main() -> None:
    png_files = sorted(IMG_DIR.glob('*.png'))
    if len(png_files) != 207:
        raise SystemExit(f'Expected 207 PNGs before conversion, got {len(png_files)}')
    if not BACKUP_DIR.exists() or len(list(BACKUP_DIR.glob('*.png'))) != 207:
        raise SystemExit('Backup missing or incomplete; refusing to proceed')

    workers = min(8, os.cpu_count() or 4)
    records = []
    with ProcessPoolExecutor(max_workers=workers) as ex:
        futures = [ex.submit(convert_one, str(p)) for p in png_files]
        for i, fut in enumerate(as_completed(futures), 1):
            records.append(fut.result())
            if i % 25 == 0:
                print(f'converted {i}/{len(futures)}', flush=True)

    dishes_path = ROOT / 'src/data/dishes.ts'
    text = dishes_path.read_text()
    new_text = re.sub(r"(/dish-images/[^'\"]+)\.png", r"\1.webp", text)
    webp_ref_count = len(re.findall(r"/dish-images/[^'\"]+\.webp", new_text))
    if webp_ref_count < 209:
        raise SystemExit(f'Reference rewrite produced {webp_ref_count} webp references; refusing to remove PNGs')
    dishes_path.write_text(new_text)

    for p in png_files:
        p.unlink()

    refs = set(re.findall(r"image:\s*'(/dish-images/[^']+)'", new_text))
    files = set('/dish-images/' + p.name for p in IMG_DIR.glob('*.webp'))
    summary = {
        'created_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'backup_dir': str(BACKUP_DIR),
        'count': len(records),
        'original_total_mb': round(sum(r['original_bytes'] for r in records) / 1024 / 1024, 2),
        'webp_total_mb': round(sum(r['webp_bytes'] for r in records) / 1024 / 1024, 2),
        'avg_original_kb': round(sum(r['original_bytes'] for r in records) / len(records) / 1024, 1),
        'avg_webp_kb': round(sum(r['webp_bytes'] for r in records) / len(records) / 1024, 1),
        'max_webp_kb': round(max(r['webp_bytes'] for r in records) / 1024, 1),
        'min_webp_kb': round(min(r['webp_bytes'] for r in records) / 1024, 1),
        'refs': len(refs),
        'files': len(files),
        'missing': sorted(refs - files),
        'orphan': sorted(files - refs),
        'records': sorted(records, key=lambda r: r['source']),
    }
    MANIFEST_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in summary.items() if k != 'records'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
