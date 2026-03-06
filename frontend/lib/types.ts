export interface User {
  id: string;
  persona_name: string;
  hostel: string | null;
  vibe_score: number;
  hangout_count: number;
  persona_badge: string;
}

export interface Plan {
  id: string;
  creator_id: string;
  activity: string;
  location: string;
  description: string;
  max_people: number;
  plan_date: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  plan_members?: { count: number }[];
  users?: {
    persona_name: string;
    hostel: string;
  };
}

export interface PlanDetail {
  id: string;
  creator_id: string;
  activity: string;
  location: string;
  description: string;
  max_people: number;
  plan_date: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  plan_members?: {
    user_id: string;
    users: {
      persona_name: string;
    };
  }[];
  users?: {
    persona_name: string;
    hostel: string;
  };
}

export interface LeaderboardEntry {
  persona_name: string;
  hangout_count: number;
  rank: number;
}

export interface Stats {
  free_now: number;
  active_plans: number;
  total_users: number;
}

export type Activity = "Dhaba" | "Movie" | "Study" | "Cricket" | "Just vibe" | "Others";

export const ACTIVITIES: { label: Activity; emoji: string }[] = [
  { label: "Dhaba", emoji: "🍜" },
  { label: "Movie", emoji: "🎬" },
  { label: "Study", emoji: "📚" },
  { label: "Cricket", emoji: "🏏" },
  { label: "Just vibe", emoji: "🎵" },
  { label: "Others", emoji: "✨" },
];

export const LOCATIONS = [
  "H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8",
  "H9", "H10", "H11", "H12", "H13", "H14", "H15",
  "H16", "H17", "H18", "H19",
  "Academic Area", "Gymkhana", "Others",
];

export const ACTIVITY_EMOJI: Record<string, string> = {
  Dhaba: "🍜",
  Movie: "🎬",
  Study: "📚",
  Cricket: "🏏",
  "Just vibe": "🎵",
  Others: "✨",
};
