// PEAKTIME Journal — editor's posts. Add new entries to the top of this array.
// Block types: p (paragraph, **bold** supported) · h (heading) · quote · note ·
// youtube {id} · soundcloud {url} · img {src} — all take an optional caption.
// Optional per-post: seriesNav { prev?: {slug,label}, next?: {slug,label} }.
export const BLOG_POSTS = [
  {
    slug: "notes-from-the-floor",
    title: "Notes From the Floor",
    dek: "Why I'm keeping a journal of a life spent chasing this music.",
    date: "2026-06-03",
    author: "Ben Faricy",
    readMins: 2,
    blocks: [
      { type: "p", text: "I built PEAKTIME because I wanted to measure something I love. But numbers only tell half the story. The other half is the nights — the rooms, the sunrises, the sets that rearranged something in my head and never put it back." },
      { type: "p", text: "So this is the other side of the project: a journal. Less data, more memory. The first rave that broke my brain. The clubs that felt like home before I'd ever been inside. The sets I'd give a year of my life to have stood through." },
      { type: "quote", text: "You don't choose this music. At some point you just realize it's already organizing your life." },
      { type: "p", text: "I'll be writing these in order, starting from the very first night — and tagging the sets I can find so you can press play and stand where I was standing. The first chapter, the rave journey, is below in three parts." },
      { type: "note", text: "— Ben, editor of PEAKTIME / thedjrankings.com" },
    ],
  },

  // ───────── Rave Journey · Part 1 ─────────
  {
    slug: "rave-journey-pt1",
    title: "My Rave Journey, Part 1: Main Stages & Trance Tears",
    dek: "Part 1 of 3 · 2015–2017 — where it started, and the top of the trance mountain.",
    date: "2026-06-03",
    author: "Ben Faricy",
    readMins: 4,
    seriesNav: { next: { slug: "rave-journey-pt2", label: "Part 2: Ibiza and the Pivot" } },
    blocks: [
      { type: "p", text: "New Year's Eve, 2015. **Resolution.** My first rave. I went for Slander, Seven Lions and Dillon Francis — and somewhere in that night, without knowing what the name would come to mean to me, I caught **Eric Prydz**. I didn't have the vocabulary for what was happening to me yet. I just knew I'd walked in one person and was going to walk out another." },
      { type: "p", text: "What follows — across three parts — is the honest map of the eight years since, and the slow, total slide from the biggest, brightest main stages to the smallest, darkest rooms. It all bends one direction: away from the drop, toward the underground." },
      { type: "h", text: "2015–2017 · Main stages and trance tears" },
      { type: "p", text: "The first couple of years were pure festival maximalism. **EDC 2016** — RL Grime, Markus Schulz, Gareth Emery, TroyBoi. **Escape Halloween 2016** — Tchami, Jauz, Duke Dumont, Armin van Buuren, Kaskade, and Prydz again, always Prydz. **Resolution NYE 2016** brought Above & Beyond and Adventure Club. I cried at trance breakdowns and meant it." },
      { type: "img", src: "/journal/escape-2016.jpg", caption: "Escape Halloween 2016. Bulls and Michigan jerseys, zero idea what was coming." },
      { type: "p", text: "**Paradiso 2017** was the peak of that era's range — Porter Robinson, Lane 8, Zeds Dead, Griz, Tiësto, Gareth Emery, TroyBoi, and **Oliver Heldens**. I didn't notice it then, but Heldens and Duke Dumont were the first house seeds getting planted in a brain wired for bass and trance." },
      { type: "img", src: "/journal/paradiso-2017.jpg", caption: "Paradiso 2017, the Gorge. Peak festival-kid era." },
      { type: "p", text: "And then **ABGT250**, September 2017, at the Gorge — the emotional ceiling of the trance years. Above & Beyond on that hillside, then Seven Lions b2b Jason Ross. If you've stood in that amphitheater at sunset you know there's nowhere on earth quite like it. This was the top of the mountain I'd been climbing. I didn't realize I was about to start walking down the other side." },
      { type: "img", src: "/journal/abgt250-2017.jpg", caption: "ABGT250, September 2017, The Gorge — the top of the trance mountain." },
      { type: "youtube", id: "CMXiCR2gQw0", caption: "Above & Beyond — #ABGT250, The Gorge Amphitheatre (the full set, the exact night)" },
      { type: "youtube", id: "-Ry5w4zb3B4", caption: "Seven Lions b2b Jason Ross — #ABGT250, The Gorge" },
      { type: "note", text: "Next: an island, a club in Seattle, and the night the whole thing turned. →" },
    ],
  },

  // ───────── Rave Journey · Part 2 ─────────
  {
    slug: "rave-journey-pt2",
    title: "My Rave Journey, Part 2: Ibiza and the Pivot",
    dek: "Part 2 of 3 · 2017–2020 — the island, the pivot, and the tech-house takeover.",
    date: "2026-06-03",
    author: "Ben Faricy",
    readMins: 4,
    seriesNav: { prev: { slug: "rave-journey-pt1", label: "Part 1: Main Stages & Trance Tears" }, next: { slug: "rave-journey-pt3", label: "Part 3: All the Way Under" } },
    blocks: [
      { type: "h", text: "2017–2018 · Ibiza, and the first crack" },
      { type: "p", text: "May 2017, Ibiza. **Pacha**, and **ANTS at Ushuaïa with Andrea Oliva.** It was the first time a dancefloor made more sense to me on a groove than on a drop — no fireworks, no breakdown-and-payoff, just a relentless, rolling pocket that didn't need the catharsis I'd been chasing. The island quietly reframed what a great night could even be." },
      { type: "p", text: "Back home, this was the era of learning to actually go out — club nights in Seattle, cutting our teeth in dark rooms between the big festival weekends." },
      { type: "img", src: "/journal/seattle-2018.jpg", caption: "Seattle club nights, 2018 — learning to love a room, not just a main stage." },
      { type: "p", text: "**CRSSD, Spring 2018** is where it actually turned. Cirez D, Charlotte de Witte, ANNA, Gorgon City. Techno and house took the wheel and never gave it back. The trance tears dried up. I didn't make a decision — the music just moved, and I moved with it." },
      { type: "h", text: "2019–2020 · The tech-house takeover" },
      { type: "p", text: "**Coachella 2019** was a tech-house conversion in a tent. Fisher, Chris Lake, Gorgon City, Gorgon City b2b CamelPhat, and Cirez D — I spent the weekend choosing the Yuma tent over the main stage I'd have killed to be near three years earlier. That's the whole story in one sentence." },
      { type: "youtube", id: "mEJiUbCAsl8", caption: "FISHER — Coachella 2019" },
      { type: "youtube", id: "KvTyeAHCB7Y", caption: "Cirez D — Coachella 2019 (the recurring Prydz thread, now the main event)" },
      { type: "p", text: "That Halloween: **Eric Prydz at Exchange LA, 2019.** The name that had been in the corner of every lineup since my very first night was now the reason I bought the ticket. There's no clean recording of that exact club night — but this is HOLO from the same run, the show in its full form:" },
      { type: "youtube", id: "--tnVmNemZY", caption: "Eric Prydz — HOLO, NYC 2019 (representative of the HOLO run)" },
      { type: "p", text: "Then 2020 stopped everything. The one rave I got was a **Kaskade drive-in in a Ventura parking lot** — cars where the crowd should be, headlights for lasers. It was strange and a little sad and it absolutely counted. We were all just trying to keep the thing alive." },
      { type: "note", text: "Next: it comes back, and I come back deeper — Space, fabric, Afterlife, Carl Cox. →" },
    ],
  },

  // ───────── Rave Journey · Part 3 ─────────
  {
    slug: "rave-journey-pt3",
    title: "My Rave Journey, Part 3: All the Way Under",
    dek: "Part 3 of 3 · 2021–2023 — the deep end, and why this whole site exists.",
    date: "2026-06-03",
    author: "Ben Faricy",
    readMins: 4,
    seriesNav: { prev: { slug: "rave-journey-pt2", label: "Part 2: Ibiza and the Pivot" } },
    blocks: [
      { type: "h", text: "2021–2023 · All the way under" },
      { type: "p", text: "When it came back, I came back deeper. **Secret Project at Club Space, Miami** — Michael Bibi, Eric Prydz, Green Velvet, on that legendary terrace as the sun came up. **John Summit on the Academy patio at Day Trip, 2021,** while he was still on the way up. Alesso in DTLA, Beyond Wonderland 2021, **Day Moves at CRSSD San Diego, August 2022.**" },
      { type: "p", text: "By 2023 I was all the way in: **Mau P at the Academy** in February, Skyline, **Charlotte de Witte in downtown Las Vegas,** Cristoph at Academy OTC, Hard Summer. The kid who needed a trance breakdown to feel something now wanted a kick drum, a dark room, and four hours to disappear." },
      { type: "img", src: "/journal/daytrip-2023.jpg", caption: "Day Trip in the park, LA, summer 2023. The 'Track ID?' era — fully converted." },
      { type: "youtube", id: "QyZyIotYQ-Y", caption: "Mau P — 2023 (a set from the year I caught him at the Academy)" },
      { type: "p", text: "And then London, which felt like a final exam. **Adriatique.** **Ricardo Villalobos at fabric** — the most serious room I'd ever set foot in, the polar opposite of that first night's pyrotechnics, and somehow the exact same feeling underneath. Standing on fabric's bodysonic floor at an hour I won't admit to, I understood that I'd come the whole distance." },
      { type: "soundcloud", url: "https://soundcloud.com/electroniqueunderground/ricardo-villalobos-club-fabric-london-21072008", caption: "Ricardo Villalobos — live at fabric, London (from the fabric vaults)" },
      { type: "p", text: "October 2023, back in LA, in a single month: **Afterlife (Tale of Us)** and **Carl Cox.** A melodic cathedral and the godfather of the whole thing, two weeks apart. If 2015 was the trailhead, this felt like the summit on the far side of the mountain." },
      { type: "youtube", id: "EotwDVCWKyQ", caption: "Tale of Us — Afterlife, Los Angeles 2023 (the exact run)" },
      { type: "h", text: "Why this whole site exists" },
      { type: "p", text: "Eight years from Slander to Villalobos. Same person, completely different floor. That arc — from the biggest, brightest, most-marketed names toward the rooms and records the scene actually reveres — is the entire reason I built PEAKTIME. I wanted to measure the thing that happened to me: the gap between what's popular and what's revered, and how you can see someone's trajectory before the world catches up." },
      { type: "quote", text: "You start out chasing the drop. You end up chasing the truth." },
      { type: "note", text: "More chapters coming — the nights are still happening, and so is the list." },
    ],
  },
];

export const getPost = slug => BLOG_POSTS.find(p => p.slug === slug) || null;
