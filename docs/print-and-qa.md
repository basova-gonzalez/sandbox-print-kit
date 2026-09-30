# Print & QA

[Start](../README.md) · [Choose a composition](catalog.md) · [Create & export](usage.md) · [Edit design & assets](design-guide.md) · [Fill the variants](filling-guide.md) · [Print & QA](print-and-qa.md)

For output paths, replacement of previous exports and recovery after failure, see [Create & export](usage.md#view-and-export).

The preview retains the approved trim layout. `no-marks.pdf` adds 5 mm bleed on every side. `marks.pdf` contains the same trim artwork, with 10 mm slug beyond the bleed and crop marks outside the bleed. Marks are 5 mm long, with their nearest endpoint 2 mm outside the bleed. The TrimBox identifies the finished page; the PDF viewer's total page includes bleed and, where used, slug.

| Trim | Trim size, mm | No-marks page, mm | Marks page, mm |
|---|---|---|---|
| DL | 99 × 210 | 109 × 220 | 129 × 240 |
| A6 | 105 × 148 | 115 × 158 | 135 × 178 |
| A5 | 148 × 210 | 158 × 220 | 178 × 240 |
| A4 | 210 × 297 | 220 × 307 | 240 × 327 |
| A3 | 297 × 420 | 307 × 430 | 327 × 450 |

Send the PDF variant requested by the printer and identify the intended trim size. Do not add crop marks to the no-marks file manually or scale the PDF with a print-dialog fit-to-page option.

The automated checks inspect:

- PDF page count, boxes and trim geometry;
- embedded font and glyph resources;
- source text and the expected photo/QR content;
- equivalence of the two rasterized PDF variants inside trim;
- bleed and edge continuity;
- decoded QR destinations where present;
- text beyond trim and collisions between main HTML blocks.

The final PDF and same-size preview must still be visually inspected for layout, colour, crop and readability. A numerical PASS is not the owner's visual approval or printer certification.

Image checks preserve source bytes/colour profiles, verify ICC-based photographic PDF images and report effective resolution after cover-fit cropping. Around 240 ppi at the final placed size is the guide; below that, the report warns but does not block export. This cannot detect whether a supplied file was artificially enlarged.

C1 retains its strict accepted image baseline. Do not change its image padding or crop position casually: visible seams or shifts require correction and a new visual review.

The baseline is a Chromium-generated RGB PDF with local fonts and images. It is not a claimed PDF/X or CMYK conversion. The printer's colour profile, stock-specific requirements and production approval are external inputs. Preserve original photo profiles; do not silently assign a different profile or alter artwork to force a comparison pass.

C5's `✳` may use the installed macOS Zapf Dingbats font. That proprietary font is not included in the package; preserve this platform dependency and verify the exported glyphs with the normal PDF checks.

If a check fails, follow [Correct a problem and keep the result](usage.md#correct-a-problem-and-keep-the-result).
