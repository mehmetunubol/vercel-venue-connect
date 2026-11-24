export const INTENTS = [
  { id: "chat", label: "Just chat", emoji: "💬" },
  { id: "friends", label: "Friends", emoji: "👋" },
  { id: "dating", label: "Dating", emoji: "❤️" },
] as const;

export type Intent = (typeof INTENTS)[number]["id"];

export const INTERESTS = [
  "Music", "Live gigs", "Football", "Basketball", "Running", "Gym", "Yoga", "Hiking",
  "Travel", "Food", "Coffee", "Wine", "Cocktails", "Cooking", "Movies", "Series",
  "Books", "Art", "Photography", "Design", "Fashion", "Gaming", "Tech", "Startups",
  "Science", "Languages", "Dancing", "Board games", "Pets", "Volunteering",
] as const;

export const MAX_INTERESTS = 10;

export function intentLabel(id: string) {
  const i = INTENTS.find((x) => x.id === id);
  return i ? i.label : id;
}

export function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
