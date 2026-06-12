// Leaf module: artist slug + inline profile link.
// Deliberately dependency-free so the homepage can use these helpers without
// pulling the heavy ArtistProfile component (and its transitive deps) into the
// initial bundle. ArtistProfile / ValueGap / ProPage etc. import from here too.
export const slugify = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Reusable inline link to an artist's profile. Inherits surrounding text style;
// stops propagation so it won't trigger parent row/card click handlers.
export function ArtistLink({ name, className = "", children }) {
  return (
    <a
      className={`artist-link ${className}`.trim()}
      href={`/artist/${slugify(name)}`}
      onClick={e => e.stopPropagation()}
    >
      {children ?? name}
    </a>
  );
}
