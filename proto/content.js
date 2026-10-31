/* Oeuvre site copy. Every visible string lives here so it can be translated.
   Add `zh` / `mi` objects with the same shape; any missing key falls back to `en`. */
window.OEUVRE_CONTENT = {
  languages: [
    { code: "en", label: "EN", htmlLang: "en", ready: true },
    { code: "zh", label: "中", htmlLang: "zh-Hans", ready: false },
    { code: "mi", label: "MI", htmlLang: "mi", ready: false }
  ],
  en: {
    site: {
      name: "Oeuvre",
      statement: "One team for a brand's whole digital life.",
      place: "Auckland, Aotearoa — NZ",
      legal: "Oeuvre is a trading name of BNB Management Consulting Ltd.",
      email: "info@bnbmanagement.co.nz",
      back: "Back",
      index: "Index",
      indexClose: "Float",
      skip: "Skip to content",
      soon: "Coming soon"
    },
    menu: [
      { id: "work", label: "Work" },
      { id: "services", label: "Services" },
      { id: "studio", label: "Studio" },
      { id: "contact", label: "Contact" }
    ],
    work: {
      title: "Work",
      intro: "Selected projects. Each one we took from first idea to the thing people use.",
      next: "Next project",
      labels: { brief: "The brief", did: "What we did", result: "Result", role: "Role", year: "Year", sector: "Sector" },
      projects: [
        {
          slug: "beicare",
          name: "Bei`Care",
          outcome: "An iPad instrument panel that runs a small production business.",
          sector: "Operations / manufacturing",
          year: "2026",
          tags: ["App", "UX", "Build"],
          placeholder: "dashboard",
          image: null,
          brief: "A growing business ran its batches, stock and workshop on paper and memory. They needed one calm screen that tells the team what to do today.",
          did: [
            "Mapped the day of the people on the floor, not the org chart.",
            "Designed one-screen panels: nothing hides behind a scroll.",
            "Made actions direct — drag a batch, tap a line, done.",
            "Built it in English first, with Chinese one tap away.",
            "Shipped to iPad and kept tuning it from real feedback."
          ],
          result: "Placeholder — add a fact the client is happy to publish.",
          gallery: ["dashboard", "dashboard", "dashboard"]
        },
        {
          slug: "muzi",
          name: "MUZI",
          outcome: "A New Zealand succulent brand, from soil bag to online shop.",
          sector: "Retail / garden",
          year: "2026",
          tags: ["Brand", "Photography", "E-commerce"],
          placeholder: "rosette",
          image: "img/muzi-maifan.jpg",
          brief: "A specialist range of succulent soils, stones and pots needed to look as considered as the plants they hold — on shelf, in store and online.",
          did: [
            "Shaped the identity and the voice.",
            "Photographed the range in one consistent light.",
            "Organised a catalogue of around three hundred products.",
            "Built the shop at muzi.co.nz and the retail collateral."
          ],
          result: "Placeholder — add a fact the client is happy to publish.",
          gallery: ["img/muzi-diatomite.jpg", "img/muzi-stone-mix.jpg", "img/muzi-logo.png"]
        },
        {
          slug: "folio",
          name: "Folio",
          outcome: "A quiet reading app with articles you can listen to.",
          sector: "Media / reading",
          year: "2026",
          tags: ["App", "Editorial", "Audio"],
          placeholder: "page",
          image: "img/folio-five-topics.jpg",
          brief: "Reading apps shout. This one had to feel like a well-made paper: a daily edition, read or narrated, then put down.",
          did: [
            "Designed a daily edition with a clear beginning and end.",
            "Chose a natural, calm narration voice.",
            "Built background listening with lock-screen controls.",
            "Kept the whole pipeline small enough to run every day."
          ],
          result: "Placeholder — add a fact you are happy to publish.",
          gallery: ["img/folio-concept.jpg", "img/folio-article.jpg", "page"]
        },
        {
          slug: "ace",
          name: "ACE",
          outcome: "A music player built around a reel of tape.",
          sector: "Music / interaction",
          year: "2026",
          tags: ["Interaction", "Motion", "App"],
          placeholder: "reel",
          image: "img/ace-reel.png",
          brief: "Music apps reduce a track to a progress bar. ACE gives it a body again: a tape reel that turns while the music plays, and that you turn to move through it.",
          did: [
            "Made a tape reel the centre of the player, labelled like a tape box: title, date, master format.",
            "The reel turns with the music: one full turn every twenty seconds.",
            "Grab the reel and turn it to scrub, forwards or back.",
            "Kept everything else quiet: one play button, a countdown, a plain track list."
          ],
          result: "Placeholder — add a fact you are happy to publish.",
          gallery: ["reel", "reel", "reel"]
        }
      ]
    },
    services: {
      title: "Services",
      intro: "Five disciplines, one team. Hire one, or all of them.",
      closing: "One team, start to finish — and after.",
      cta: "Start a project",
      labels: { what: "What it is", get: "What you get", time: "Typical length" },
      items: [
        { id: "brand", name: "Brand", what: "Naming, identity and voice.", get: "Logo system, type, colour, tone of voice, guidelines.", time: "4–8 weeks" },
        { id: "product", name: "Digital product", what: "Apps and tools people use every day.", get: "Research, UX, UI, build, launch and care.", time: "8–20 weeks" },
        { id: "web", name: "Web", what: "Sites and shops that are easy to run.", get: "Content design, build, hosting, SEO basics, care plan.", time: "4–10 weeks" },
        { id: "motion", name: "Motion & content", what: "Moving image for screens and social.", get: "Motion design, video, social templates.", time: "2–6 weeks" },
        { id: "photography", name: "Photography", soon: true, what: "Product, space and portrait — in the same eye.", get: "Opening 2027. Ask early to book a first shoot.", time: "—" }
      ]
    },
    studio: {
      title: "Studio",
      statement: "We design it, build it, and stay. One team for a brand's whole digital life.",
      body: [
        "A small studio in Auckland. Designers and engineers in the same room, on the same brief.",
        "No hand-offs between agencies. The people who start your project are the people who look after it.",
        "We work in English and 中文 today, with te reo Māori on the way."
      ],
      principlesTitle: "Principles",
      principles: [
        { name: "Whole, not parts.", text: "Brand, product and web are one experience. We treat them as one." },
        { name: "Quiet by default.", text: "Clear beats loud. We remove until it works." },
        { name: "Built to be looked after.", text: "Launch is the middle, not the end." }
      ]
    },
    contact: {
      title: "Contact",
      lead: "Tell us three things: what you make, what's not working, and when you'd like it fixed.",
      copy: "Copy email",
      copied: "Copied",
      write: "Write to us",
      reply: "We reply within two working days."
    },
    being: {
      alt: "A face made of points, looking back at you."
    }
  },
  zh: {},
  mi: {}
};
