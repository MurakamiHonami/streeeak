import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createGoalAndBreakdown, deleteGoal, fetchGoals } from "../lib/api";

export function GoalsPage() {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const queryClient = useQueryClient();

  const goals = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });

  const breakdownMutation = useMutation({
    mutationFn: createGoalAndBreakdown,
    onSuccess: () => {
      setTitle("");
      setDeadline("");
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["weeklyTasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const canSubmit = title.trim().length > 0 && !breakdownMutation.isPending;

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    breakdownMutation.mutate({
      title: title.trim(),
      deadline: deadline || undefined,
    });
  };

  return (
    <section className="page">
      <section className="visionCard">
        <p className="chip">Goal Setup</p>
        <h2>長期目標をAIで12ヶ月分に分解</h2>
        <p className="mutedText">直近1ヶ月の週次、直近1週間の日次TODOまで自動生成します。</p>
      </section>

      <form className="card" onSubmit={handleCreateGoal}>
        <h3>長期目標を入力</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="長期目標を入力"
        />
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <button type="submit" disabled={!canSubmit}>
          {breakdownMutation.isPending ? "AIで生成中..." : "ブレイクダウンする"}
        </button>
        {breakdownMutation.isError && (
          <p style={{ color: "#c0392b", margin: 0 }}>
            ブレイクダウンに失敗しました。Geminiキーまたはバックエンドを確認してください。
          </p>
        )}
      </form>

      <div className="card">
        <h3>保存済みの長期目標</h3>
        {goals.data?.map((goal) => (
          <div key={goal.id} className="taskRow">
            <div>
              <p>{goal.title}</p>
              <small>{goal.deadline ?? "期限未設定"}</small>
            </div>
            <button
              onClick={() => {
                if (!window.confirm("この長期目標を削除しますか？")) return;
                deleteMutation.mutate(goal.id);
              }}
              style={{ background: "#dc2626", color: "#fff" }}
            >
              削除
            </button>
          </div>
        ))}
      </div>

      {breakdownMutation.data && (
        <>
          <div className="card">
            <p>
              生成元:{" "}
              <strong>
                {breakdownMutation.data.breakdown.source === "gemini"
                  ? "Gemini"
                  : "Fallback(テンプレート)"}
              </strong>
            </p>
          </div>

          <div className="card">
            <h3>12ヶ月プラン</h3>
            {breakdownMutation.data.breakdown.monthly.map((task: { title: string }, idx: number) => (
              <div key={idx} className="taskRow">
                <p>{task.title}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>直近1ヶ月の週次プラン</h3>
            {breakdownMutation.data.breakdown.weekly.map((task: { title: string }, idx: number) => (
              <div key={idx} className="taskRow">
                <p>{task.title}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>直近1週間のデイリーTODO</h3>
            {breakdownMutation.data.breakdown.daily.map(
              (task: { title: string; date?: string; note?: string }, idx: number) => (
              <div key={idx} className="taskRow">
                <div>
                  <p>{task.title}</p>
                  {task.note && (
                    <ul className="detailTodoList">
                      {task.note
                        .split("\n")
                        .map((line) => line.replace(/^- /, "").trim())
                        .filter(Boolean)
                        .map((line, detailIdx) => (
                          <li key={detailIdx}>{line}</li>
                        ))}
                    </ul>
                  )}
                </div>
                <small>{task.date ?? ""}</small>
              </div>
              )
            )}
            <p className="mutedText">作成された当日のTODOはホーム画面に表示されます。</p>
          </div>
        </>
      )}
    </section>
  );
}
