"""Normalize an approved production image to a 720x720 transparent WebP canvas."""

from argparse import ArgumentParser
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    source = Image.open(args.input).convert('RGBA')
    alpha = source.getchannel('A')
    if alpha.getextrema() == (255, 255):
        raise SystemExit('Input has no transparent background; regenerate it with a transparent background before registration.')

    bbox = alpha.getbbox()
    if not bbox:
        raise SystemExit('Input is fully transparent.')

    cropped = source.crop(bbox)
    max_subject_size = 640
    scale = min(max_subject_size / cropped.width, max_subject_size / cropped.height, 1)
    size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    resized = cropped.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (720, 720), (0, 0, 0, 0))
    position = ((720 - resized.width) // 2, (720 - resized.height) // 2)
    canvas.alpha_composite(resized, position)

    target = Path(args.out)
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, 'WEBP', quality=82, method=6, exact=True)
    print(target)


if __name__ == '__main__':
    main()
