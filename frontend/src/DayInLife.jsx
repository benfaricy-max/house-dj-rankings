/**
 * DayInLife - "A Booking Day" tab.
 *
 * A day-in-the-life of the buyer PEAKTIME is for: an independent promoter on the
 * Thursday they have to commit on a headliner with a fee they can't justify. The
 * narrative does the persuading - the reader recognises their own Thursday - and
 * then we answer the questions that day raises directly, head-on, not buried in a
 * collapsible FAQ. Each answer ties a real pain to the feature that kills it.
 *
 * Self-contained: own component + DayInLife.css. onCta(tab) routes the closing
 * call-to-action to the Booking Intelligence tab.
 */
import { useState } from "react";
import "./DayInLife.css";

// The same product, described at three buyer altitudes. A first-time promoter
// needs to know what it does in one breath; a regular booker wants the toolkit;
// a seasoned buyer/agency won't trust a benchmark they can't see the maths behind.
const LEVELS = [
  {
    key: "beginner",
    label: "New to this",
    blurb: "Just tell me what it does",
    body: (
      <>
        <p>
          PEAKTIME tells you what a DJ should cost and whether they'll actually sell
          tickets - <strong>before</strong> you commit. No spreadsheets, no guessing.
        </p>
        <p>
          Search an artist. You get a fair fee range for the size of room you're filling,
          a list of what comparable venues have paid, a heads-up if they've already played
          your area too much, and a line you can paste straight into the email to the agent.
        </p>
        <p>That's it. The number, the proof, and the words to say it.</p>
      </>
    ),
  },
  {
    key: "enthusiast",
    label: "I book regularly",
    blurb: "Show me the toolkit",
    body: (
      <>
        <p>
          PEAKTIME ranks house &amp; techno acts by <strong>booking demand</strong>, not
          streaming reach - so the leaderboard reflects who fills rooms, not who has the
          biggest Spotify number. Built for the buy side.
        </p>
        <ul>
          <li>
            <strong>Value Gap</strong> - a neutral, demand-implied fee benchmark with local
            and regional comps, plus a ready-to-paste negotiation line.
          </li>
          <li>
            <strong>Routing saturation</strong> - how heavily an act has played your region
            lately, so you know when a date's stopped feeling exclusive.
          </li>
          <li>
            <strong>Club vs Viral</strong> - splits an act's heat into scene-driven (RA,
            Beatport, what DJs actually play) versus hype-driven (TikTok, streaming), so you
            know if the demand will still be there on the night.
          </li>
          <li>
            <strong>Momentum</strong> - who's accelerating, not just who's already big.
          </li>
        </ul>
        <p>Refreshed daily. Built on signals agents already respect.</p>
      </>
    ),
  },
  {
    key: "expert",
    label: "I want the methodology",
    blurb: "Show me the maths",
    body: (
      <>
        <p>
          The headline index is a weighted composite of 13 signals (Σ = 1.00), field-wide
          normalised - heavy-tailed reach signals log-compressed and every signal winsorised
          to its 1st-99th-percentile band before min-max, so no single streaming giant
          compresses the field.
        </p>
        <ul>
          <li>
            <strong>live_demand .21</strong> (leads) - RA venue-tier / attendance / geo
            blended with Songkick tour density; corroborates upward only.
          </li>
          <li>
            <strong>scene .20</strong> - editorial credibility against a published rubric,
            then a two-sided multiplier <code>0.80 + 0.35·(scene/100)</code> scales the final
            composite (penalises near-zero scene, rewards genuine credibility).
          </li>
          <li>
            <strong>beatport .12</strong>, <strong>1001Tracklists .10</strong> (DJ support - 
            hardest to game), trends .07, growth .06, label .05, listeners .05, plus
            scene-geography, YouTube, TikTok, releases, Wikipedia.
          </li>
        </ul>
        <p>
          Self-healing: an empty signal redistributes its weight; sparse signals
          (1001TL, scene-geography) redistribute <em>per-artist</em> so a structural 0 never
          scores as a real low. The <strong>Value Gap</strong> reprices a demand index against
          the known fee tier - confidence capped at Medium unless the fee is a verified anchor,
          because we hold no transacted contracts and say so. Daily merge-safe refresh, with
          fee / venue / value-call histories accrued for backtesting the calls.
        </p>
      </>
    ),
  },
];

