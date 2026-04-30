/**
 * Safe storage wrapper.
 *
 * Tries to load `@react-native-async-storage/async-storage` lazily. If the
 * native module isn't linked into the current dev client (common when the app
 * binary was built before the package was added), we fall back to a simple
 * in-memory Map so the rest of the app keeps working.
 *
 * Sessions and local order history won't survive an app restart in fallback
 * mode — the user just needs to rebuild the dev client to get persistence
 * back.
 */

interface StorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function makeMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    async getItem(key) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}

let resolved: StorageLike | null = null;
let warned = false;

function warnFallback(reason: string): void {
  if (warned) return;
  warned = true;
  console.warn(
    `[verking] AsyncStorage native module unavailable (${reason}). Falling back to in-memory ` +
      'storage. Session and local order history will not persist across app restarts. ' +
      'Rebuild the dev client (npx expo prebuild && eas build / local build) to fix.',
  );
}

function loadStorage(): StorageLike {
  if (resolved) return resolved;
  // If we're running in pure Node (Metro CLI's analysis pass, EAS build
  // preflight, Jest), AsyncStorage's web fallback would crash with
  // `window is not defined`. Detect this and route to memory storage
  // directly — the bundle that ships to the device still picks up the
  // real native module because there `globalThis.HermesInternal` or
  // `window` exists.
  const isNodeOnly =
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { window?: unknown }).window === 'undefined' &&
    typeof (globalThis as { HermesInternal?: unknown }).HermesInternal === 'undefined' &&
    typeof process !== 'undefined' &&
    !!process.versions?.node;
  if (isNodeOnly) {
    resolved = makeMemoryStorage();
    return resolved;
  }
  try {
    // Lazy require — avoids the import-time crash that AsyncStorage throws
    // when its native module is null.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage');
    const candidate = (mod && (mod.default ?? mod)) as Partial<StorageLike> | null;
    if (
      candidate &&
      typeof candidate.getItem === 'function' &&
      typeof candidate.setItem === 'function' &&
      typeof candidate.removeItem === 'function'
    ) {
      resolved = candidate as StorageLike;
      return resolved;
    }
    warnFallback('module loaded but missing methods');
  } catch (err) {
    warnFallback(err instanceof Error ? err.message : 'require threw');
  }
  resolved = makeMemoryStorage();
  return resolved;
}

export const safeStorage: StorageLike = {
  async getItem(key) {
    return loadStorage().getItem(key);
  },
  async setItem(key, value) {
    return loadStorage().setItem(key, value);
  },
  async removeItem(key) {
    return loadStorage().removeItem(key);
  },
};
