/**
 * Safe wrapper around `expo-updates.reloadAsync`. Returns `true` if a JS
 * reload was triggered, `false` otherwise (typically because the native
 * module isn't linked into the current dev-client build).
 *
 * Detection happens ONCE at module load. If the require throws (e.g. the
 * native module isn't compiled into the dev client), the error is logged
 * a single time at boot — not on every user interaction.
 */

let updates: { reloadAsync: () => Promise<void> } | null = null;

(function detect() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-updates');
    const candidate = mod?.default ?? mod;
    if (candidate && typeof candidate.reloadAsync === 'function') {
      updates = candidate;
    }
  } catch {
    // expo-updates' native module is not linked into this dev client.
    // Caller will surface a manual-restart message to the user.
    updates = null;
  }
})();

/** Try to JS-reload the app. Returns true on success. */
export async function safeReload(): Promise<boolean> {
  if (!updates) return false;
  try {
    await updates.reloadAsync();
    return true;
  } catch (err) {
    console.warn('[safeReload] reloadAsync failed:', err);
    return false;
  }
}

/** Returns true if `expo-updates` is available in the current build. */
export function canReload(): boolean {
  return updates !== null;
}
