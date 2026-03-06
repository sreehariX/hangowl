const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
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
      is_new: boolean;
    }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp_code }),
    }),

  getPlans: (params?: { hostel?: string; activity?: string }) => {
    const query = new URLSearchParams();
    if (params?.hostel) query.set("hostel", params.hostel);
    if (params?.activity) query.set("activity", params.activity);
    const qs = query.toString();
    return request<{ plans: import("./types").Plan[] }>(`/plans${qs ? `?${qs}` : ""}`);
  },

  getPlan: (id: string) =>
    request<{ plan: import("./types").PlanDetail }>(`/plans/${id}`),

  createPlan: (data: {
    activity: string;
    location: string;
    description?: string;
    max_people?: number;
  }) =>
    request<{ plan: import("./types").Plan }>("/plans", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  joinPlan: (id: string) =>
    request<{ message: string }>(`/plans/${id}/join`, {
      method: "POST",
    }),

  getLeaderboard: () =>
    request<{
      leaderboard: import("./types").LeaderboardEntry[];
      most_spontaneous: {
        persona_name: string;
        hangout_count: number;
        hostel: string;
      } | null;
    }>("/leaderboard"),

  getStats: () =>
    request<import("./types").Stats>("/stats"),
};
