import { useQuery } from "@tanstack/react-query";
import { fetchWeeklyTasks } from "../lib/api";

export function ResultsPage() {
  const weeklyTasks = useQuery({ queryKey: ["weeklyTasks"], queryFn: fetchWeeklyTasks });

  const total = weeklyTasks.data?.length ?? 0;
  const done = weeklyTasks.data?.filter((t) => t.is_done).length ?? 0;
  const rate = total > 0 ? (done / total) * 100 : 0;
  const categoryMap = weeklyTasks.data?.reduce<Record<string, { done: number; total: number }>>(
    (acc, task) => {
      const key = task.tags ?? "未分類";
      if (!acc[key]) acc[key] = { done: 0, total: 0 };
      acc[key].total += 1;
      if (task.is_done) acc[key].done += 1;
      return acc;
    },
    {}
  );

  return (
    <section className="page">
      <section className="visionCard">
        <p className="chip">Your Stats</p>
        <h2>今週の達成率 {rate.toFixed(1)}%</h2>
        <p className="mutedText">
          累計 {done} / {total} タスク達成
        </p>
        <div className="progressTrack">
          <div className="progressFill" style={{ width: `${rate}%` }} />
        </div>
      </section>

      <div className="card">
        <h3 className="font-medium text-xl">タスク振り返り</h3>
        {weeklyTasks.data?.map((task) => (
          <div key={task.id} className="taskRow flex flex-col">
            <div>
              <p>{task.title}</p>
            </div>
            <p className="comp">{task.is_done ? "完了" : "未完了"}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="font-medium text-xl">カテゴリ別達成率</h3>
        {categoryMap &&
          Object.entries(categoryMap).map(([tag, stat]) => {
            const pct = stat.total ? Math.round((stat.done / stat.total) * 100) : 0;
            return (
              <div key={tag}>
                <div className="rankRow">
                  <span>{tag}</span>
                  <strong>{pct}%</strong>
                </div>
                <div className="progressTrack light">
                  <div className="progressFill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
