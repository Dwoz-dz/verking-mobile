/**
 * uniqueChannel — generate a per-mount-unique Supabase Realtime
 * channel name to avoid the "cannot add 'postgres_changes' callbacks
 * after subscribe()" crash.
 *
 * Why this exists:
 *   `supabase-js` indexes channels by name. If the same screen
 *   re-mounts (React StrictMode dev-double-render, route navigation,
 *   pull-to-refresh, fast-refresh) the second `supabase.channel('foo')`
 *   call returns the SAME instance that's already subscribed, and
 *   `.on('postgres_changes', ...)` on a subscribed channel throws,
 *   bubbling up as the RedBox we hit on the Profile tab.
 *
 *   Reproduction:
 *     // first mount
 *     supabase.channel('school-levels-stream').on(...).subscribe();
 *     // unmount cleanup — supabase.removeChannel is async
 *     // second mount fires before cleanup completes
 *     supabase.channel('school-levels-stream') // ← returns OLD instance
 *       .on(...)                               // ← throws
 *
 * Strategy:
 *   Suffix every channel name with a random short id so each mount
 *   gets its own instance. Collision risk: 36^6 = ~2 billion, plenty
 *   for the lifetime of a single render tree.
 */
export function uniqueChannelName(base: string): string {
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
