// The fiche in a side card (v3 D10, F2): from any list, an entry opens beside it — the list stays,
// the URL keeps it (`fiche`), back closes it. Its own page is one click away.

/** The search that opens an entry's fiche over the page she is on. */
export const peek = (id: string) =>
  ((search: Record<string, unknown>) => ({ ...search, fiche: id })) as never;
