// Rest for the database (after the Neon quota of 19 Nov 2026). The watcher sleeps until it is next
// needed; what someone does meanwhile may need it sooner (a reminder set for in five minutes, a
// message to send). The server and its watcher share a process (host.ts): a change that comes in
// through a door is noted here, and the watcher looks at its next minute.

let active = false;

/** Something was written through a door: the watcher looks at its next minute. */
export function noteActivity(): void {
  active = true;
}

/** Whether something was written since the watcher last asked; asking clears it. */
export function takeActivity(): boolean {
  const was = active;
  active = false;
  return was;
}
