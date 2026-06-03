// PEAKTIME Journal — editor's posts. Add new entries to the top of this array.
// Block types the renderer supports:
//   { type: "p", text }              paragraph (use **bold** for emphasis)
//   { type: "h", text }              section heading
//   { type: "quote", text }          pull-quote
//   { type: "youtube", id, caption } YouTube embed (the v= id)
//   { type: "soundcloud", url, caption } SoundCloud embed (full track/set URL)
//   { type: "img", src, caption }    image
//   { type: "note", text }           editor's note / aside
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
      { type: "p", text: "So this is the other side of the project: a journal. Less data, more memory. The first rave that broke my brain. The clubs that felt like home before I'd ever been inside. The sets I'd give a year of my life to have stood through. The ones I caught and the ones I'll forever regret missing." },
      { type: "quote", text: "You don't choose this music. At some point you just realize it's already organizing your life." },
      { type: "p", text: "I'll be writing these in order where I can — starting from the very first night — and tagging the sets I can find so you can hear what I heard. If a set's on YouTube or SoundCloud, it'll be embedded right here so you can press play and stand where I was standing." },
      { type: "p", text: "Pull up a spot by the speaker. Let's get into it." },
      { type: "note", text: "— Ben, editor of PEAKTIME / thedjrankings.com" },
    ],
  },
  {
    slug: "rave-journey-part-1",
    title: "My Rave Journey, Part 1: The First One",
    dek: "Where it all started — the night the floor opened up.",
    date: "2026-06-03",
    author: "Ben Faricy",
    readMins: 4,
    draft: true,
    blocks: [
      { type: "p", text: "[Draft — Ben to fill in] This is the scaffold for the first chapter: the first rave. The plan is to set the scene (where, when, who I went with, what I was expecting vs. what actually happened), then walk through the night and the moment it clicked." },
      { type: "h", text: "The night" },
      { type: "p", text: "[Add the story of the first rave here — the venue, the lineup, the build-up, the drop that did it.]" },
      { type: "h", text: "The set that did it" },
      { type: "p", text: "[Name the set/DJ here. If a recording exists on YouTube or SoundCloud, it gets embedded directly below so readers can hear exactly what flipped the switch.]" },
      { type: "note", text: "Set embeds slot in right here — give me the artist + event/date and I'll find the recording and drop the player in." },
      { type: "h", text: "What it set in motion" },
      { type: "p", text: "[The aftermath — how that one night turned into all the ones that followed, and ultimately into this whole project.]" },
    ],
  },
];

export const getPost = slug => BLOG_POSTS.find(p => p.slug === slug) || null;
