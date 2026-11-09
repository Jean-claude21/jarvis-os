// Search by words (spec 027), one rule for every list that searches: every word present (accents
// and case aside) in the title, the fields or a file's words; else, when nothing holds them all,
// words close to hers (a typing slip, a plural), by trigrams.

/** What an entry says, folded: its title, its fields, its file's words. */
export const SAID = `jarvis_fold(title || ' ' || data::text || ' ' || jarvis_file_words(id))`;

/** How close a word must be to one she wrote (0 to 1). */
export const NEAR = 0.6;

/** The words of a search, folded: accents and case aside. */
export const wordsOf = (text: string | undefined) =>
  (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);

/** The condition on the words given as parameter `$n`: all of them, or (near) close to them. */
export const wordsMatch = (n: number, near = false) =>
  near
    ? `(select min(word_similarity(word, ${SAID})) from unnest($${n}::text[]) as word) >= ${NEAR}`
    : `(select bool_and(${SAID} like '%' || word || '%') from unnest($${n}::text[]) as word) is not false`;
