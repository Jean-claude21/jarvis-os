import type { ScriptRunner } from '@jarvis-os/core';
import { getQuickJS, shouldInterruptAfterDeadline } from 'quickjs-emscripten';

// The engine her scripts run in (spec 014, decision 0008): QuickJS compiled to WebAssembly — a
// separate JavaScript world with no network, no files, no clock but the one it is given, a memory
// limit and a deadline. The script receives its input as data and returns its changes as data.

const failure = (error: unknown) => {
  const text =
    error && typeof error === 'object'
      ? String((error as { message?: unknown }).message ?? JSON.stringify(error))
      : String(error);
  return /interrupted/i.test(text)
    ? 'The script ran longer than its limit and was stopped.'
    : /out of memory/i.test(text)
      ? 'The script used more memory than its limit and was stopped.'
      : `The script failed: ${text}`;
};

export const quickjsRunner: ScriptRunner = {
  async run(code, input, limits) {
    const engine = await getQuickJS();
    const runtime = engine.newRuntime();
    runtime.setMemoryLimit(limits.memoryMb * 1024 * 1024);
    runtime.setMaxStackSize(512 * 1024);
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + limits.ms));
    const vm = runtime.newContext();
    const logs: string[] = [];
    try {
      const log = vm.newFunction('log', (...args) => {
        if (logs.length < 100)
          logs.push(
            args
              .map((arg) => String(vm.dump(arg)))
              .join(' ')
              .slice(0, 500),
          );
      });
      vm.setProp(vm.global, 'log', log);
      log.dispose();
      const source = `${code}\n;JSON.stringify(run(JSON.parse(${JSON.stringify(JSON.stringify(input))})) ?? null)`;
      const result = vm.evalCode(source, 'script.js');
      if (result.error) {
        const error: unknown = vm.dump(result.error);
        result.error.dispose();
        throw new Error(failure(error));
      }
      const text: unknown = vm.dump(result.value);
      result.value.dispose();
      return { output: typeof text === 'string' ? (JSON.parse(text) as unknown) : null, logs };
    } finally {
      vm.dispose();
      runtime.dispose();
    }
  },
};
