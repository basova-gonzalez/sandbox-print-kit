"""Bake the designer's CSS filter into a separate, ICC-tagged JPEG."""

import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageCms


def main() -> None:
    if len(sys.argv) != 3:
        raise ValueError("Use source.jpg target.jpg")
    package = Path(__file__).resolve().parents[1]
    source_arg, target_arg = (Path(value) for value in sys.argv[1:])
    if source_arg.is_symlink() or target_arg.is_symlink():
        raise ValueError("Quiet photo paths cannot be symbolic links")
    source, target = source_arg.resolve(), target_arg.resolve()
    work = package / "work"
    if not source.is_relative_to(work) or not target.is_relative_to(work):
        raise ValueError("Quiet photos must stay inside a V2 working run")
    if source == target or target.exists():
        raise ValueError("Source must be separate and the quiet target must be new")
    if not source.is_file() or source.suffix.lower() not in {".jpg", ".jpeg"}:
        raise ValueError("Source must be a prepared JPEG")

    saturation, brightness, contrast = 0.14, 0.55, 1.1
    s = saturation
    rows = (
        (0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s),
        (0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s),
        (0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s),
    )
    # CSS applies saturate, then brightness, then contrast in sRGB channel space.
    matrix = tuple(
        coefficient * brightness * contrast if index < 3 else 255 * (1 - contrast) / 2
        for row in rows
        for index, coefficient in enumerate((*row, 0))
    )

    with Image.open(source) as image:
        icc = image.info.get("icc_profile")
        if not icc:
            raise ValueError("Prepared source JPEG has no ICC profile")
        source_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        srgb_profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
        srgb = ImageCms.profileToProfile(image, source_profile, srgb_profile, outputMode="RGB")
        quiet = srgb.convert("RGB", matrix)
        exif = image.getexif()
        exif[274] = 1
        quiet.save(
            target,
            "JPEG",
            quality=95,
            subsampling=0,
            icc_profile=srgb_profile.tobytes(),
            exif=exif.tobytes(),
        )
        print(json.dumps({
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "derivedSha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "size": quiet.size,
            "filter": "saturate(0.14) brightness(0.55) contrast(1.1)",
            "outputProfile": "sRGB",
        }))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        raise SystemExit(str(error))
