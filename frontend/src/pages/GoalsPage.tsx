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
import EditIcon from '@mui/icons-material/Edit';
import BackspaceIcon from '@mui/icons-material/Backspace';

export function GoalsPage() {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
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
    },
  });

  const canSubmit = title.trim().length > 0 && !breakdownMutation.isPending;

  const toDraftTasks = (tasks: typeof goalTasks.data): DraftTask[] =>
    (tasks ?? []).map((task) => ({
      task_id: task.id,
      task_type: task.type,
      title: task.title,
      note: task.note,
      subtasks: task.note
        ? task.note
            .split("\n")
            .map((line) => line.replace(/^- /, "").trim())
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
    if (!title.trim()) return;
    breakdownMutation.mutate({
      title: title.trim(),
      deadline: deadline || undefined,
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

  const latestGoal = goals.data && goals.data.length > 0 
    ? goals.data[goals.data.length - 1] 
    : null;
  return (
    <section className="page">
      <section className="visionCard">
        <p className="chip">Goal Setup</p>
        <h2>長期目標をAIで12ヶ月分に分解</h2>
        <p className="mutedText">メンターAIと相談して、直近1ヶ月の週次、直近1週間の日次TODOを設定しましょう</p>
      </section>

      <form className="card" onSubmit={handleCreateGoal}>
        <h3 className="font-medium text-2xl">長期目標を入力</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="長期目標を入力"
        />
        <input className="mb-4"type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <div className="relative inline-flex flex-col items-center mt-6">
          <span
            className={[
              "whitespace-nowrap",
              "rounded-lg",
              "bg-gray-800",
              "mt-1",
              "px-3",
              "py-1.5",
              "text-sm",
              "text-white",
              "shadow-md",
              "absolute",
              "-top-10",
              "left-1/2",
              "-translate-x-1/2",
              "after:content-['']",
              "after:absolute",
              "after:top-full",
              "after:left-1/2",
              "after:-translate-x-1/2",
              "after:border-[6px]",
              "after:border-transparent",
              "after:border-t-gray-800",
            ].join(" ")}
          >
            僕と相談しながら決めよう!
          </span>
          <img src="/panda.png" alt="Mentor Panda" className="h-20 object-contain drop-shadow-sm" />
        </div>
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
        <h3 className="font-medium text-2xl">保存済みの長期目標</h3>
        {goals.data?.map((goal) => (
          <div key={goal.id} className="taskRow">
            <div>
              <p>{goal.title}</p>
              <small>{goal.deadline ?? "期限未設定"}</small>
            </div>
            <div className="rowActions">
              <button onClick={() => setActiveGoalId(goal.id)}>{<EditIcon/>}</button>
              <button
                onClick={() => {
                  if (!window.confirm("この長期目標を削除しますか？")) return;
                  deleteMutation.mutate(goal.id);
                }}
                style={{ background: "#dc2626", color: "#fff" }}
              >
                {<BackspaceIcon/>}
              </button>
            </div>
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

      {activeGoalId && (
        <>
          <div className="card">
            <h3>修正を依頼する</h3>
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
              <button onClick={handleSendRevisionChat} disabled={!chatInput.trim()}>
                送信
              </button>
            </div>
            {revisionMutation.isError && (
              <p style={{ color: "#c0392b", margin: 0 }}>提案生成に失敗しました。再試行してください。</p>
            )}
          </div>

          <div className="card">
            <h3>修正提案（Accept / Reject）</h3>
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
                    onClick={() =>
                      setDecisionMap((prev) => ({ ...prev, [proposal.proposal_id]: "accepted" }))
                    }
                  >
                    Accept
                  </button>
                  <button
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
    </section>
  );
}