// The questions the booking day actually raises - answered directly, in the
// buyer's own words, each mapped to the feature that resolves it.
const ANSWERS = [
  {
    q: "Nobody will tell me what anyone actually costs. How do I know £15k is fair?",
    a: (
      <>
        You stop negotiating in the dark. The <strong>Value Gap</strong> gives you a
        demand-implied fee range for that artist, in a room that size, in your city - 
        then puts it next to <strong>local fee comps</strong> from comparable venues.
        You walk into the call with a number that has something underneath it, instead
        of a feeling you can't send to your partner.
      </>
    ),
  },
  {
    q: "His Spotify says 4 million. Why can't I just book on that?",
    a: (
      <>
        Because reach isn't tickets. We've all booked the act with the bigger streaming
        number and watched the room empty by midnight because the audience was in another
        country. PEAKTIME ranks on <strong>booking demand</strong> - live bookings, room
        sizes, scene credibility - not raw streams. It tells you who actually sells the
        date you're putting money behind.
      </>
    ),
  },
  {
    q: "How am I supposed to know he's already been played to death in my region?",
    a: (
      <>
        You shouldn't have to find out by accident, from a WhatsApp group, on the day you
        commit. <strong>Routing saturation</strong> shows how many times an artist has
        played your region recently and flags when a date there has stopped feeling
        exclusive - before you build the spend around it, not after.
      </>
    ),
  },
  {
    q: "I have a feeling the fee's too high. How do I turn that into a case?",
    a: (
      <>
        "Trust me" doesn't close a negotiation, and it doesn't survive a post-mortem. Every
        Fair Value report comes with a <strong>ready-to-paste negotiation line</strong> - 
        the demand read, the comps, and the counter, in language an agent already respects.
        Your gut still makes the call. This makes it defensible to everyone you answer to.
      </>
    ),
  },
  {
    q: "Aren't these fees just made up?",
    a: (
      <>
        No - and we won't pretend otherwise. We don't hold signed contracts, so we never
        quote you an artist's invoice. What you get is a <strong>demand-implied range</strong>
        built from live bookings and chart credibility, with the confidence labelled plainly.
        It's a neutral benchmark, not a guess dressed up as a price. That honesty is the
        point - it's why the number holds up when the agent pushes back.
      </>
    ),
  },
  {
    q: "Is it worth £75 a month if I only book a handful of dates?",
    a: (
      <>
        One headliner overpaid by 10% costs more than a year of this. You don't need it
        every day - you need it the Thursday you're staring at a quote with nothing to push
        back with. Solo is <strong>month-to-month</strong>: turn it on for booking season,
        off when you're quiet.
      </>
    ),
  },
];

