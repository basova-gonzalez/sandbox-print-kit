# Fill the five variants

[Start](../README.md) · [Choose a composition](catalog.md) · [Create & export](usage.md) · [Edit design & assets](design-guide.md) · [Fill the variants](filling-guide.md) · [Print & QA](print-and-qa.md)

This page is for whoever fills the working posters — a programmer, an AI agent, or both. It covers only the rules of this package. General typography is assumed.

The goal: one set of material, shown honestly in all five compositions, so the person can pick one by eye.

For the complete workflow and commands, follow [Create & export](usage.md). This page covers filling rules only.

## Placing one material in five compositions

Compositions are layouts, not fixed topics. Demo labels such as dates, coach or hours are replaceable examples, not required input. Keep each fact with its label and conditions when placing the supplied text.

| | Headline | Supporting text | Facts | Action | Other slots |
|---|---|---|---|---|---|
| **C1** full photo | two parts: white + sand | one paragraph | 2 × label / value / detail | CTA + address line + QR caption | location label |
| **C2** white, blue footer | three parts, one in blue | one paragraph | 4 × label: value rows | two-line sign-up + note | status label, eyebrow, QR |
| **C3** blue announcement | two parts: white + sand | one paragraph | 3 × label / value | one line + note | status label, eyebrow; no photo, no QR |
| **C4** dark, photo band | question + three short lines, one part in sand | one paragraph | 2 × label / value + note | one footer line | no QR |
| **C5** yellow, photo band | two parts: ink + blue | one paragraph | 2 × label / value / detail | CTA + address + URL + QR caption | location label, running line |

- **Remove all demonstration copy.** Every word left from the template must be a word from the material. `[ … ]` placeholders must not survive.
- **Preserve supplied wording.** An agent places the supplied text and adjusts line breaks; it does not independently shorten, replace or omit wording, including labels and punctuation. Propose changes as “original → proposed”, explain any lost meaning, and apply only after the person agrees. Report “Text preserved” or list changes with their approval status.
- **Keep every fact:** prices, dates, numbers, conditions, eligibility and availability. If space is short, propose reducing descriptions, not facts.
- **Never invent.** If the material has nothing for a slot, use another true piece of the material that fits the role (a URL, a format, a condition). If nothing fits, the composition is a weak match for this material — say so rather than filling the slot with made-up text.
- **Keep an offer with its conditions.** A condition stays next to its price, where a reader sees they belong together: in the same fact, or in the fact's detail or note line directly beside it ("$75 a fortnight" with "Founding rate stays while you're subscribed. Gym entry not included."). If the composition has no place next to the price for the condition, it is not the composition for this material.
- **Every price, date and number appears in every variant.** If a composition genuinely cannot hold one of them, it is not the composition for this material.
- **A composition without a QR** (C3, C4) still needs a way to act: print the URL.
- **For a long URL in a composition with QR**, propose printing the short domain; keep the full address in the QR.
- **Filling is not layout correction.** These rules apply to both people and LLMs filling the posters. Deliberate layout corrections are separate manual work by the programmer under the [design guide](design-guide.md), with full checking and visual review. An agent filling the posters does not make them.
- **Keep the markup:** tags, inline styles, `data-sandbox-*` markers and hierarchy stay as they are. Replace text, add or move `<br>`; nothing else.

## The headline

- **Aim for two lines; three is the maximum.** Four lines push the text up into the busy part of the photo — this is what went wrong on the first client A3.
- **Rough capacity per line:** about 13 uppercase characters in DL, A6, A5 and A4, about 11 in A3. Around 35 characters is the practical ceiling for three lines.
- **Do not reduce the headline size.** If it exceeds three lines, propose shorter wording under the approval rule above; preserve the subject and promise.
- **Break lines yourself** with `<br>` between whole words: subject first, payoff after. No one- or two-letter line, no break inside "15-minute".
- **Each size is separate.** A break that works in A6 may not work in A3; adjust the break in that size's file only.

### The accent

Every headline has one coloured span: sand in C1, C3 and C4, blue in C2 and C5.

- It holds the **second, shorter half** of the headline — the payoff: "Your training" plain, "needs a program" accented. The person decides which words; an agent may propose.
- Never the whole headline, never a single word inside a line, never a price or fact value. Keep the span and its colour; do not recolour anything.
- In C1, sand disappears over yellow and sand-coloured parts of the photo. If that happens, choose a plate version (below).

## Supporting text and facts

- One or two sentences. It must not repeat the headline.
- **No orphan words.** If a line ends with a single short word (the client A6 had "you're" alone), move the break or propose a wording change.
- **A6 and DL are limited by space, not type size.** Never reduce the type:
  - propose removing descriptions under a fact;
  - keep every material condition — price, date, age, eligibility, exclusions;
  - a short condition may join its fact line ("Intro session, shoes included — $25", as the V1 DL template does);
  - a long condition keeps its own quieter line.

## C1 readability versions

`v2:overlays` makes four copies of the filled C1. Text, sizes and positions stay identical; only a layer is added.

| Version | What it adds | Choose it when |
|---|---|---|
| `c1` | nothing — the V1 poster | the photo is dark behind the headline |
| `c1-scrim` | the selected darker gradient behind the text block | the photo is mid-tone and you want to keep its colour |
| `c1-quiet` | a darker, desaturated copy of the photo | the photo is light or very busy and colour is not essential; useless on an already dark photo |
| `c1-plate-ink` | black plates hugging the headline and the supporting text | the text must read on any photo, or the sand accent disappears |
| `c1-plate-blue` | the same plates in brand blue | as above, when the poster should read louder, like a campaign |

Show all of them; the person chooses. If none reads well, try in this order: re-crop the photo (`object-position` only, see the [design guide](design-guide.md)), use another photo, propose a shorter headline, or pick C4, which is built for text-heavy material.

## Never

- invent, soften or drop a price, date, condition or eligibility line;
- leave demonstration copy or placeholders;
- shrink type, scale the poster, change the page size or edit `print.css` to make text fit;
- edit C1 overlay folders instead of `c1/`;
- change template colours, including the accent;
- treat a technical PASS as approval: a person looks at every chosen variant and both PDFs.
