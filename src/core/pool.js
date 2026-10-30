/** Resolve a collection to stable indexes in the full film dataset. */
export function poolFor(films, collectionId) {
  if (!collectionId) return null;
  return films.reduce((pool, film, index) => {
    if (film.c?.includes(collectionId)) pool.push(index);
    return pool;
  }, []);
}

