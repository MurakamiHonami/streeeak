import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyAcceptedRevisions,
  createGoalAndBreakdown,
  deleteGoal,
  fetchGoals,
  fetchGoalTasks,
  revisionChat,
} from "../lib/api";
import type { DraftTask, RevisionChatMessage, TaskRevisionProposal } from "../types";
import BackspaceIcon from '@mui/icons-material/Backspace';

type DisplayTask = DraftTask & { date?: string; month?: number; week_number?: number };

export function GoalsPage() {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [currentSituation, setCurrentSituation] = useState("");
  const [isGoalInputActive, setIsGoalInputActive] = useState(false);
  const [activeGoalId, setActiveGoalId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<RevisionChatMessage[]>([]);
  const [proposals, setProposals] = useState<TaskRevisionProposal[]>([]);
  const [decisionMap, setDecisionMap] = useState<Record<string, "accepted" | "rejected">>({});
  const queryClient = useQueryClient();

  const goals = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });
  
  const goalTasks = useQuery({
    queryKey: ["goalTasks", activeGoalId],
    queryFn: () => fetchGoalTasks(activeGoalId!),
    enabled: !!activeGoalId,
  });

  const breakdownMutation = useMutation({
    mutationFn: createGoalAndBreakdown,
    onSuccess: (data) => {
      setTitle("");
      setDeadline("");
      setActiveGoalId(data.goal.id);
      setChatHistory([]);
      setProposals([]);
      setDecisionMap({});
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["weeklyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["goalTasks", data.goal.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setActiveGoalId(null);
    },
  });

  const hasGoalAndDeadline = title.trim().length > 0 && deadline.trim().length > 0;
  const hasAllInputs = hasGoalAndDeadline && currentSituation.trim().length > 0;
  const canSubmit = hasAllInputs && !breakdownMutation.isPending;

  const toDraftTasks = (tasks: typeof goalTasks.data): DraftTask[] =>
    (tasks ?? []).map((task) => ({
      task_id: task.id,
      task_type: task.type,
      title: task.title,
      note: task.note,
      date: task.date,
      month: task.month,
      week_number: task.week_number,
      subtasks: task.note
        ? task.note
            .split("\n")
            .map((line: string) => line.replace(/^- /, "").trim())
            .filter(Boolean)
        : [],
    }));

  const appliedDraftTasks = useMemo(() => {
    const base = toDraftTasks(goalTasks.data);
    const accepted = proposals.filter((p) => decisionMap[p.proposal_id] === "accepted");
    for (const proposal of accepted) {
      const target = base.find((task) => task.task_id === proposal.target_task_id);
      if (!target) continue;
      if (proposal.target_type === "subtask" && proposal.subtask_index !== null) {
        if (proposal.subtask_index >= 0 && proposal.subtask_index < target.subtasks.length) {
          target.subtasks[proposal.subtask_index] = proposal.after;
          target.note = target.subtasks.map((x) => `- ${x}`).join("\n");
        }
      } else {
        target.title = proposal.after;
      }
    }
    return base;
  }, [goalTasks.data, proposals, decisionMap]);

  const monthlyTasks = appliedDraftTasks.filter((t) => t.task_type === "monthly");
  const weeklyTasks = appliedDraftTasks.filter((t) => t.task_type === "weekly");
  const dailyTasks = appliedDraftTasks.filter((t) => t.task_type === "daily");
  const yearlyTasks = monthlyTasks.filter((t) => t.title.startsWith("1年目の目標:") || t.title.includes("年目の目標:"));
  const monthlyPlanTasks = monthlyTasks.filter((t) => !t.title.includes("年目の目標:"));
  const dailyTasksByDate = useMemo(() => {
    const groups = new Map<string, DisplayTask[]>();
    for (const task of dailyTasks) {
      const key = task.note ?? "no-date";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(task);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "no-date") return 1;
      if (b === "no-date") return -1;
      return a.localeCompare(b);
    });
  }, [dailyTasks]);

  const formatDateLabel = (value: string) => {
    if (value === "no-date") return "日付未設定";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
  };

  const stripMonthPrefix = (title: string) =>
    title
      .replace(/^\d+\s*ヶ?月目[:：]?\s*/, "")
      .replace(/^\d+\s*ヶ?月後[:：]?\s*/, "");

  const stripWeekPrefix = (title: string) =>
    title
      .replace(/^\d+\s*週目[:：]?\s*/, "")
      .replace(/^\d+\s*週間目[:：]?\s*/, "")
      .replace(/^\d+\s*週後[:：]?\s*/, "")
      .replace(/^\d+\s*週間後[:：]?\s*/, "");

  const revisionMutation = useMutation({
    mutationFn: revisionChat,
    onSuccess: (data) => {
      setChatHistory((prev) => [...prev, { role: "assistant", content: data.assistant_message }]);
      setProposals((prev) => [...prev, ...data.proposals]);
    },
  });

  const applyMutation = useMutation({
    mutationFn: applyAcceptedRevisions,
    onSuccess: () => {
      if (!activeGoalId) return;
      queryClient.invalidateQueries({ queryKey: ["goalTasks", activeGoalId] });
      queryClient.invalidateQueries({ queryKey: ["dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["weeklyTasks"] });
      setProposals((prev) => prev.filter((p) => decisionMap[p.proposal_id] !== "accepted"));
      setDecisionMap((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key] === "accepted") delete next[key];
        }
        return next;
      });
    },
  });

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !deadline.trim() || !currentSituation.trim()) return;
    breakdownMutation.mutate({
      title: title.trim(),
      deadline: deadline || undefined,
      currentSituation: currentSituation.trim(),
    });
  };

  const handleSendRevisionChat = () => {
    if (!activeGoalId || !chatInput.trim()) return;
    const userMessage = chatInput.trim();
    const nextHistory = [...chatHistory, { role: "user" as const, content: userMessage }];
    setChatHistory(nextHistory);
    revisionMutation.mutate({
      goalId: activeGoalId,
      message: userMessage,
      draftTasks: appliedDraftTasks,
      chatHistory: nextHistory,
    });
    setChatInput("");
  };

  const acceptedProposals = proposals.filter((p) => decisionMap[p.proposal_id] === "accepted");

  return (
    <section className="page">
      <section className="visionCard">
        <p className="chip">Goal Setup</p>
        <h2>長期目標を期限ベースで分解</h2>
        <p className="mutedText">期限までの期間に合わせて、年次・月次・週次・日次の計画を自動生成します</p>
      </section>

      <form className="card flex flex-col items-center gap-2 p-2" onSubmit={handleCreateGoal}>
        {!activeGoalId ? (
          <>
            <h3 className="text-2xl text-center m-4 font-normal tracking-[0.1em] uppercase">長期目標を新規作成</h3>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setIsGoalInputActive(true)}
              onBlur={() => setIsGoalInputActive(false)}
              placeholder="長期目標を入力"
            />
            <input
              className="mb-4"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              onFocus={() => setIsGoalInputActive(true)}
              onBlur={() => setIsGoalInputActive(false)}
            />
            <div className="relative inline-flex flex-col items-center mt-6">
              <span
                className={[
                  "whitespace-nowrap rounded-lg bg-gray-800 mt-1 px-3 py-1.5",
                  "text-sm text-white shadow-md absolute -top-10 left-1/2",
                  "-translate-x-1/2 after:content-[''] after:absolute",
                  "after:top-full after:left-1/2 after:-translate-x-1/2",
                  "after:border-[6px] after:border-transparent after:border-t-gray-800",
                ].join(" ")}
              >
                {breakdownMutation.isPending
                  ? "君を夢へ導くよ！"
                  : hasAllInputs
                  ? "それじゃあ夢を叶えよう！"
                  : hasGoalAndDeadline
                  ? "今の状況を教えて！"
                  : isGoalInputActive
                  ? "目標を教えて！"
                  : "僕と相談しながら決めよう!"}
              </span>
              <img src="/panda.png" alt="Mentor Panda" className="h-20 object-contain drop-shadow-sm" />
            </div>
            {hasGoalAndDeadline && (
              <textarea
                value={currentSituation}
                onChange={(e) => setCurrentSituation(e.target.value)}
                placeholder="現状を入力"
                rows={3}
              />
            )}
            <button type="submit" className="hover:opacity-70 transition-all duration-200 ease-in-out hover:scale-110 active:scale-90" disabled={!canSubmit}>
              {breakdownMutation.isPending ? "AIで生成中..." : "ブレイクダウンする"}
            </button>
            
            {breakdownMutation.isPending && (
              <div className="flex flex-col items-center justify-center mt-6 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[#13ec37] opacity-20 animate-ping"></div>
                  <img 
                    src="/loading_panda.png" 
                    className="w-20 h-20 drop-shadow-lg relative z-10" 
                    alt="Loading Panda"
                    style={{ animation: 'spin 2s linear infinite' }}
                  />
                </div>
                <p className="mt-4 text-sm font-extrabold text-[#0fbf2c] tracking-widest" style={{ animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
                  考え中...
                </p>
              </div>
            )}
            
            {breakdownMutation.isError && (
              <p style={{ color: "#c0392b", margin: 0 }}>
                ブレイクダウンに失敗しました。Geminiキーまたはバックエンドを確認してください。
              </p>
            )}
          </>
        ) : (
          <>
            <h3 className="text-2xl text-center m-4 font-normal tracking-[0.1em] uppercase">目標の修正を相談する</h3>
            <div className="relative inline-flex flex-col items-center mt-6">
              <span
                className={[
                  "whitespace-nowrap rounded-lg bg-gray-800 mt-1 px-3 py-1.5",
                  "text-sm text-white shadow-md absolute -top-10 left-1/2",
                  "-translate-x-1/2 after:content-[''] after:absolute",
                  "after:top-full after:left-1/2 after:-translate-x-1/2",
                  "after:border-[6px] after:border-transparent after:border-t-gray-800",
                ].join(" ")}
              >
                修正が必要だったら言ってね！
              </span>
              <img src="/panda.png" alt="Mentor Panda" className="h-20 object-contain drop-shadow-sm" />
            </div>
            <p className="mutedText">選択中の目標に対して、修正依頼と提案の採用をこの画面で行えます。</p>
            <div className="chatBox">
              {chatHistory.map((msg, idx) => (
                <p key={idx}>
                  <strong>{msg.role === "user" ? "You" : "Gemini"}:</strong> {msg.content}
                </p>
              ))}
            </div>
            <div className="chatInputRow">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="例: 週次タスクをもっと具体化して"
              />
              <button type="button" onClick={handleSendRevisionChat} disabled={!chatInput.trim()}>
                送信
              </button>
            </div>
            {revisionMutation.isError && (
              <p style={{ color: "#c0392b", margin: 0 }}>提案生成に失敗しました。再試行してください。</p>
            )}

            <div className="proposalCard" style={{ background: "#f8faf8" }}>
              <h3 style={{ margin: 0 }}>修正提案（Accept / Reject）</h3>
              {!proposals.length && <p>提案待ちです。AIに修正依頼を送信してください。</p>}
              {proposals.map((proposal) => (
                <div key={proposal.proposal_id} className="proposalCard">
                  <p>
                    <strong>{proposal.target_type}</strong> / task_id: {proposal.target_task_id}
                  </p>
                  <p>理由: {proposal.reason}</p>
                  <p>Before: {proposal.before}</p>
                  <p>After: {proposal.after}</p>
                  <div className="rowActions">
                    <button
                      type="button"
                      onClick={() =>
                        setDecisionMap((prev) => ({ ...prev, [proposal.proposal_id]: "accepted" }))
                      }
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDecisionMap((prev) => ({ ...prev, [proposal.proposal_id]: "rejected" }))
                      }
                      style={{ background: "#475569", color: "#fff" }}
                    >
                      Reject
                    </button>
                  </div>
                  <small>
                    現在:{" "}
                    {decisionMap[proposal.proposal_id] === "accepted"
                      ? "Accepted"
                      : decisionMap[proposal.proposal_id] === "rejected"
                      ? "Rejected"
                      : "未選択"}
                  </small>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  applyMutation.mutate({
                    goalId: activeGoalId,
                    acceptedProposals,
                  })
                }
                disabled={!acceptedProposals.length}
              >
                Accept済み提案を反映
              </button>
            </div>
          </>
        )}
      </form>

      <div className="card flex flex-col items-center gap-2">
        <div style={{ flex: 1 }} className="flex flex-col items-center gap-2">
          <h3 className="text-2xl text-center m-4 font-normal tracking-[0.1em] uppercase">目標を確認</h3>
          <select
            value={activeGoalId ?? ""}
            onChange={(e) => {
              setActiveGoalId(e.target.value ? Number(e.target.value) : null);
              setChatHistory([]);
              setProposals([]);
            }}
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
          >
            <option value="">長期目標を選択してください</option>
            {goals.data?.map((goal: any) => (
              <option key={goal.id} value={goal.id}>
                {goal.title} {goal.deadline ? `(期限: ${goal.deadline})` : ""}
              </option>
            ))}
          </select>
        </div>
        {activeGoalId && (
          <button
            onClick={() => {
              if (!window.confirm("この長期目標を削除しますか？")) return;
              deleteMutation.mutate(activeGoalId);
            }}
            style={{ background: "#dc2626", color: "#fff", padding: "10px", margin: 0, width: "auto" }}
            title="この目標を削除"
          >
            <BackspaceIcon />
          </button>
        )}
      </div>

      {activeGoalId && goalTasks.data && (
        <>
          <div className="card">
            <h3 className="text-2xl text-center m-4 font-normal tracking-[0.1em] uppercase">プラン</h3>

            {yearlyTasks.length > 0 && (
              <section className="planUnit">
                <h4>年次プラン</h4>
                <div className="planScrollArea">
                  {yearlyTasks.map((task, idx) => (
                    <section key={task.task_id || idx}>
                      <p style={{ margin: "6px 0 8px", fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                        {idx + 1}年目
                      </p>
                      <div className="taskRow">
                        <p>{task.title}</p>
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            )}

            <section className="planUnit">
              <h4>{monthlyPlanTasks.length > 0 ? `${monthlyPlanTasks.length}ヶ月プラン` : "月次プラン"}</h4>
              {monthlyPlanTasks.length === 0 && <p className="mutedText">タスクがありません</p>}
              {monthlyPlanTasks.length > 0 && (
                <div className="planScrollArea">
                  {monthlyPlanTasks.map((task, idx) => (
                    <div key={task.task_id || idx}>
                      <p style={{ margin: "6px 0 8px", fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                        {idx + 1}ヶ月目
                      </p>
                      <div className="taskRow">
                        <p>{stripMonthPrefix(task.title)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="planUnit">
              <h4>{weeklyTasks.length === 4 ? "直近1ヶ月の週次プラン" : `${weeklyTasks.length}週間の週次プラン`}</h4>
              {weeklyTasks.length === 0 && <p className="mutedText">タスクがありません</p>}
              {weeklyTasks.length > 0 && (
                <div className="planScrollArea">
                  {weeklyTasks.map((task, idx) => (
                    <section key={task.task_id || idx}>
                      <p style={{ margin: "6px 0 8px", fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                        {idx + 1}週目
                      </p>
                      <div className="taskRow">
                        <p>{stripWeekPrefix(task.title)}</p>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>

            <section className="planUnit">
              <h4>直近1週間のTODO</h4>
              {dailyTasks.length === 0 && <p className="mutedText">タスクがありません</p>}
              {dailyTasksByDate.length > 0 && (
                <div className="planScrollArea">
                  {dailyTasksByDate.map(([dateKey, tasks]) => (
                    <section key={dateKey}>
                      <p style={{ margin: "6px 0 8px", fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                        {formatDateLabel(dateKey)}
                      </p>
                      {tasks.map((task, idx) => (
                        <div key={task.task_id || `${dateKey}-${idx}`} className="taskRow">
                          <div>
                            <p>{task.title}</p>
                            {task.subtasks && task.subtasks.length > 0 && (
                              <ul className="detailTodoList">
                                {task.subtasks.map((line, detailIdx) => (
                                  <li key={detailIdx}>{line}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              )}
              <p className="mutedText">縦にスクロールして確認できます。</p>
              <p className="mutedText">作成された当日のTODOはホーム画面に表示されます。</p>
            </section>
          </div>
        </>
      )}
    </section>
  );
}