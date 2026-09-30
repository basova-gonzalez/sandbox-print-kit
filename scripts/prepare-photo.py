"""Create a local JPEG from an accepted JPEG or opaque PNG input."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageCms, ImageOps

source, target = map(Path, sys.argv[1:3])
try:
    with Image.open(source) as image:
        source_format = image.format
        if source_format not in {'JPEG', 'PNG'}:
            raise ValueError('source is not a JPEG or PNG')
        icc = image.info.get('icc_profile')
        orientation = image.getexif().get(274, 1)
        oriented = ImageOps.exif_transpose(image)
        if source_format == 'PNG':
            alpha = oriented.convert('RGBA').getchannel('A')
            if alpha.getextrema()[0] < 255:
                raise ValueError('PNG has transparent pixels; provide a fully opaque image')
            oriented = oriented.convert('RGB')
            if not icc:
                icc = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
            exif = None
        else:
            if not icc:
                raise ValueError('source JPEG has no ICC profile')
            exif = oriented.getexif()
            exif[274] = 1
        target.parent.mkdir(parents=True, exist_ok=True)
        save_args = {'quality': 95, 'subsampling': 0, 'icc_profile': icc}
        if exif is not None:
            save_args['exif'] = exif.tobytes()
        oriented.save(target, 'JPEG', **save_args)
        print(json.dumps({'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'sourceFormat': source_format, 'orientation': orientation, 'size': oriented.size}))
except Exception as error:
    raise SystemExit(str(error))
