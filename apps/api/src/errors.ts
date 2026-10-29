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
  if (/^No (entry|change|stored file|routine)/.test(message)) return { status: 404, message };
  if (
    /already undone|cannot be undone|needs a kind|is empty|larger than|to set aside/.test(message)
  ) {
    return { status: 400, message };
  }
  // A Postgres error (a query she wrote, a policy): its own words, never a stack.
  if (typeof (error as { code?: unknown }).code === 'string') return { status: 400, message };
  return { status: 500, message: 'Something went wrong; it was logged.' };
}
