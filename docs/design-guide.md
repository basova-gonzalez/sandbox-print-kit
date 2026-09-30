# Adjust the layout and assets

[Start](../README.md) · [Choose a composition](catalog.md) · [Create & export](usage.md) · [Edit design & assets](design-guide.md) · [Fill the variants](filling-guide.md) · [Print & QA](print-and-qa.md)

For ordinary changes, edit text in the semantic marked areas of the generated `poster.html`. The nonvisual comments distinguish editable areas from service markup; [usage](usage.md) lists the marked roles and [the filling guide](filling-guide.md) gives the content rules. Keep the selected page dimensions, print CSS, metadata, HTML hierarchy and layout markers intact.

If content does not fit, follow the filling guide’s approval rule for all wording changes. Headlines wrap between whole words. A layout that technically fits still needs readable text and a clear hierarchy at its physical print size.

## Separate manual layout corrections

Ordinary filling by a person or LLM follows the [filling guide](filling-guide.md): only text and `<br>` breaks change; type sizes, styles and markup are preserved. An agent filling the posters does not perform the manual corrections below.

For a deliberate layout correction, the programmer may adjust the relevant inline font size, line height, gap or image position in the working HTML. Make small changes and review the full poster afterward. Do not scale down the whole poster because one block is long. A structural change or repeated need for extra blocks is a maintainer/designer task.

Photos must retain the important subject after cropping. Check the actual HTML and PDF, including contrast behind overlaid text. Text, logo and QR stay inside the intended safe area; backgrounds, photos and decoration may extend into bleed. Do not cover a cut-off edge with a border or silence an overflow check.

To adjust a marked photo's visible crop, change only its `object-position` to two percentages such as `50% 35%`: horizontal focus first, vertical focus second. Keep both values between `0%` and `100%`. A change is visible only along an axis where the image is cropped. Do not add zoom or change the photo element's dimensions. If repositioning cannot keep the important subject, choose another image. Refresh the HTML preview and inspect both exported PDFs.

After any change, inspect the full HTML, rerun `v2:check` for the five variants and regenerate C1 versions if C1 changed, then run the export and open both PDFs. See the [workflow](usage.md#check-all-five-variants) for commands. Check all wording, whole-word wrapping, hierarchy, overlaps, crop and QR destination. If the result is wrong, correct the working file and export a new version.

The existing inline type sizes and spacing are the implemented, client-approved composition values, not universal recommendations for a redesign. Export checks trim overflow and main block collisions.

## Photos and supplied assets

Bring a JPEG or PNG for your material; the renderer does not automatically select or crop a photograph.

Keep your original unchanged and use the command in [Replace a photo or QR](usage.md#replace-a-photo-or-qr) to make the working poster's local JPEG copy. Check the effective resolution and crop in the exported PDF; the resolution guide is in [print and QA](print-and-qa.md). Changing DPI metadata or enlarging a small image does not add detail.

The existing logos are vector SVGs. Generate QR images from the final canonical HTTPS destination rather than supplying a replacement bitmap. Record the source and permission for any new photo added later; unconfirmed additions should not be treated as cleared production assets.
