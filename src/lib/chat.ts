/**
 * Discord-inspired discussion presentation helpers.
 *
 * Name colours are deterministic per user so a member keeps the same colour
 * across comments and replies. Every tone has a light and a dark class with
 * WCAG AA contrast on the chat surfaces used by the discussion page.
 */
export type ChatTone = {
  name: string;
  avatar: string;
  line: string;
  ring: string;
};

const TONES: ChatTone[] = [
  {
    name: "text-sky-700 dark:text-sky-300",
    avatar: "from-sky-500 to-blue-700",
    line: "border-sky-400/70 dark:border-sky-400/60",
    ring: "ring-sky-500/20",
  },
  {
    name: "text-violet-700 dark:text-violet-300",
    avatar: "from-violet-500 to-purple-700",
    line: "border-violet-400/70 dark:border-violet-400/60",
    ring: "ring-violet-500/20",
  },
  {
    name: "text-emerald-700 dark:text-emerald-300",
    avatar: "from-emerald-500 to-teal-700",
    line: "border-emerald-400/70 dark:border-emerald-400/60",
    ring: "ring-emerald-500/20",
  },
  {
    name: "text-rose-700 dark:text-rose-300",
    avatar: "from-rose-500 to-pink-700",
    line: "border-rose-400/70 dark:border-rose-400/60",
    ring: "ring-rose-500/20",
  },
  {
    name: "text-amber-800 dark:text-amber-300",
    avatar: "from-amber-500 to-orange-600",
    line: "border-amber-400/70 dark:border-amber-400/60",
    ring: "ring-amber-500/20",
  },
  {
    name: "text-teal-700 dark:text-teal-300",
    avatar: "from-teal-500 to-cyan-700",
    line: "border-teal-400/70 dark:border-teal-400/60",
    ring: "ring-teal-500/20",
  },
  {
    name: "text-fuchsia-700 dark:text-fuchsia-300",
    avatar: "from-fuchsia-500 to-pink-700",
    line: "border-fuchsia-400/70 dark:border-fuchsia-400/60",
    ring: "ring-fuchsia-500/20",
  },
  {
    name: "text-indigo-700 dark:text-indigo-300",
    avatar: "from-indigo-500 to-blue-700",
    line: "border-indigo-400/70 dark:border-indigo-400/60",
    ring: "ring-indigo-500/20",
  },
];

export function chatTone(userId: number): ChatTone {
  const index = Math.abs(Math.trunc(userId)) % TONES.length;
  return TONES[index] ?? TONES[0]!;
}

export function displayInitial(username: string): string {
  return username.trim().charAt(0).toUpperCase() || "U";
}

/** Avatars come from Google or a site-relative media path; reject other schemes. */
export function safeAvatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
