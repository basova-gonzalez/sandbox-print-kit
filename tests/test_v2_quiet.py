"""Check the baked photo against the CSS filter matrix, independently of Chromium."""

import hashlib
import subprocess
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageCms


PACKAGE = Path(__file__).resolve().parents[1]
WORK = PACKAGE / "work" / "html"


class QuietPhotoTest(unittest.TestCase):
    def test_css_filter_and_source_preservation(self):
        WORK.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="m5-quiet-test-", dir=WORK) as directory:
            source = Path(directory) / "source.jpg"
            target = Path(directory) / "quiet.jpg"
            profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
            Image.new("RGB", (32, 32), (200, 100, 40)).save(
                source, quality=100, subsampling=0, icc_profile=profile.tobytes()
            )
            before = hashlib.sha256(source.read_bytes()).hexdigest()
            result = subprocess.run(
                [str(PACKAGE / ".venv/bin/python"), str(PACKAGE / "scripts/v2-quiet-photo.py"), str(source), str(target)],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), before)
            with Image.open(source) as original, Image.open(target) as quiet:
                self.assertEqual(quiet.size, original.size)
                self.assertTrue(quiet.info.get("icc_profile"))
                red, green, blue = original.getpixel((10, 10))
                s, brightness, contrast = 0.14, 0.55, 1.1
                gray = 0.213 * red + 0.715 * green + 0.072 * blue
                expected = tuple(round((gray * (1 - s) + channel * s) * brightness * contrast + 255 * (1 - contrast) / 2) for channel in (red, green, blue))
                actual = quiet.getpixel((10, 10))
                for channel, result_channel in zip(expected, actual):
                    self.assertLessEqual(abs(channel - result_channel), 3)


if __name__ == "__main__":
    unittest.main()
