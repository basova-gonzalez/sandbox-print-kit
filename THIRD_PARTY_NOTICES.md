# Third-party notices

This repository includes or installs third-party components. Their licenses remain in force.

## Figtree

The bundled Figtree font files are licensed under the SIL Open Font License 1.1. The complete license text is in [`assets/fonts/OFL.txt`](assets/fonts/OFL.txt).

## JavaScript dependencies

Exact versions and integrity hashes are recorded in `package-lock.json`.

- Apache-2.0: `playwright`, `playwright-core`, `jsqr`.
- MIT: `pdf-lib`, `@pdf-lib/standard-fonts`, `@pdf-lib/upng`, `pngjs`, `qrcode`, `ansi-regex`, `ansi-styles`, `camelcase`, `color-convert`, `color-name`, `decamelize`, `dijkstrajs`, `emoji-regex`, `find-up`, `is-fullwidth-code-point`, `locate-path`, `p-limit`, `p-locate`, `p-try`, `path-exists`, `require-directory`, `set-blocking`, `string-width`, `strip-ansi`, `wrap-ansi`, `y18n`, `yargs`.
- ISC: `cliui`, `get-caller-file`, `require-main-filename`, `which-module`, `yargs-parser`.
- 0BSD: `tslib`.
- MIT and Zlib: `pako`.
- MIT: the optional macOS dependency `fsevents`.

Dependency packages include their license files when installed by `npm ci`.

## Python dependencies and local tools

Exact Python versions and hashes are recorded in `requirements.lock`; acquisition URLs and hashes for the local PDF toolchain are recorded in `docs/acquisition-lock.json`.

- `pypdf` — BSD-3-Clause.
- `Pillow` — HPND.
- `fonttools` — MIT.
- Poppler and its locked runtime libraries retain their upstream licenses. They are downloaded locally by `scripts/install-tools.py` and are not committed to this repository.
- Chromium retains its upstream licenses. It is downloaded locally by Playwright and is not committed to this repository.

## Demo assets

The three demonstration photographs were generated with OpenAI's image-generation tooling for this repository. The Demo Wall Climbing SVG text mark was drawn in code. They are original demo assets distributed under the repository's MIT License; see `docs/ASSET_PROVENANCE.md`.
