import "./BlogPage.css";
import { BLOG_POSTS, getPost } from "./blogPosts";

const fmtDate = iso => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
const bold = t => t.split(/(\*\*[^*]+\*\*)/g).map((s, i) => s.startsWith("**") ? <strong key={i}>{s.slice(2, -2)}</strong> : s);

function YouTube({ id, caption }) {
  return (
    <figure className="bl-embed">
      <div className="bl-embed-frame">
        <iframe src={`https://www.youtube.com/embed/${id}`} title={caption || "YouTube"} loading="lazy"
          frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
      {caption && <figcaption className="bl-cap">▶ {caption}</figcaption>}
    </figure>
  );
}
function SoundCloud({ url, caption }) {
  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23C8F750&auto_play=false&hide_related=true&show_comments=false&show_user=true&visual=true`;
  return (
    <figure className="bl-embed">
      <iframe className="bl-sc" width="100%" height="300" scrolling="no" frameBorder="no" loading="lazy" allow="autoplay" src={src} title={caption || "SoundCloud"} />
      {caption && <figcaption className="bl-cap">♫ {caption}</figcaption>}
    </figure>
  );
}

function Block({ b }) {
  switch (b.type) {
    case "h": return <h2 className="bl-h">{b.text}</h2>;
    case "quote": return <blockquote className="bl-quote">{b.text}</blockquote>;
    case "note": return <div className="bl-note">{b.text}</div>;
    case "youtube": return <YouTube id={b.id} caption={b.caption} />;
    case "soundcloud": return <SoundCloud url={b.url} caption={b.caption} />;
    case "img": return <figure className="bl-embed"><img className="bl-img" src={b.src} alt={b.caption || ""} loading="lazy" />{b.caption && <figcaption className="bl-cap">{b.caption}</figcaption>}</figure>;
    default: return <p className="bl-p">{bold(b.text)}</p>;
  }
}

// Blog index (the Journal tab)
export default function BlogPage() {
  return (
    <div className="page bl-page">
      <div className="bl-hero">
        <div className="bl-eyebrow">PEAKTIME Journal</div>
        <h1 className="bl-title">Notes from the floor</h1>
        <p className="bl-sub">The editor's log — raves, clubs and the sets that rearranged everything. Data lives in the rest of the site; the stories live here.</p>
      </div>
      <div className="bl-list">
        {BLOG_POSTS.map(p => (
          <a key={p.slug} className="bl-card" href={`#/blog/${p.slug}`}>
            <div className="bl-card-meta">{fmtDate(p.date)} · {p.author}{p.draft ? " · ✍️ In progress" : p.readMins ? ` · ${p.readMins} min` : ""}</div>
            <div className="bl-card-title">{p.title}</div>
            <div className="bl-card-dek">{p.dek}</div>
            <span className="bl-card-read">Read →</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// Single post (route #/blog/<slug>)
export function BlogPost({ slug }) {
  const p = getPost(slug);
  const back = () => { window.location.hash = ""; };
  if (!p) return <div className="page bl-post"><button className="ap-back" onClick={back}>← Back</button><div className="bl-missing">Post not found.</div></div>;
  return (
    <div className="page bl-post">
      <button className="ap-back" onClick={back}>← Back to Journal</button>
      <article className="bl-article">
        <div className="bl-eyebrow">PEAKTIME Journal{p.draft ? " · ✍️ In progress" : ""}</div>
        <h1 className="bl-post-title">{p.title}</h1>
        <p className="bl-post-dek">{p.dek}</p>
        <div className="bl-post-meta">{fmtDate(p.date)} · {p.author}{p.readMins ? ` · ${p.readMins} min read` : ""}</div>
        <div className="bl-body">{p.blocks.map((b, i) => <Block key={i} b={b} />)}</div>
      </article>
    </div>
  );
}
