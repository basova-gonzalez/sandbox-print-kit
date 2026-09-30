# Create, compare and export five variants

[Start](../README.md) · [Choose a composition](catalog.md) · [Create & export](usage.md) · [Edit design & assets](design-guide.md) · [Fill the variants](filling-guide.md) · [Print & QA](print-and-qa.md)

Follow this workflow from the package root. The example uses `climbing-program` in A4; each format is a separate run.

## Install on Mac Apple Silicon

Use Node **20.20.0**, Python **3.12.13** and curl. Extract the package into a local directory and run these commands from its root:

```sh
node --version
python3.12 --version
npm ci --ignore-scripts --no-audit --no-fund
node scripts/install-browser.mjs
python3.12 scripts/install-tools.py
```

The installer downloads a separate copy of pinned dependencies into this V2 package and verifies their hashes; it does not change V1. Initial installation needs internet access; rendering uses local files. Intel Mac, Windows and Linux have not been verified. Paths with spaces are supported; symlinked package paths are rejected.

## Prepare the material

Choose a format from the [catalogue](catalog.md). Save your exact material in `climbing-program.md` in the package root: wording, prices, dates, conditions, call to action and full QR destination including `https://`. If the destination is missing or has no protocol, ask; do not guess. Optionally use a two-column table headed `| Slot | Text |`; the check reads only the right column.

Bring your own JPEG or PNG. There is no source photo bank in V2; the template images are demonstrations.

## Create the five variants

```sh
npm run v2:variants -- --format A4 --name climbing-program --photo "/path/to/photo.png"
```

This creates `work/climbing-program-a4/`, with `index.html` and `c1/` through `c5/`. Each variant has its own `poster.html`, local assets, print CSS, metadata, instructions and material ID. The command refuses to overwrite the run folder; if creation fails, it removes folders created in that run.

`--photo` is optional and applies only to C1, C4 and C5; C2 and C3 have no photo zone. Each size is independent: creating A4 does not update any other size.

### Replace a photo or QR

Bring your own JPEG or PNG; the command creates a local working copy without changing your original:

```sh
npm run html:photo -- --html work/climbing-program-a4/c1/poster.html --source "/path/to/your-photo.png"
```

The quoted source path may contain spaces. The command accepts a real `.jpg`, `.jpeg`, or `.png`. JPEG input makes a local JPEG copy, preserves its ICC profile and normalizes its EXIF orientation. PNG input becomes a quality-95 JPEG: an embedded ICC profile is retained, and an sRGB profile is embedded when none is present. A PNG with any transparent pixel is refused with a clear error. Update the photo's `alt` text in `poster.html`, then inspect the crop at the selected print size. See [design and asset guidance](design-guide.md).

If replacing the photo in the full set, repeat `html:photo` for `c4/poster.html` and `c5/poster.html` as well. C2 and C3 have no photo to replace.

## Fill the five posters

Edit each `poster.html` in `c1/` through `c5/` using the same material and the [filling rules](filling-guide.md). Nonvisual comments mark the editable roles that occur: status, headline, supporting text, fact label/value, price, date, conditions, CTA, address/URL, photo and QR.

Ordinary filling, by a person or LLM, changes only text and whole-word breaks using `<br>`; it preserves type sizes, styles, tags, hierarchy and layout markers. An agent filling the posters does not make layout corrections. Deliberate layout corrections are separate manual work by the programmer under the [design guide](design-guide.md), followed by full checking and visual review.

C1, C2 and C5 have QR areas; C3 and C4 do not. Generate a new QR locally:

```sh
npm run html:qr -- --html work/climbing-program-a4/c1/poster.html --destination https://example.com/book
```

Replace `example.com` in this example with your confirmed real destination; `v2:check` will reject it as a placeholder. Update the visible caption and any printed URL in `poster.html` as needed. Changing only a text URL does not change the QR image.

Repeat `html:qr` for `c2/poster.html` and `c5/poster.html`, using the confirmed destination for each. C3 and C4 have no QR; print the URL as described in the filling guide.

## Check all five variants

Run the check with the exact material file and all five working posters:

```sh
npm run v2:check -- --source climbing-program.md --html work/climbing-program-a4/c1/poster.html --html work/climbing-program-a4/c2/poster.html --html work/climbing-program-a4/c3/poster.html --html work/climbing-program-a4/c4/poster.html --html work/climbing-program-a4/c5/poster.html
```

Resolve every `FAIL` before treating that variant as ready; if resolution needs a text change, follow the filling guide’s approval rule. The check reports missing prices, dates and numbers, demonstration copy, missing or placeholder QR destinations (`example.com`, `PLACEHOLDER`, `TBD`, `TODO`), and text outside its block or safe field, clipped by `overflow` or overlapping another block. Placeholder detection is not URL verification. CTA and meaning still need human review.

It saves results and file hashes in `work/climbing-program-a4/v2-check.json`, captures `previews/c1.png` through `previews/c5.png` using the package browser, and updates the index. Rerun the check after any edit to C1–C5.

## Make the C1 readability versions

```sh
npm run v2:overlays -- --run work/climbing-program-a4
```

