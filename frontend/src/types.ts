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
};

export type RankingItem = {
  user_id: number;
  user_name: string;
  achieved_avg: number;
};

export type DraftTask = {
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
