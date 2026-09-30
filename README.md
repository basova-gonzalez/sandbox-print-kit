# Sandbox Print Kit

[English](README.md) · [Русский](README.ru.md)

A local toolkit that takes one set of copy and photos and produces five poster compositions, from DL to A3. The result is print-ready PDFs with 5 mm bleed and optional crop marks.

![Five Sandbox Print compositions using the fictional Demo Wall Climbing brand](docs/images/demo-compositions.png)

The kit was commissioned by **Sandbox Bouldering** and is shown here with the fictional **Demo Wall Climbing** brand. No client logo, client photograph or client address is included. See the [project case study](https://kabago.ru/cases/sandbox-print/).

## What it does

- Creates five editable HTML poster variants for one size.
- Bundles photos, fonts and QR codes inside each working copy.
- Catches missing facts, placeholder QR destinations, clipped text and overlaps.
- Exports one-page PDFs with embedded fonts, bleed and crop marks.
- Verifies PDF geometry, image quality, QR readability and trim consistency.

## With or without an AI assistant

The instructions are written so that a staff member can hand the kit to an AI assistant and get a finished poster, or a developer can follow them by hand. No AI agent or external service is required. Before the first delivery, clean copies of the kit were given to Claude Opus 4.6 and to Codex with no project history; both reached a finished PDF on their own. A later test with a smaller model skipped a check, so the check became mandatory.

## Requirements

- Apple Silicon Mac. Other platforms have not been verified.
- Node.js 20.20.0.
- Python 3.12.13.
- Internet access for the first dependency and Chromium install; rendering is local afterward.

Zapf Dingbats, used for the ✳ glyph in C5, comes from macOS and is not redistributed. Figtree is bundled under the SIL Open Font License.

## Quick start

```sh
npm ci
node scripts/install-browser.mjs
python3 scripts/install-tools.py
npm run v2:variants -- --format A4 --name my-poster --photo "/path/to/photo.png"
```

Open `work/my-poster-a4/index.html`, fill the five working posters, then follow [Create & export](docs/usage.md) to check and export the chosen composition.

Useful references: [composition catalogue](docs/catalog.md), [filling rules](docs/filling-guide.md), [design and assets](docs/design-guide.md), and [print QA](docs/print-and-qa.md).

## What's not included

- The client's logo, photographs, addresses, source photo bank or internal documents.
- Production copy for your business; the bundled words, prices, address and programme names are explicitly fictional examples.
- A hosted service, GUI editor, printing service or printer approval.
- macOS system fonts such as Zapf Dingbats.

Bring your own copy and licensed photographs for production work. The three bundled photographs and the Demo Wall Climbing text mark were created for this public demonstration and are covered by the repository's MIT License.

## License

Code, templates, documentation and original demo assets are available under the [MIT License](LICENSE). Figtree and software dependencies retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Asset origins are recorded in [ASSET_PROVENANCE.md](docs/ASSET_PROVENANCE.md).
