# Oeuvre — content architecture (draft v0.1, 2026-10-31)

Oeuvre is the trading name of BNB Management Consulting Ltd, Auckland.
Statement: **One team for a brand's whole digital life.**

Status: proposal for discussion. Navigation prototype: `proto/nav.html`. All copy lives in
`proto/content.js` so it can be translated later.

---

## 1. Sitemap

```
/                       Home — the "being" (halftone bust) + four floating words
├── /work               Selected work (index)
│   ├── /work/beicare   Case study — Bei`Care (operations app)
│   ├── /work/muzi      Case study — MUZI (garden brand + e-commerce)
│   ├── /work/folio     Case study — Folio (reading + narration app)
│   └── /work/ace       Case study — ACE (music player built around a tape reel)
├── /services           What we do (one page, five disciplines)
│   └── #photography    Placeholder: "Opening 2027"
├── /studio             About: who, how we work, where
└── /contact            info＠bnbmanagement.co.nz, Auckland, hours, simple brief prompts

Utility (not in the main menu): /legal (privacy, company details: BNB Management Consulting Ltd, NZBN),
404 (the being looks around, "Nothing here. Yet.").
```

Prefixes for later languages: `/` (en), `/zh/`, `/mi/` — same slugs in every language (slugs stay English
so links survive translation).

## 2. Main menu (the floating words)

Four words, one each per quadrant around the face. Short, nouns, no verbs:

| Word | Goes to | Why this word |
|---|---|---|
| **Work** | /work | The proof comes first. |
| **Services** | /services | What a client buys. ("Capabilities" is longer and colder.) |
| **Studio** | /studio | Warmer than "About"; says we are a small team, not an agency machine. |
| **Contact** | /contact | Plain. Everyone knows where it goes. |

The Oeuvre wordmark (top-left, small) always returns home. A small "Index" toggle (bottom-right) switches the
floating words to a plain vertical list for anyone who finds the floating layout hard to use.

## 3. Pages

### Home
- The being, centred. Four words float around it (slow drift, light parallax on pointer, the nearest word
  brightens as the pointer approaches it).
- One line under the being: the statement. One small line bottom-left: "Auckland, Aotearoa — NZ".
- Camera permission is asked only after a click on "Let it see you" — never on load. Without it the being
  runs on its own idle motion.

### Work (index)
- A big typographic list: project name, discipline tags, year.
- Hover / focus a row → the project's key image appears beside the cursor, rendered as halftone dots that
  sharpen into the photo after ~400 ms.
- Filters (later, when there are >8 projects): App · Brand · Web · Photo.

### Case study (one template for all)
1. **Title block** — name, one-line outcome, client sector, year, our role (tags).
2. **Hero image** — enters as halftone, resolves to the photo as it scrolls into view.
3. **The brief** — 2–3 sentences: what the client needed, in their language.
4. **What we did** — 3–5 short numbered moves (strategy → design → build → launch).
5. **Gallery** — 3–6 images, alternating full-bleed and pairs.
6. **Result** — one or two facts (only facts the client has agreed to publish).
7. **Credits + next project** — the next case study's title is a big link at the bottom.

Proposed content per project (to confirm with you — I only know what is on this Mac):

| Project | Angle | Our role (guess) | Images to source |
|---|---|---|---|
| **Bei`Care** | An iPad "instrument panel" that runs a small production business: today's batches, stock, workshop. Every screen fits on one screen; drag to act. English first, Chinese toggle. | Product strategy, UX, UI, app build (Expo/React Native), bilingual system | Approved mockups (`design/mockups/*/*.png`), simulator screenshots, beicare.co.nz |
| **MUZI** | A New Zealand succulent and garden brand: identity, packaging photography, product range of ~300 SKUs, retail partner material, online shop at muzi.co.nz. | Brand identity, product photography, e-commerce, retail collateral | Logo, product photos (`Downloads/MUZI/Soil/*`), site screenshots |
| **Folio** (confirmed: the reading app, not LeafReader) | A calm reading app: daily editions, articles narrated by a natural voice, background listening with lock-screen controls. | Product, editorial design, iOS build, audio pipeline | App screenshots (to be taken), the two concept images in `Project Name Folio/Image` |
| **ACE** | A music player built around a reel-to-reel tape reel (checked against the real app, `~/Applications/ACE Music.app`): the reel is labelled like a tape box (title, date, master format), turns with the music (18°/s — one turn per 20 s), and you grab and turn it to scrub. One play button, a countdown, a plain track list. Story is the interaction only — never mention the AI generation pipeline or the channel. | Interaction design, motion, build | `reel.png` (the reel artwork, inside the app's runtime folder) + screenshots / a screen recording of the player (to be taken) |

Do **not** publish: client prices, margins, supplier names, contracts, internal data visible in mockups
(stock numbers, staff names). Screens should be shot with demo data.

### Services
One page, five numbered rows. Each row opens (accordion) to: what it is · what you get · typical length.

1. **Brand** — naming, identity, voice, guidelines.
2. **Digital product** — apps and tools: research, UX, UI, build, launch, care.
3. **Web** — sites and shops, content design, SEO basics, hosting and care.
4. **Motion & content** — motion design, video, social systems.
5. **Photography** — *Opening 2027.* Product, space and portrait photography in the same monochrome-first
   eye. Placeholder row, visibly dimmer, with "Ask early" linking to Contact.

Closing line: "One team, start to finish — and after." + a button to Contact.

### Studio
- The statement, large, revealed word by word on scroll.
- Short text: who we are (small team in Auckland, design + engineering in one room), how we work
  (one brief, one team, no hand-offs between agencies), the languages we work in (English, 中文, te reo
  Māori later).
- Principles (three): *Whole, not parts.* · *Quiet by default.* · *Built to be looked after.*
- Company line: Oeuvre is a trading name of BNB Management Consulting Ltd.

### Contact
- The email, huge: info＠bnbmanagement.co.nz (click = mailto, second button = copy).
- "Tell us three things: what you make, what's not working, when you'd like it fixed."
- Auckland, NZ · Response within two working days.
- No form in v1 (no backend needed, nothing to store, nothing to leak).

## 4. Tone of the copy

- Short sentences. Mostly nouns and verbs. No "solutions", "synergy", "cutting-edge", "passionate".
- Calm confidence: we say what we did, not how amazing it was.
- Second person to the client ("your brand"), first person plural for us ("we").
- British/NZ spelling (colour, organise). Sentence case for headings.
- Every page has at most one line that is allowed to be poetic. The rest is plain.
- Examples: "One team for a brand's whole digital life." · "We design it, build it, and stay." ·
  "Nothing here. Yet."

## 5. Languages (later: 中文, te reo Māori)

- All strings live in one content file keyed by language: `content.en`, `content.zh`, `content.mi`.
  Missing keys fall back to English, so a page can go live half-translated without breaking.
- URLs: `/zh/...`, `/mi/...`; `<html lang="en|zh-Hans|mi">`; `hreflang` alternates on every page.
- Language switch: three letters at the bottom (EN · 中 · MI), never a flag.
- Type: the display face must have a matching Chinese fallback (e.g. Noto Sans SC / Source Han Sans) and
  support macrons (ā ē ī ō ū) for Māori. Test long words — Māori and Chinese lines break differently, so
  the floating menu words are measured at runtime, not hard-coded.
- Te reo Māori should be written or checked by a fluent speaker (not machine translated), and menu words
  in Māori may be different concepts, not literal swaps (e.g. "Studio" → a word for workplace/whare).
- Case-study text is translated per project; client names stay as-is.

## 6. Motion system

- **One transition everywhere (menu → page, page → page, back):** the *halftone iris*. From the point
  you clicked, a field of dots grows until it covers the screen, the page swaps underneath, then the dots
  shrink away from the same point. ~900 ms total. Going back runs it from the menu word's home position.
- **Sub-page effects (all built from the same dot):**
  - Work: images appear as dots, then resolve to the photo.
  - Services: a row fills with a dot gradient when hovered / focused.
  - Studio: words of the statement go from dotted outline to solid as you scroll.
  - Contact: the cursor leaves a short trail of fading dots.
- `prefers-reduced-motion`: the iris becomes a 150 ms fade, floating stops, images show sharp at once.
