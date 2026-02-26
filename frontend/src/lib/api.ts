import axios from "axios";
import type {
  DraftTask,
  Goal,
  Post,
  RankingItem,
  RevisionChatMessage,
  RevisionChatResponse,
  Task,
  TaskRevisionProposal,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const DEFAULT_USER_ID = Number(import.meta.env.VITE_DEFAULT_USER_ID ?? "1");
const AUTH_STORAGE_KEY = "streeeak_auth_session";

type AuthSession = {
  accessToken: string;
  userId: number;
};

export const apiClient = axios.create({
  baseURL: API_BASE,
});

function parseAuthSession(raw: string | null): AuthSession | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.accessToken || typeof parsed.userId !== "number") {
      return null;
    }
    return { accessToken: parsed.accessToken, userId: parsed.userId };
  } catch {
    return null;
  }
}

export function getAuthSession(): AuthSession | null {
  return parseAuthSession(localStorage.getItem(AUTH_STORAGE_KEY));
}

export function setAuthSession(session: AuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  apiClient.defaults.headers.common.Authorization = `Bearer ${session.accessToken}`;
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  delete apiClient.defaults.headers.common.Authorization;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url ?? "");
    const isAuthEndpoint = requestUrl.includes("/auth/login") || requestUrl.includes("/auth/register");

    if (status === 401 && !isAuthEndpoint) {
      clearAuthSession();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/")) {
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(error);
  }
);

function getCurrentUserId() {
  const session = getAuthSession();
  return session?.userId ?? DEFAULT_USER_ID;
}

const existingSession = getAuthSession();
if (existingSession?.accessToken) {
  apiClient.defaults.headers.common.Authorization = `Bearer ${existingSession.accessToken}`;
}

