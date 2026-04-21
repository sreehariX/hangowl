import type { Post } from "./types";

// Module-level cache; survives client-side navigation for the browser session.
// When a PostCard navigates to a reply we already have on screen, the detail
// page reads this cache and renders instantly without showing a skeleton.
const cache = new Map<string, Post>();

export const postCache = {
  set(id: string, post: Post) { cache.set(id, post); },
  get(id: string): Post | undefined { return cache.get(id); },
};
