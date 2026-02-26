export type TaskType = "monthly" | "weekly" | "daily";

export type Task = {
  id: number;
  goal_id: number | null;
  user_id: number;
  type: TaskType;
  title: string;
  month: number | null;
  week_number: number | null;
  date: string | null;
  is_done: boolean;
  carried_over: boolean;
  tags: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: number;
  user_id: number;
  title: string;
  deadline: string | null;
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: number;
  user_id: number;
  group_id: number | null;
  date: string;
  week_number: number;
  comment: string;
  achieved: number;
  created_at: string;
  user_name?: string | null;
  user_avatar_url?: string | null;
  likes_count?: number;
  is_liked_by_you?: boolean;
};

export type RankingItem = {
  user_id: number;
  user_name: string;
  achieved_avg: number;
  avatar_url?: string | null;
};

export type UserProfile = {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
  auto_post_time: string | null;
};

export type DraftTask = {
  date: string | null;
  week_number: number | null;
  month: number | null;
  task_id: number;
  task_type: TaskType;
  title: string;
  note?: string | null;
  subtasks: string[];
};

export type RevisionChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TaskRevisionProposal = {
  proposal_id: string;
  target_task_id: number;
  target_type: "monthly" | "weekly" | "daily" | "subtask";
  subtask_index: number | null;
  before: string;
  after: string;
  reason: string;
};

export type RevisionChatResponse = {
  source: "gemini" | "fallback";
  assistant_message: string;
  proposals: TaskRevisionProposal[];
};
