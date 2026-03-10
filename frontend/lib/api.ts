const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hangowl_token");
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers,
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Something went wrong" }));
    throw new Error(error.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  sendOTP: (email: string) =>
    request<{ message: string }>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyOTP: (email: string, otp_code: string) =>
    request<{
      message: string;
      persona_name: string;
      user_id: string;
      token: string;
      is_new: boolean;
    }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp_code }),
    }),

  getPlans: (params?: { location?: string; activity?: string }) => {
    const query = new URLSearchParams();
    if (params?.location) query.set("location", params.location);
    if (params?.activity) query.set("activity", params.activity);
    const qs = query.toString();
    return request<{ plans: import("./types").Plan[] }>(`/plans${qs ? `?${qs}` : ""}`);
  },

  getMyPlanIds: () =>
    request<{ plan_ids: string[] }>("/plans/my/ids"),

  getMyPlans: () =>
    request<{ live: import("./types").Plan[]; past: import("./types").Plan[] }>("/plans/my"),

  getPlan: (id: string) =>
    request<{ plan: import("./types").PlanDetail }>(`/plans/${id}`),

  createPlan: (data: {
    activity: string;
    location: string;
    description?: string;
    max_people?: number;
    plan_date: string;
    starts_at: string;
    ends_at: string;
    image_url?: string | null;
  }) =>
    request<{ plan: import("./types").Plan }>("/plans", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  joinPlan: (id: string) =>
    request<{ message: string }>(`/plans/${id}/join`, {
      method: "POST",
    }),

  leavePlan: (id: string) =>
    request<{ message: string }>(`/plans/${id}/leave`, {
      method: "POST",
    }),

  hidePlan: (id: string) =>
    request<{ message: string }>(`/plans/${id}`, {
      method: "DELETE",
    }),

  getMessages: (planId: string) =>
    request<{ messages: import("./types").PlanMessage[] }>(`/plans/${planId}/messages`),

  sendMessage: (planId: string, message: string) =>
    request<{ message: import("./types").PlanMessage }>(`/plans/${planId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  getLeaderboard: () =>
    request<{
      leaderboard: import("./types").LeaderboardEntry[];
    }>("/leaderboard"),

  getStats: () =>
    request<import("./types").Stats>("/stats"),

  heartbeat: () =>
    request<{ ok: boolean }>("/heartbeat", { method: "POST" }),

  getFeed: (cursor?: string) => {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return request<{ posts: import("./types").Post[] }>(`/feed${qs}`);
  },

  getPost: (id: string) =>
    request<{ post: import("./types").Post; replies: import("./types").Post[] }>(`/feed/${id}`),

  createPost: (data: { content: string; image_url?: string | null; parent_id?: string | null }) =>
    request<{ post: import("./types").Post }>("/feed", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deletePost: (id: string) =>
    request<{ message: string }>(`/feed/${id}`, { method: "DELETE" }),

  toggleLike: (postId: string) =>
    request<{ liked: boolean; likes_count: number }>(`/feed/${postId}/like`, { method: "POST" }),

  getMyLikedPostIds: () =>
    request<{ post_ids: string[] }>("/feed/my/liked-ids"),

  uploadImage: async (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/feed/upload`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json() as Promise<{ url: string }>;
  },

  getMyPosts: (cursor?: string) => {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return request<{ posts: import("./types").Post[] }>(`/feed/my${qs}`);
  },

  checkAdmin: () =>
    request<{ is_admin: boolean }>("/admin/check"),

  adminDeletePost: (postId: string) =>
    request<{ message: string }>(`/admin/posts/${postId}`, { method: "DELETE" }),

  banUser: (userId: string, banType: string, reason?: string) =>
    request<{ message: string }>("/admin/ban", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, ban_type: banType, reason }),
    }),

  unbanUser: (userId: string) =>
    request<{ message: string }>(`/admin/unban/${userId}`, { method: "POST" }),
};
