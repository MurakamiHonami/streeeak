import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { carryOverTask, fetchDailyTasks, fetchRanking, toggleTaskDone } from "../lib/api";

export function HomePage() {
  const queryClient = useQueryClient();
  const dailyTasks = useQuery({ queryKey: ["dailyTasks"], queryFn: fetchDailyTasks });
  const ranking = useQuery({ queryKey: ["ranking"], queryFn: fetchRanking });

  const doneMutation = useMutation({
    mutationFn: toggleTaskDone,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dailyTasks"] }),
  });
  const carryOverMutation = useMutation({
    mutationFn: carryOverTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dailyTasks"] }),
  });

  const tasks = dailyTasks.data ?? [];
  const doneCount = tasks.filter((task) => task.is_done).length;
  const firstPendingId = tasks.find((task) => !task.is_done)?.id;
  const doneRate = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <section className="page">
      <section className="visionCard">
        <p className="chip">Long-term Vision</p>
        <h2>毎日の積み上げで理想のキャリアに近づく</h2>
        <p className="mutedText">今日の達成率: {doneRate}%</p>
        <div className="progressTrack">
          <div className="progressFill" style={{ width: `${doneRate}%` }} />
        </div>
      </section>

      <div className="statsGrid">
        <div className="statCard">
          <p className="statLabel">Tasks Done</p>
          <p className="statValue">
            {doneCount} <span>/ {tasks.length}</span>
          </p>
        </div>
        <div className="statCard">
          <p className="statLabel">Top Rank</p>
          <p className="statValue">{ranking.data?.[0] ? "TOP" : "-"}</p>
        </div>
      </div>

      <section className="card">
        <div className="sectionHead">
          <h3>Today's Focus</h3>
        </div>
        {tasks.length ? (
          tasks.map((task) => (
            <div
              key={task.id}
              className={
                firstPendingId === task.id && !task.is_done ? "taskRow nextTask" : "taskRow"
              }
            >
              <div>
                <p className={task.is_done ? "done" : ""}>{task.title}</p>
                <small>{task.tags ?? "タグなし"}</small>
                {task.note && (
                  <ul className="detailTodoList">
                    {task.note
                      .split("\n")
                      .map((line) => line.replace(/^- /, "").trim())
                      .filter(Boolean)
                      .slice(0, 3)
                      .map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                  </ul>
                )}
              </div>
              <div className="rowActions">
                <button onClick={() => doneMutation.mutate(task.id)}>
                  {task.is_done ? "取消" : "チェック"}
                </button>
                {!task.is_done && (
                  <button onClick={() => carryOverMutation.mutate(task.id)}>持ち越し</button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p>今日のタスクはありません。</p>
        )}
      </section>

      <section className="card">
        <div className="sectionHead">
          <h3>Friend Ranking (TOP3)</h3>
        </div>
        {ranking.data?.length ? (
          ranking.data.map((item, index) => (
            <div key={item.user_id} className="rankRow">
              <span>#{index + 1}</span>
              <span>{item.user_name}</span>
              <strong>{(item.achieved_avg * 100).toFixed(1)}%</strong>
            </div>
          ))
        ) : (
          <p>ランキングデータがありません。</p>
        )}
      </section>
    </section>
  );
}
