// Starter guided tours, built from the hand-assigned story themes. Imported
// into the GalleryTours collection once; the Studio edits them in the console.
export function starterTours(stories) {
  const has = (s, t) => s.themes.includes(t);
  const pick = (list, n = 6) => list.filter((s) => s.inStock).sort((a, b) => a.price - b.price).slice(0, n).map((s) => s.id);
  return [
    { slug: 'by-the-sea', title: 'By the sea', intro: 'Vettriano grew up on the Fife coast, and the shoreline became his favourite stage. A walk through his beach paintings, from first love to bathers in the sun.', productIds: pick(stories.filter((s) => has(s, 'By the sea'))) },
    { slug: 'final-editions', title: 'The final editions', intro: 'Prints released after the artist’s death in March 2025: the last editions to carry his own pencil signature, and the official Estate-stamped posthumous prints.', productIds: pick(stories.filter((s) => has(s, 'Final editions'))) },
    { slug: 'after-dark', title: 'After dark', intro: 'Telephones at midnight, betrayals and private rituals: the cinematic, noir side of Vettriano’s work.', productIds: pick(stories.filter((s) => has(s, 'After dark'))) },
    { slug: 'first-signed', title: 'Your first signed Vettriano', intro: 'Every print in this tour is signed by the artist, in stock and under £800. A good place to begin a collection.', productIds: pick(stories.filter((s) => s.signed && s.price < 800)) },
    { slug: 'rare-and-remarkable', title: 'Rare and remarkable', intro: 'Silkscreens, Artist’s Proofs and Premium editions reproduced at the size of the original painting.', productIds: pick(stories.filter((s) => has(s, 'Rare editions') && s.price >= 1400)) },
  ];
}