All C1–C5 must have passed `v2:check` without subsequent changes. Otherwise the command names the variants and prints the check command. On success it adds `c1-quiet/`, `c1-plate-ink/`, `c1-plate-blue/` and `c1-scrim/`, with PDF commands and thumbnails in the index. The original C1 and its photo are unchanged. See [C1 readability versions](filling-guide.md#c1-readability-versions) for their effects and selection guidance.

Edit only the original `c1/poster.html`, then rerun the check and overlays. The command replaces all four derived folders and previews; edits to derived folders are refused at export. Plate edges follow the actual C1 lines. If a plate cannot fit inside the trim with its padding, the command asks for a C1 copy or layout change instead of clipping it. Layout changes belong to the programmer's separate manual workflow.

## View and export

Open `work/climbing-program-a4/index.html` locally in a browser. It shows equal-scale thumbnails and these states: **Not filled**, **Not checked**, **Checked**, **Changed since check**, **Check failed**, or **Derived from C1**. Before the first check it shows **No preview yet — run v2:check**.

Labels and thumbnails refresh when `v2:variants`, `v2:check` or `v2:overlays` runs; refresh the index tab afterward. A changed poster may have an outdated thumbnail. Open the actual poster for its current view. Inspect all five compositions and all C1 versions at their real size, then choose which to export.

Open the working `poster.html` in a browser. Save edits in the code editor and refresh the browser. Check that fonts and photos load, all wording is visible, words wrap cleanly, blocks do not overlap, and the crop supports the text. Keep meaningful text, the logo and QR inside the intended safe area. If the layout needs adjustment, follow the [design guide](design-guide.md).

Use the PDF command shown for your selected variant in the index. For example, if you choose C1, export from the package root:

```sh
npm run html:pdf -- --html work/climbing-program-a4/c1/poster.html
```

For a V2 run variant the command writes three files into the run's `pdf/` folder:

- `work/climbing-program-a4/pdf/c1-no-marks.pdf`
- `work/climbing-program-a4/pdf/c1-marks.pdf`
- `work/climbing-program-a4/pdf/c1-qa.json`

Overlay variants follow the same pattern: `c1-quiet-no-marks.pdf`, `c1-quiet-marks.pdf`, `c1-quiet-qa.json`. Only the latest version is kept; rerunning the command overwrites the previous files. A failed export does not touch existing PDFs. Intermediate build files are deleted after a successful export; on failure they remain in `output/html-attempts/` for diagnosis. The `pdf/` folder sits alongside the variant folders, not inside them, so variant hashes used by `v2:check` and `v2:overlays` are unaffected. The run index gains a link to the no-marks PDF for each exported variant.

A technical PASS checks the export, not the correctness of the copy or the quality of the design. Open **both PDFs** yourself after every export. Check wording, readability, crop, edges, bleed and marks; scan the QR to verify its destination. No approval message to an agent is required. For the printer handoff, see [print and QA](print-and-qa.md).

## Correct a problem and keep the result

If the PDF has a content or visual error, edit the working `poster.html`, repeat [the checks](#check-all-five-variants), regenerate C1 versions if C1 changed, then export again and inspect the new version. If the command fails, read the reported cause: installation/resource errors and content/layout errors need different corrections. A failed attempt does not overwrite existing PDFs; earlier successful exports remain.

For text that does not fit, follow the [filling rules](filling-guide.md), including their limits on rewriting by an agent. Deliberate layout corrections are separate manual work by the programmer under the [design guide](design-guide.md), with full checking and visual review. Preserve `print.css`, `sandbox-print.json`, root dimensions and layout markers during ordinary content edits. A structural redesign needs the maintainer or designer; do not suppress a failing check to make a result look complete.

If the selected internal template or print CSS changes after you created the working poster, the exporter reports `DIRECT_HTML_STALE`. Create a fresh working folder with the same composition and size, transfer your edits into its marked areas and review/export it again. Do not change metadata hashes to bypass the check.

Keep the entire `work/<name>-<format>/` run folder. The `pdf/` folder inside the run contains only the latest exported PDFs and QA report for each variant; earlier versions are overwritten. Copying only the HTML loses local fonts/images. macOS metadata such as `.DS_Store`, `._*` and `__MACOSX` is ignored by the working-copy and export commands; it is never poster content. For a different size, create a separate working poster from the catalogue and review that size independently.

## Create one working poster

This is a reference for the standalone `html:new` command. The five-variant workflow above is the main V2 route.

Choose a composition and size from the [catalogue](catalog.md). For example:

```sh
npm run html:new -- --composition C2 --format A5 --name september-cohorts
```

The command creates `work/html/september-cohorts/` with one annotated `poster.html`, local assets, print CSS, metadata and instructions. It refuses to overwrite an existing folder. Edit this working poster in a code editor. Each size is independent; creating an A5 poster does not update any other size.

Use the marked editable roles described under [Fill the five posters](#fill-the-five-posters) and the same [filling rules](filling-guide.md).

For a standalone `html:new` copy the command prints a new version folder under `output/html/<name>/`. It contains `source.html` and local resources, `preview.html`, `no-marks.pdf` and `marks.pdf`, `qa.json` and `direct-html-assessment.json`, rendered PNGs and a manifest identifying the version.

Keep the entire `work/html/<name>/` working folder for later edits. Apply the same filling, asset and visual-review rules; substitute this standalone HTML path in the photo, QR and PDF commands above.
