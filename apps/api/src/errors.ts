import { ZodError } from 'zod';

/** What went wrong, in words a person or a model can act on, with the status that says it. */
export function failure(error: unknown): { status: 400 | 404 | 500; message: string } {
  if (error instanceof ZodError) {
    return {
      status: 400,
      message: error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; '),
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/^No (entry|change|stored file|routine|open invitation|member|key)/.test(message)) {
    return { status: 404, message };
  }
  if (
    /already undone|cannot be undone|needs a kind|is empty|larger than|to set aside/.test(
      message,
    ) ||
    // Spaces (spec 004): what she may not do, said so she can do otherwise.
    /^No space|not hers|stays private|^Only an owner|last member|cannot be left|is not undone|no e-mail address|needs a name|^A space needs/.test(
      message,
    ) ||
    // The calendar (spec 011), the models (specs 012, 014): what to write instead.
    /must come after its start|covers at most|are ISO days|follows its model|^A « Model » is/.test(
      message,
    ) ||
    /cannot go from|cannot go to|starts as|» links (a|one)|»: no entry|^Formula «|^A « (Page|Rule|Script) » is|is not a filter of this page|^No page/.test(
      message,
    ) ||
    // Rules, scripts, apps (spec 014).
    /^The script|^Script «|^Scripts cannot run|^Rule «|may not (write|change)|^No (rule|script|app) «|ships with Jarvis|needs an entry|^Give /.test(
      message,
    ) ||
    // Views, her settings, her keys (spec 015).
    /^A « View » is|^No view |is not a time zone|^Telegram |^A key needs/.test(message) ||
    // Collections, buttons, shares, viewers (spec 016).
    /is unique, and|: no file |not a button|never written|^A « Share » is|not asked by this form|^A name is needed|^This link shows|^A form adds to|^Only an owner changes|keeps at least one owner|^No collection «|has her alone|row-level security/.test(
      message,
    )
  ) {
    return { status: 400, message };
  }
  // A Postgres error (a query she wrote, a policy): its own words, never a stack.
  if (typeof (error as { code?: unknown }).code === 'string') return { status: 400, message };
  return { status: 500, message: 'Something went wrong; it was logged.' };
}

/**
 * What kind of refusal it is (spec 015), for the app to say it in her language: the sentence itself
 * stays, written for the model, as the detail.
 */
export function codeOf(message: string): string | null {
  const kinds: [RegExp, string][] = [
    [/follows its model/, 'model'],
    [/cannot go from|cannot go to|starts as/, 'workflow'],
    [/» links (a|one)|»: no entry/, 'link'],
    [/^Formula «/, 'formula'],
    [/^A « \w+ » is/, 'shape'],
    [/^The script|^Script «|may not (write|change)/, 'script'],
    [/is not a time zone/, 'zone'],
    [/^Telegram /, 'telegram'],
    [/row-level security/, 'readonly'],
    [/is unique, and|: no file |never written/, 'model'],
    [/^No /, 'missing'],
  ];
  return kinds.find(([pattern]) => pattern.test(message))?.[1] ?? null;
}
