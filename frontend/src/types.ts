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
