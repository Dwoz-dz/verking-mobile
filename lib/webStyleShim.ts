/**
 * webStyleShim — silence RN Web 0.21 shadow-prop runtime crash on web.
 *
 * What's broken:
 *   React Native Web 0.21 deprecated `shadowOffset / shadowOpacity /
 *   shadowRadius / shadowColor` in favour of `boxShadow`. The shim
 *   layer that maps the old API to the new one occasionally produces
 *   a style object that React DOM tries to apply to
 *   `CSSStyleDeclaration` using a *numeric indexed setter*, which is
 *   not supported by browsers — throwing:
 *
 *     "Failed to set an indexed property [0] on 'CSSStyleDeclaration':
 *      Indexed property setter is not supported."
 *
 *   Stack origin: react-dom-client.development.js → setValueForStyle
 *   → setProp → setInitialProperties.
 *
 *   Trigger: any component that uses `shadow*` style props inside a
 *   <Pressable> / <View> on the web target. Verking has 29 such files
 *   so a per-file rewrite is a much bigger change than the bug.
 *
 * Fix:
 *   When running on web, intercept the indexed setter on
 *   `CSSStyleDeclaration.prototype`. The browsers we target (Chrome,
 *   Edge, Firefox) implement style as an array-like, where setting
 *   `style[0] = 'foo'` is actually a no-op + throw. We override that
 *   path to silently swallow the assignment instead of throwing.
 *
 *   This is **runtime-only**, **web-only**, and does NOT change how
 *   shadows render on Android / iOS (Hermes path bypasses the
 *   browser entirely). We're trading a deprecation warning for a
 *   working web preview until the 29-file shadow→boxShadow migration
 *   is complete.
 */
let installed = false;

export function installWebStyleShim(): void {
  if (installed) return;
  if (typeof window === 'undefined') return;
  if (typeof CSSStyleDeclaration === 'undefined') return;
  installed = true;

  try {
    const proto = CSSStyleDeclaration.prototype as unknown as Record<string, unknown> & {
      setProperty: (k: string, v: string, p?: string) => void;
    };

    const realSetProperty = proto.setProperty;
    // Wrap setProperty so a name that's a stringified integer (the
    // bad path React DOM hits when applying RN Web's array-shaped
    // shadow output) is silently no-op'd instead of throwing.
    proto.setProperty = function patchedSetProperty(
      name: string,
      value: string,
      priority?: string,
    ): void {
      // Bare numeric strings ("0", "1", …) hit the indexed setter
      // and throw. Drop them.
      if (typeof name === 'string' && /^\d+$/.test(name)) return;
      // Defer to the original implementation for all real properties.
      realSetProperty.call(this, name, value, priority);
    };

    // React DOM's setValueForStyle path uses bracket assignment
    // (`style[name] = value`) which goes through the [[Set]] proxy
    // hook, NOT setProperty. Intercept it via a Proxy on the
    // prototype. Since CSSStyleDeclaration is a host object we can't
    // wrap it directly, but we can shadow the indexed setter slot.
    Object.defineProperty(proto, '0', {
      configurable: true,
      enumerable: false,
      get() { return undefined; },
      set() { /* swallow */ },
    });
    // Most RN Web bad-paths only ever produce index 0, but cover a
    // few more to be safe.
    for (let i = 1; i <= 8; i += 1) {
      Object.defineProperty(proto, String(i), {
        configurable: true,
        enumerable: false,
        get() { return undefined; },
        set() { /* swallow */ },
      });
    }
  } catch {
    // If the runtime refuses the redefinition (some sandboxed
    // browsers / very old engines), fall back to the noisy default.
    // We deliberately don't log because the warning would fire on
    // every page load.
  }
}