const today = new Date().toISOString().slice(0, 10);
const isoWeek = (() => {
  const now = new Date();
  const jan4 = new Date(Date.UTC(now.getUTCFullYear(), 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  jan4.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  const diff = now.getTime() - jan4.getTime();
  return Math.floor(diff / 604800000) + 1;
})();

export const appContext = {
  get userId() {
    return getCurrentUserId();
  },
  today,
  week: isoWeek,
};

export async function register(payload: { email: string; name: string; password: string }) {
  const res = await apiClient.post<{ access_token: string; token_type: string; user_id: number }>(
    "/auth/register",
    payload
  );
  const session = { accessToken: res.data.access_token, userId: res.data.user_id };
  setAuthSession(session);
  return session;
}

export async function login(payload: { email: string; password: string }) {
  const res = await apiClient.post<{ access_token: string; token_type: string; user_id: number }>(
    "/auth/login",
    payload
  );
  const session = { accessToken: res.data.access_token, userId: res.data.user_id };
  setAuthSession(session);
  return session;
}

export async function fetchDailyTasks() {
  const userId = getCurrentUserId();
  const res = await apiClient.get<Task[]>("/tasks", {
    params: { user_id: userId, type: "daily", date: today },
  });
  return res.data;
}

export async function toggleTaskDone(taskId: number) {
  const res = await apiClient.patch<Task>(`/tasks/${taskId}/done`);
  return res.data;
}

export async function carryOverTask(taskId: number) {
  const res = await apiClient.post<Task>(`/tasks/${taskId}/carry-over`);
  return res.data;
}

export async function fetchGoals() {
  const userId = getCurrentUserId();
  const res = await apiClient.get<Goal[]>("/goals", { params: { user_id: userId } });
  return res.data;
}

export async function createGoal(payload: { title: string; deadline?: string }) {
  const userId = getCurrentUserId();
  const res = await apiClient.post<Goal>("/goals", {
    user_id: userId,
    title: payload.title,
    deadline: payload.deadline || null,
  });
  return res.data;
}

export async function deleteGoal(goalId: number) {
  await apiClient.delete(`/goals/${goalId}`);
}

export async function generateBreakdown(
  goalId: number,
  payload?: { currentSituation?: string }
) {
  const res = await apiClient.post(`/goals/${goalId}/tasks/breakdown`, {
    months: 12,
    weeks_per_month: 4,
    days_per_week: 7,
    persist: true,
    current_situation: payload?.currentSituation ?? null,
  });
  return res.data;
}

export async function createGoalAndBreakdown(payload: {
  title: string;
  deadline?: string;
  currentSituation?: string;
}) {
  const goal = await createGoal(payload);
  const breakdown = await generateBreakdown(goal.id, {
    currentSituation: payload.currentSituation,
  });
  return { goal, breakdown };
}

export async function fetchGoalTasks(goalId: number) {
  const res = await apiClient.get<Task[]>(`/goals/${goalId}/tasks`);
  return res.data;
}

export async function revisionChat(payload: {
  goalId: number;
  message: string;
  draftTasks: DraftTask[];
  chatHistory: RevisionChatMessage[];
}) {
  const res = await apiClient.post<RevisionChatResponse>(
    `/goals/${payload.goalId}/tasks/revision-chat`,
    {
      message: payload.message,
      draft_tasks: payload.draftTasks,
      chat_history: payload.chatHistory,
    }
  );
  return res.data;
}

export async function applyAcceptedRevisions(payload: {
  goalId: number;
  acceptedProposals: TaskRevisionProposal[];
}) {
  const res = await apiClient.post<{ updated_tasks: Task[] }>(
    `/goals/${payload.goalId}/tasks/revisions/apply`,
    {
      accepted_proposals: payload.acceptedProposals,
    }
  );
  return res.data;
}

export async function fetchWeeklyTasks() {
  const userId = getCurrentUserId();
  const res = await apiClient.get<Task[]>("/tasks", {
    params: { user_id: userId, type: "weekly", week_number: isoWeek },
  });
  return res.data;
}

export async function fetchWeeklyDailyTasks() {
  const userId = getCurrentUserId();
  const res = await apiClient.get<Task[]>("/tasks", {
    params: { user_id: userId, type: "daily", week_number: isoWeek },
  });
  return res.data;
}

export async function updateTask(taskId: number, payload: Partial<Task>) {
  const res = await apiClient.put<Task>(`/tasks/${taskId}`, payload);
  return res.data;
}

export async function deleteTask(taskId: number) {
  await apiClient.delete(`/tasks/${taskId}`);
}

export async function createTask(payload: {
  goalId?: number | null;
  type: Task["type"];
  title: string;
  date?: string | null;
  weekNumber?: number | null;
  month?: number | null;
}) {
  const userId = getCurrentUserId();
  const res = await apiClient.post<Task>("/tasks", {
    user_id: userId,
    goal_id: payload.goalId ?? null,
    type: payload.type,
    title: payload.title,
    date: payload.date ?? null,
    week_number: payload.weekNumber ?? null,
    month: payload.month ?? null,
  });
  return res.data;
}

export async function fetchPosts() {
  const userId = getCurrentUserId();
  const res = await apiClient.get<Post[]>("/posts", {
    params: { user_id: userId, week: isoWeek },
  });
  return res.data;
}

export async function createPost(payload: { comment: string; achieved: number; group_id?: number }) {
  const userId = getCurrentUserId();
  const res = await apiClient.post<Post>("/posts", {
    user_id: userId,
    date: today,
    comment: payload.comment,
    achieved: payload.achieved,
    group_id: payload.group_id ?? null,
  });
  return res.data;
}

export async function fetchRanking(topN = 3) {
  const userId = getCurrentUserId();
  const res = await apiClient.get<RankingItem[]>("/analytics/ranking", {
    params: { user_id: userId, week: isoWeek, top_n: topN },
  });
  return res.data;
}
export async function searchUserByEmail(email: string) {
  const res = await apiClient.get<{ id: number; name: string; email: string }>("/friendships/search", {
    params: { email },
  });
  return res.data;
}
export async function addFriend(friendId: number) {
  const res = await apiClient.post("/friendships", { friend_id: friendId });
  return res.data;
}
export async function fetchFriends() {
  const res = await apiClient.get<any[]>("/friendships"); // URLパラメーターを削除
  return res.data;
}
export async function fetchAllDailyTasks() {
  const userId = getCurrentUserId();
  const res = await apiClient.get<Task[]>("/tasks", {
    params: { user_id: userId, type: "daily" },
  });
  return res.data;
}
export async function fetchUser() {
  const userId = getCurrentUserId();
  const res = await apiClient.get(`/users/${userId}`);
  return res.data;
}

export async function updateAutoPostTime(timeStr: string) {
  const userId = getCurrentUserId();
  const res = await apiClient.put(`/users/${userId}`, { auto_post_time: timeStr });
  return res.data;
}

export async function togglePostLike(postId: number) {
  const userId = getCurrentUserId();
  const res = await apiClient.post(`/posts/${postId}/like`, {}, {
    params: { user_id: userId }
  });
  return res.data;
}

export async function deletePost(postId: number) {
  await apiClient.delete(`/posts/${postId}`);
}

export async function blockUser(targetUserId: number) {
  const res = await apiClient.post("/friendships/block", { target_user_id: targetUserId });
  return res.data;
}

export async function unblockUser(targetUserId: number) {
  const res = await apiClient.delete(`/friendships/block/${targetUserId}`);
  return res.data;
}

export async function fetchBlockedUsers() {
  const res = await apiClient.get<{ id: number; name: string; email: string }[]>("/friendships/blocks");
  return res.data;
}