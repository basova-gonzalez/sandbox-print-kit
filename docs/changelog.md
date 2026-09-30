# Changelog

[Start](../README.md) · [Create & export](usage.md)

## 2.1.0 — 2026-09-21

Documentation is reorganized around one five-variant workflow. Filling rules and deliberate manual layout corrections are separated. Commands, paths, templates and runtime behaviour are unchanged by this documentation update. Technical runs covered all five compositions and formats. Agents must now obtain approval for wording changes throughout the supplied text, not just the headline.

## 2.0.0 — What changed since V1

The five compositions and their design are unchanged. What changed is the way you work with them.

- One `v2:variants` command creates all five compositions for one chosen format, with a local `index.html` linking to them. The index gains equal-scale PNG thumbnails when variants are checked.
- Your photo may be JPEG or PNG. An opaque PNG is prepared as a JPEG for print. Only C1, C4 and C5 use a photo.
- `v2:check` reports missing prices, dates and numbers, leftover demo copy, placeholder QR destinations and text that is clipped or overlapped. It saves a PASS/FAIL and file hash for each checked variant. It does not judge meaning or visual quality.
- `v2:overlays` makes four derived readability versions of a filled C1: quiet, ink plate, blue plate and one dark scrim. It runs only after all C1–C5 pass `v2:check` without subsequent changes, then adds their thumbnails.
- The [filling guide](filling-guide.md) explains how to place the same material in the five compositions.

There is **no source photo bank in V2**: it remains with V1, so supply your own photo for each job. The three images used by the templates are demonstrations, not a library.

Installing V2 does not change V1. It downloads its own copy of the pinned dependencies into this V2 folder; that is expected.
