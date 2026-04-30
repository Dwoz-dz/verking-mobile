/**
 * registrationLaunchCounter — the "remind every 3 launches" guard.
 *
 * Tracks how many times the app has launched since the last time the
 * user dismissed the registration prompt. Returns `true` when the
 * counter rolls over.
 *
 * Storage shape: { count: number, dismissed_at: ISO } in
 * `safeStorage['vk:reg_reminder']`.
 */
import { safeStorage } from '@/lib/storage';

const KEY = 'vk:reg_reminder';
const TRIGGER_EVERY_N_LAUNCHES = 3;

interface State {
  count: number;
  dismissed_at: string;
}

async function read(): Promise<State> {
  try {
    const raw = await safeStorage.getItem(KEY);
    if (!raw) return { count: 0, dismissed_at: new Date(0).toISOString() };
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      count: Number(parsed.count) || 0,
      dismissed_at: typeof parsed.dismissed_at === 'string' ? parsed.dismissed_at : new Date(0).toISOString(),
    };
  } catch {
    return { count: 0, dismissed_at: new Date(0).toISOString() };
  }
}

async function write(state: State): Promise<void> {
  try { await safeStorage.setItem(KEY, JSON.stringify(state)); } catch { /* noop */ }
}

/**
 * Call once per app launch. Returns `true` when the prompt should be
 * shown to the (still-not-registered) user.
 */
export async function shouldShowRegistrationReminder(): Promise<boolean> {
  const state = await read();
  const next: State = { ...state, count: state.count + 1 };
  await write(next);
  return next.count >= TRIGGER_EVERY_N_LAUNCHES;
}

/**
 * Mark the prompt as dismissed — the next 3 launches will not show
 * the reminder.
 */
export async function dismissRegistrationReminder(): Promise<void> {
  await write({ count: 0, dismissed_at: new Date().toISOString() });
}

/**
 * Mark the user as registered → blow away the counter so we never
 * remind again until storage is wiped.
 */
export async function clearRegistrationReminder(): Promise<void> {
  try { await safeStorage.removeItem(KEY); } catch { /* noop */ }
}
