const STORAGE_KEY = 'has_seen_intro';

export function markIntroSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage 不可用 → silently ignore
  }
}

export function hasSeenIntro(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
