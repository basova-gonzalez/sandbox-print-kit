"""Regression checks for supported image inputs to html:photo."""
import subprocess
import sys
import tempfile
import unittest
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageCms

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts' / 'prepare-photo.py'
ICC = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()


class PreparePhotoTests(unittest.TestCase):
    def convert(self, source, target):
        return subprocess.run([sys.executable, str(SCRIPT), str(source), str(target)], text=True, capture_output=True)

    def test_jpeg_preserves_icc(self):
        with tempfile.TemporaryDirectory() as temporary:
            source, target = Path(temporary) / 'source.jpg', Path(temporary) / 'target.jpg'
            Image.new('RGB', (4, 3), 'red').save(source, 'JPEG', icc_profile=ICC)
            result = self.convert(source, target)
            self.assertEqual(result.returncode, 0, result.stderr)
            with Image.open(target) as image:
                self.assertEqual(image.format, 'JPEG')
                self.assertEqual(image.info.get('icc_profile'), ICC)

    def test_png_without_icc_embeds_srgb(self):
        with tempfile.TemporaryDirectory() as temporary:
            source, target = Path(temporary) / 'source.png', Path(temporary) / 'target.jpg'
            Image.new('RGB', (4, 3), 'blue').save(source, 'PNG')
            result = self.convert(source, target)
            self.assertEqual(result.returncode, 0, result.stderr)
            with Image.open(target) as image:
                self.assertEqual(image.format, 'JPEG')
                profile = ImageCms.ImageCmsProfile(BytesIO(image.info['icc_profile']))
                self.assertIn('sRGB', ImageCms.getProfileDescription(profile))

    def test_png_preserves_icc(self):
        with tempfile.TemporaryDirectory() as temporary:
            source, target = Path(temporary) / 'source.png', Path(temporary) / 'target.jpg'
            Image.new('RGB', (4, 3), 'green').save(source, 'PNG', icc_profile=ICC)
            result = self.convert(source, target)
            self.assertEqual(result.returncode, 0, result.stderr)
            with Image.open(target) as image:
                self.assertEqual(image.info.get('icc_profile'), ICC)

    def test_transparent_png_is_refused(self):
        with tempfile.TemporaryDirectory() as temporary:
            source, target = Path(temporary) / 'source.png', Path(temporary) / 'target.jpg'
            image = Image.new('RGBA', (4, 3), (1, 2, 3, 255))
            image.putpixel((1, 2), (1, 2, 3, 254))
            image.save(source, 'PNG')
            result = self.convert(source, target)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('transparent pixels', result.stderr)
            self.assertFalse(target.exists())


if __name__ == '__main__':
    unittest.main()
