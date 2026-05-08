/**
 * Shared utility functions for FitTrack
 */

/**
 * Merges class names into a single string.
 * Simple version of clsx/tailwind-merge
 */
export function cn(...classes: (string | number | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Formats duration in seconds to a human-readable string (e.g., "1h 20m" or "45m")
 */
export function fmtDuration(s: number | null) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

/**
 * Returns a human-readable relative time string (e.g., "Just now", "2d ago")
 */
export function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/**
 * Motivational quotes for the dashboard
 */
export const QUOTES = [
  "The only bad workout is the one that didn't happen.",
  'Push yourself — no one else is going to do it for you.',
  'The pain you feel today is the strength you feel tomorrow.',
  'Every rep counts. Every day counts.',
  "Your body can stand almost anything. It's your mind you have to convince.",
  'Discipline is doing it even when you don\'t feel like it.',
  'Champions are made in the moments they want to quit.',
  'Be stronger than your excuses.',
  'Train hard. Recover smart. Repeat.',
  'Progress, not perfection.',
  'The iron never lies.',
  'One more rep. One more set. One more day.',
  'Earn your rest day.',
  'Results happen over time, not overnight.',
  'Wake up. Work out. Be better.',
  'Fall in love with taking care of your body.',
  'No excuses. No shortcuts. No regrets.',
  'Strength is built outside the comfort zone.',
  'Show up. Even on the hard days.',
  "You're one workout away from a better mood.",
];

/**
 * Returns a deterministic quote based on the day of the year
 */
export function dailyQuote() {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}