export default function DayInLifePage({ onCta }) {
  const [level, setLevel] = useState("beginner");
  const active = LEVELS.find((l) => l.key === level) || LEVELS[0];
  return (
    <div className="page dil-page">
      <div className="dil-eyebrow">A Booking Day</div>
      <h1 className="dil-title">The night you have to commit on the headliner</h1>
      <p className="dil-sub">
        If you book talent, you've had this Thursday. Here's what it actually feels like - 
        and the questions it raises, answered straight.
      </p>

      <article className="dil-journal">
        <div className="dil-journal-tag">From a promoter's notebook</div>

        <p className="dil-time">6:40am.</p>
        <p>
          Woke up before the alarm again, doing fee math in my head before my feet hit the
          floor. £15,000. That's the number the agent sent at 9pm last night, "for you
          because we love the room," which is what they always say right before the number
          that makes my chest tight.
        </p>
        <p>
          600 cap. If I do £30 advance and <em>actually</em> sell it out - not the optimistic
          version - that's £18k on the door before the bar. Take out his fee, the support,
          sound, security, the licence, my deposit's already gone. If I do 70% on a wet
          February Saturday I'm underwater, and I'm the one who eats it. Not the agent. Me.
        </p>

        <p className="dil-time">9:15am.</p>
        <p>
          Texted Sam, who books a room about the same size in Bristol. "What did you pay for
          him in the autumn?" Three dots, then nothing for an hour, then "ha, can't really
          say, was a package thing." Everyone protects their number. That's the whole problem - 
          nobody will tell you what anyone actually costs, so you're always negotiating in the
          dark against someone who books forty of these a year while you book eight.
        </p>

        <p className="dil-time">11am.</p>
        <p>
          Pulled up his Spotify. 4.2 million monthly. Looks huge. But I remember booking an
          act last year with bigger numbers than him and we did 41% - turned out his crowd was
          all in São Paulo, not here, and the room was a morgue by midnight. So the streaming
          number tells me nothing I can bank tickets on. I <em>know</em> it's the wrong number
          to look at. I just don't have a better one I can point to.
        </p>

        <p className="dil-time">1:30pm.</p>
        <p>
          The partner's on Slack. "Are we locked on Saturday? Need to brief the door and start
          the spend." And I froze, because I don't <em>know</em> if £15k is fair. I think it's
          high. I've had this feeling for fifteen years and it's usually right. But "I have a
          feeling" is not a sentence I can send to someone about to put four grand of marketing
          behind it.
        </p>

        <p className="dil-time">2:45pm.</p>
        <p>
          Found out from a mate that he already played the city in November. <em>And</em> he's
          doing the festival 40 minutes up the road three weeks after my date. So anyone who
          really wanted to see him has, or will. That changes everything about how this sells - 
          and the agent obviously wasn't going to volunteer it. How am I supposed to know how
          routed an artist is in my own region? I find out by accident, on the day I'm meant to
          commit.
        </p>

        <p className="dil-time">6pm.</p>
        <p>
          Still haven't sent the reply. Eight browser tabs open - Spotify, RA, his Instagram, a
          half-built spreadsheet, the agent's email - trying to assemble out of scraps the one
          thing I actually need and can't get: a fair number, with something underneath it, that
          I can put in front of the agent and my partner and not feel like I'm guessing.
        </p>
        <p className="dil-close">
          That's the job. Not the booking. The <em>guessing.</em> Every single time, the guessing.
        </p>
      </article>

      <div className="dil-turn">
        <h2 className="dil-turn-title">You don't have to book like this.</h2>
        <p className="dil-turn-sub">
          Every worry in that day has an answer. Here they are - straight, no hunting through a help page.
        </p>
      </div>

      <div className="dil-answers">
        {ANSWERS.map((item, i) => (
          <div key={i} className="dil-answer">
            <p className="dil-q">{item.q}</p>
            <p className="dil-a">{item.a}</p>
          </div>
        ))}
      </div>

      <div className="dil-levels">
        <h2 className="dil-levels-title">So what is it, exactly?</h2>
        <p className="dil-levels-sub">Same product. Pick the version that fits how you book.</p>
        <div className="dil-level-nav">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              className={`dil-level-tab ${level === l.key ? "dil-level-tab--on" : ""}`}
              onClick={() => setLevel(l.key)}
              aria-pressed={level === l.key}
            >
              <span className="dil-level-label">{l.label}</span>
              <span className="dil-level-blurb">{l.blurb}</span>
            </button>
          ))}
        </div>
        <div className="dil-level-body">{active.body}</div>
      </div>

      <div className="dil-cta-wrap">
        <p className="dil-cta-line">Stop being the only one in the room without the numbers.</p>
        <button className="dil-cta" onClick={() => onCta?.("booking")}>
          See what an artist should cost →
        </button>
      </div>
    </div>
  );
}
