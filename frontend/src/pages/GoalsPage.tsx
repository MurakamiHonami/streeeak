import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import Dialog from "@mui/material/Dialog";
import Fade from "@mui/material/Fade";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import {
  applyAcceptedRevisions,
  createTask,
  createGoalAndBreakdown,
  deleteTask,
  deleteGoal,
  fetchGoals,
  fetchGoalTasks,
  revisionChat,
  updateTask,
  appContext
} from "../lib/api";

import type { 
  RevisionChatMessage, 
  TaskRevisionProposal,
} from "../types";
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';

type PlanTab = "yearly" | "monthly" | "weekly" | "daily";

const COLUMNS = [
  { id: "todo", label: "📋 未着手", color: "#6366f1" },
  { id: "in_progress", label: "⚡ 進行中", color: "#f59e0b" },
  { id: "done", label: "✅ 完了", color: "#10b981" },
];

const PRIORITY = {
  high: { label: "高", color: "#ef4444" },
  mid: { label: "中", color: "#eab308" },
  low: { label: "低", color: "#10b981" },
};

const PRIORITY_ORDER = { high: 0, mid: 1, low: 2 } as const;

type DraftTaskKanban = {
  task_id: number;
  task_type: string;
  title: string;
  note: string | null;
  date: string | null;
  month: number | null;
  week_number: number | null;
  subtasks: string[];
  status: "todo" | "in_progress" | "done";
  priority: "high" | "mid" | "low";
};

export function GoalsPage() {
  const location = useLocation();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [currentSituation, setCurrentSituation] = useState("");
  const [isGoalInputActive, setIsGoalInputActive] = useState(false);
  const [activeGoalId, setActiveGoalId] = useState<number | null>(null);
  
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<RevisionChatMessage[]>([]);
  const [proposals, setProposals] = useState<TaskRevisionProposal[]>([]);
  const [decisionMap, setDecisionMap] = useState<Record<string, "accepted" | "rejected">>({});
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [goalSectionTab, setGoalSectionTab] = useState<"create" | "review">("review");
  const [planTab, setPlanTab] = useState<PlanTab>("yearly");
  
  const [kanbanInput, setKanbanInput] = useState("");
  const [kanbanPriority, setKanbanPriority] = useState<"high" | "mid" | "low">("mid");
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddTaskClosing, setIsAddTaskClosing] = useState(false);
  const [isAddTaskPinned, setIsAddTaskPinned] = useState(false);
  const [activeCol, setActiveCol] = useState(0);
  const kanbanScrollRef = useRef<HTMLDivElement | null>(null);
  const addTaskWrapRef = useRef<HTMLDivElement | null>(null);
  const addTaskPanelRef = useRef<HTMLDivElement | null>(null);
  const addTaskButtonRef = useRef<HTMLButtonElement | null>(null);

  const goalSectionPrevTabRef = useRef<"create" | "review">("review");
  const planPrevTabRef = useRef<PlanTab>("yearly");
  const lastInitializedGoalIdRef = useRef<number | null>(null);
  const proposalRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const queryClient = useQueryClient();

  const goals = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });
  const goalOptions = goals.data ?? [];
  
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
      setGoalSectionTab("review");
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

  const toDraftTasks = (tasks: any[]): DraftTaskKanban[] =>
    (tasks ?? []).map((task) => ({
      task_id: task.id,
      task_type: task.type,
      title: task.title,
      note: task.note,
      date: task.date,
      month: task.month,
      week_number: task.week_number,
      status: task.status || "todo",
      priority: task.priority || "mid",
      subtasks: task.note
        ? task.note
            .split("\n")
            .map((line: string) => line.replace(/^- /, "").trim())
            .filter(Boolean)
        : [],
    }));

  const appliedDraftTasks = useMemo(() => {
    const base = toDraftTasks(goalTasks.data ?? []);
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
  const yearlyTasks = monthlyTasks.filter((t) => t.title.startsWith("1年目の目標:") || t.title.includes("年目の目標:"));
  const monthlyPlanTasks = monthlyTasks.filter((t) => !t.title.includes("年目の目標:"));
  const dailyTasks = appliedDraftTasks.filter((t) => t.task_type === "daily");

  const taskDisplayOrder = useMemo(() => {
    return appliedDraftTasks.map(t => t.task_id);
  }, [appliedDraftTasks]);

  const goalSectionTabIndex = goalSectionTab === "review" ? 0 : 1;
  const previousGoalSectionTabIndex = goalSectionPrevTabRef.current === "review" ? 0 : 1;
  const goalSectionTransitionClass =
    goalSectionTabIndex > previousGoalSectionTabIndex
      ? "goalSectionTransitionForward"
      : goalSectionTabIndex < previousGoalSectionTabIndex
      ? "goalSectionTransitionBackward"
      : "goalSectionTransitionNeutral";

  const availablePlanTabs = useMemo<PlanTab[]>(() => {
    const tabs: PlanTab[] = [];
    if (yearlyTasks.length > 0) tabs.push("yearly");
    if (monthlyPlanTasks.length > 0) tabs.push("monthly");
    if (weeklyTasks.length > 0) tabs.push("weekly");
    if (dailyTasks.length > 0) tabs.push("daily");
    if (tabs.length === 0) tabs.push("monthly");
    return tabs;
  }, [yearlyTasks.length, monthlyPlanTasks.length, weeklyTasks.length, dailyTasks.length]);
  
  const planTabIndex = Math.max(0, availablePlanTabs.indexOf(planTab));
  const previousPlanTabIndex = Math.max(0, availablePlanTabs.indexOf(planPrevTabRef.current));
  const planTransitionClass =
    planTabIndex > previousPlanTabIndex
      ? "planContentTransitionForward"
      : planTabIndex < previousPlanTabIndex
      ? "planContentTransitionBackward"
      : "planContentTransitionNeutral";

  const revisionMutation = useMutation({
    mutationFn: revisionChat,
    onSuccess: (data) => {
      setChatHistory((prev) => [...prev, { role: "assistant", content: data.assistant_message }]);
      setProposals((prev) => {
        const incomingByTaskId = new Map<number, TaskRevisionProposal>();
        for (const proposal of data.proposals) {
          incomingByTaskId.set(proposal.target_task_id, proposal);
        }
        const kept = prev.filter((p) => !incomingByTaskId.has(p.target_task_id));
        return [...kept, ...incomingByTaskId.values()];
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: applyAcceptedRevisions,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goalTasks", variables.goalId] });
      queryClient.invalidateQueries({ queryKey: ["dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["weeklyTasks"] });
      const appliedIds = new Set(variables.acceptedProposals.map((p) => p.proposal_id));
      setProposals((prev) => prev.filter((p) => !appliedIds.has(p.proposal_id)));
      setDecisionMap((prev) => {
        const next = { ...prev };
        for (const id of appliedIds) {
          delete next[id];
        }
        return next;
      });
    },
  });

  const updateTaskDetailsMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: any }) =>
      updateTask(taskId, payload),
    onSuccess: () => {
      if (!activeGoalId) return;
      queryClient.invalidateQueries({ queryKey: ["goalTasks", activeGoalId] });
      queryClient.invalidateQueries({ queryKey: ["dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["weeklyTasks"] });
    },
  });

  const addKanbanTaskMutation = useMutation({
    mutationFn: (payload: any) => createTask(payload),
    onSuccess: () => {
      if (!activeGoalId) return;
      queryClient.invalidateQueries({ queryKey: ["goalTasks", activeGoalId] });
      setKanbanInput("");
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => deleteTask(taskId),
    onSuccess: () => {
      if (!activeGoalId) return;
      queryClient.invalidateQueries({ queryKey: ["goalTasks", activeGoalId] });
      queryClient.invalidateQueries({ queryKey: ["dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["weeklyTasks"] });
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
      draftTasks: appliedDraftTasks as any,
      chatHistory: nextHistory,
    });
    setChatInput("");
  };

  const scrollToProposal = (proposalId: string) => {
    const target = proposalRefs.current[proposalId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToNextProposal = (
    currentProposalId: string,
    nextDecisionMap: Record<string, "accepted" | "rejected">,
  ) => {
    const currentIndex = orderedProposalIds.findIndex((id) => id === currentProposalId);
    if (currentIndex < 0) return;

    let nextIdToFocus: string | null = null;
    for (let i = currentIndex + 1; i < orderedProposalIds.length; i += 1) {
      if (!nextDecisionMap[orderedProposalIds[i]]) {
        nextIdToFocus = orderedProposalIds[i];
        break;
      }
    }
    if (!nextIdToFocus) {
      for (let i = 0; i < currentIndex; i += 1) {
        if (!nextDecisionMap[orderedProposalIds[i]]) {
          nextIdToFocus = orderedProposalIds[i];
          break;
        }
      }
    }

    if (nextIdToFocus) {
      const nextProposal = proposals.find((p) => p.proposal_id === nextIdToFocus);
      const targetTask = appliedDraftTasks.find((t) => t.task_id === nextProposal?.target_task_id);

      if (targetTask) {
        let targetTab: PlanTab = targetTask.task_type as PlanTab;
        if (targetTask.task_type === "monthly" && targetTask.title.includes("年目の目標:")) {
          targetTab = "yearly";
        }
        if (planTab !== targetTab) {
          setPlanTab(targetTab);
          setTimeout(() => {
            scrollToProposal(nextIdToFocus!);
          }, 300);
        } else {
          scrollToProposal(nextIdToFocus!);
        }
      } else {
        scrollToProposal(nextIdToFocus!);
      }
    }
  };

  const handleProposalDecision = (proposal: TaskRevisionProposal, decision: "accepted" | "rejected") => {
    const nextDecisionMap = { ...decisionMap, [proposal.proposal_id]: decision };
    setDecisionMap(nextDecisionMap);
    scrollToNextProposal(proposal.proposal_id, nextDecisionMap);
    
    if (decision === "accepted" && activeGoalId) {
      applyMutation.mutate(
        { goalId: activeGoalId, acceptedProposals: [proposal] },
        {
          onError: () => {
            setDecisionMap((prev) => {
              const rollback = { ...prev };
              delete rollback[proposal.proposal_id];
              return rollback;
            });
          },
        }
      );
    }
  };

  const handleProposalReset = (proposalId: string) => {
    const nextDecisionMap = { ...decisionMap };
    delete nextDecisionMap[proposalId];
    setDecisionMap(nextDecisionMap);
    requestAnimationFrame(() => scrollToProposal(proposalId));
  };

  const proposalsByTaskId = useMemo(() => {
    const map = new Map<number, TaskRevisionProposal>();
    for (const proposal of proposals) {
      map.set(proposal.target_task_id, proposal);
    }
    return map;
  }, [proposals]);

  const orderedProposalIds = useMemo(() => {
    const ids: string[] = [];
    for (const taskId of taskDisplayOrder) {
      const proposal = proposalsByTaskId.get(taskId);
      if (proposal && !ids.includes(proposal.proposal_id)) {
        ids.push(proposal.proposal_id);
      }
    }
    for (const proposal of proposals) {
      if (!ids.includes(proposal.proposal_id)) {
        ids.push(proposal.proposal_id);
      }
    }
    return ids;
  }, [taskDisplayOrder, proposalsByTaskId, proposals]);

  const getTaskTitleStyle = (taskId?: number) => {
    if (!taskId) return undefined;
    const proposal = proposalsByTaskId.get(taskId);
    if (!proposal) return undefined;
    if (decisionMap[proposal.proposal_id] === "accepted") {
      return { background: "#dcfce7", border: "1px solid #86efac", borderRadius: "8px", padding: "8px" };
    }
    return undefined;
  };

  const renderTaskProposalReview = (taskId?: number) => {
    if (!taskId) return null;
    const proposal = proposalsByTaskId.get(taskId);
    if (!proposal) return null;
    const decision = decisionMap[proposal.proposal_id];

    if (decision) {
      return (
        <div style={{ marginTop: "8px", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => handleProposalReset(proposal.proposal_id)} style={{ background: "#94a3b8", color: "#0f172a", margin: 0, width: "auto", padding: "6px 10px" }}>
            戻る
          </button>
        </div>
      );
    }

    return (
      <div className="proposalCard" style={{ marginTop: "8px", background: "#f8faf8", width: "100%", boxSizing: "border-box" }} ref={(el) => { proposalRefs.current[proposal.proposal_id] = el; }}>
        <div style={{ background: "#fee2e2", color: "#7f1d1d", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px", marginBottom: "8px" }}>
          <small style={{ display: "block", fontWeight: 700, marginBottom: "4px" }}>Before</small>
          <p style={{ margin: 0, fontSize: "14px" }}>{proposal.before}</p>
        </div>
        <div style={{ background: "#dcfce7", color: "#14532d", border: "1px solid #86efac", borderRadius: "8px", padding: "8px" }}>
          <small style={{ display: "block", fontWeight: 700, marginBottom: "4px" }}>After</small>
          <p style={{ margin: 0, fontSize: "14px" }}>{proposal.after}</p>
        </div>
        <div className="rowActions" style={{ marginTop: "8px" }}>
          <button type="button" onClick={() => handleProposalDecision(proposal, "accepted")}>Accept</button>
          <button type="button" onClick={() => handleProposalDecision(proposal, "rejected")} style={{ background: "#475569", color: "#fff" }}>Reject</button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!orderedProposalIds.length) return;
    const firstUndecidedId = orderedProposalIds.find((id) => !decisionMap[id]);
    if (!firstUndecidedId) return;
    requestAnimationFrame(() => scrollToProposal(firstUndecidedId));
  }, [orderedProposalIds, decisionMap]);

  useEffect(() => {
    if (!availablePlanTabs.includes(planTab)) {
      setPlanTab(availablePlanTabs[0] || "monthly");
    }
  }, [availablePlanTabs, planTab]);

  useEffect(() => {
    if (!activeGoalId) {
      lastInitializedGoalIdRef.current = null;
      return;
    }
    if (!goalTasks.data) return;
    if (lastInitializedGoalIdRef.current !== activeGoalId) {
      setPlanTab(availablePlanTabs[0] || "monthly");
      lastInitializedGoalIdRef.current = activeGoalId;
    }
  }, [activeGoalId, goalTasks.data, availablePlanTabs]);

  useEffect(() => { planPrevTabRef.current = planTab; }, [planTab]);
  useEffect(() => { goalSectionPrevTabRef.current = goalSectionTab; }, [goalSectionTab]);

  useEffect(() => {
    if (goalSectionTab !== "review") return;
    if (goalOptions.length === 0) {
      setActiveGoalId(null);
      return;
    }
    if (!activeGoalId || !goalOptions.some((goal: any) => goal.id === activeGoalId)) {
      setActiveGoalId(goalOptions[0].id);
    }
  }, [goalSectionTab, goalOptions, activeGoalId]);

  useEffect(() => {
    const requestedTab = (location.state as any)?.goalSectionTab;
    if (requestedTab === "create" || requestedTab === "review") {
      setGoalSectionTab(requestedTab);
    }
  }, [location.state]);


  const currentTasksToDisplay = useMemo(() => {
    switch (planTab) {
      case "yearly": return yearlyTasks;
      case "monthly": return monthlyPlanTasks;
      case "weekly": return weeklyTasks;
      case "daily": return dailyTasks;
      default: return [];
    }
  }, [planTab, yearlyTasks, monthlyPlanTasks, weeklyTasks, dailyTasks]);

  const currentMonth = useMemo(() => {
    const [y, m] = (appContext.today || "").split("-").map(Number);
    return typeof m === "number" ? m : new Date().getMonth() + 1;
  }, [appContext.today]);

  const isCurrentPeriod = (task: DraftTaskKanban): boolean => {
    switch (planTab) {
      case "yearly":
        return task.title.includes("1年目");
      case "monthly":
        return task.month === currentMonth;
      case "weekly":
        return task.week_number === appContext.week;
      default:
        return true;
    }
  };

  const handleAddKanbanTask = () => {
    if (!kanbanInput.trim() || !activeGoalId) return;
    
    let type = "daily";
    if (planTab === "yearly" || planTab === "monthly") type = "monthly";
    if (planTab === "weekly") type = "weekly";

    addKanbanTaskMutation.mutate({
      goalId: activeGoalId,
      type,
      title: kanbanInput.trim(),
      status: "todo",
      priority: kanbanPriority,
      date: planTab === "daily" ? appContext.today : null,
      weekNumber: planTab === "weekly" || planTab === "daily" ? appContext.week : null,
    });
  };

  const moveTaskStatus = (taskId: number, newColId: string) => {
    updateTaskDetailsMutation.mutate({ taskId, payload: { status: newColId } });
  };

  const saveEditingTask = (taskId: number) => {
    if (!editingTaskTitle.trim()) return;
    updateTaskDetailsMutation.mutate({ taskId, payload: { title: editingTaskTitle.trim() } });
    setEditingTaskId(null);
  };

  const periodLabel = planTab === "weekly" ? "今週" : planTab === "monthly" ? "今月" : "今年";

  const renderTaskCard = (task: DraftTaskKanban, col: typeof COLUMNS[0], options?: { grayed?: boolean }) => {
    const grayed = options?.grayed ?? false;
    const isDailyView = planTab === "daily";
    const leftBorderColor = isDailyView ? PRIORITY[task.priority].color : (grayed ? "#94a3b8" : "#13ec37");
    return (
      <div
        key={task.task_id}
        style={{
          background: grayed ? "#f1f5f9" : "#fff",
          border: "1px solid #e2e8f0",
          borderLeft: `5px solid ${leftBorderColor}`,
          borderRadius: 12, padding: "14px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          opacity: grayed ? 0.85 : 1,
        }}
      >
        {editingTaskId === task.task_id ? (
          <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
            <input
              autoFocus
              value={editingTaskTitle}
              onChange={e => setEditingTaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveEditingTask(task.task_id); if (e.key === "Escape") setEditingTaskId(null); }}
              style={{ width: "100%", boxSizing: "border-box", border: "2px solid #13ec37", borderRadius: 8, padding: "8px 10px", fontSize: 14, outline: "none" }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => saveEditingTask(task.task_id)} style={{ flex: 1, background: "#10b981", border: "none", borderRadius: 8, color: "#fff", padding: "8px", fontWeight: 700, cursor: "pointer" }}>保存</button>
              <button type="button" onClick={() => setEditingTaskId(null)} style={{ flex: 1, background: "#94a3b8", border: "none", borderRadius: 8, color: "#fff", padding: "8px", fontWeight: 700, cursor: "pointer" }}>キャンセル</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                {planTab === "daily" && task.date && (
                  <span style={{ display: "inline-block", background: "#f1f5f9", color: "#475569", fontSize: "10px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", marginBottom: "4px" }}>
                    {new Date(task.date).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                  </span>
                )}
                <span
                  style={{
                    display: "block", fontSize: 15, fontWeight: 700, lineHeight: 1.4,
                    color: col.id === "done" ? "#94a3b8" : "#0f1f10",
                    textDecoration: col.id === "done" ? "line-through" : "none",
                    ...(getTaskTitleStyle(task.task_id) ?? {}),
                  }}
                  onClick={() => { setEditingTaskId(task.task_id); setEditingTaskTitle(task.title.replace(/^\d+.*?[:：]\s*/, "")); }}
                >
                  {task.title}
                </span>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button type="button" onClick={() => { setEditingTaskId(task.task_id); setEditingTaskTitle(task.title.replace(/^\d+.*?[:：]\s*/, "")); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18, padding: "2px" }}><EditIcon /></button>
                <button type="button" onClick={() => { if (window.confirm("削除しますか？")) deleteTaskMutation.mutate(task.task_id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18, padding: "2px" }}><DeleteIcon /></button>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {isDailyView ? (
                <select
                  value={task.priority}
                  onChange={(e) => updateTaskDetailsMutation.mutate({ taskId: task.task_id, payload: { priority: e.target.value } })}
                  style={{
                    fontSize: 11,
                    color: PRIORITY[task.priority].color,
                    fontWeight: 800,
                    background: `${PRIORITY[task.priority].color}20`,
                    padding: "4px 8px",
                    borderRadius: "12px",
                    border: "none",
                    cursor: "pointer",
                    outline: "none",
                    appearance: "none",
                    textAlign: "center",
                  }}
                >
                  {Object.entries(PRIORITY).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}優先</option>
                  ))}
                </select>
              ) : (
                isCurrentPeriod(task) ? (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#13ec37",
                      fontWeight: 800,
                      background: "rgba(19, 236, 55, 0.125)",
                      padding: "4px 8px",
                      borderRadius: "12px",
                    }}
                  >
                    {periodLabel}
                  </span>
                ) : null
              )}
              {isDailyView && (
                <div style={{ display: "flex", gap: 6 }}>
                  {COLUMNS.filter(c => c.id !== col.id).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => moveTaskStatus(task.task_id, c.id)}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, border: `1px solid ${c.color}`, background: "none", color: c.color, cursor: "pointer", fontWeight: 800, transition: "all 0.2s" }}
                    >
                      → {c.label.split(" ")[1]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {renderTaskProposalReview(task.task_id)}
      </div>
    );
  };

  const renderPlanList = () => {
    const sorted = [...currentTasksToDisplay].sort(
      (a, b) => COLUMNS.findIndex(c => c.id === a.status) - COLUMNS.findIndex(c => c.id === b.status) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", background: "#f8faf8", borderRadius: "16px", overflow: "hidden", marginTop: "16px", padding: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((task) => renderTaskCard(task, COLUMNS.find(c => c.id === task.status) ?? COLUMNS[0], { grayed: !isCurrentPeriod(task) }))}
        </div>
        {sorted.length === 0 && (
          <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 14, fontWeight: 700, paddingTop: 32, paddingBottom: 32 }}>
            タスクがありません
          </div>
        )}
      </div>
    );
  };

  const closeAddTaskPanel = () => {
    if (isAddTaskClosing) return;
    setIsAddTaskClosing(true);
  };

  useEffect(() => {
    if (!isAddTaskClosing) return;
    const t = setTimeout(() => {
      setIsAddTaskOpen(false);
      setIsAddTaskPinned(false);
      setIsAddTaskClosing(false);
    }, 220);
    return () => clearTimeout(t);
  }, [isAddTaskClosing]);

  const handleAddKanbanSubmit = () => {
    handleAddKanbanTask();
    if (kanbanInput.trim()) {
      setKanbanInput("");
      closeAddTaskPanel();
    }
  };

  const handleAddTaskButtonClick = () => {
    if (isAddTaskOpen) {
      closeAddTaskPanel();
    } else {
      setIsAddTaskOpen(true);
      setIsAddTaskPinned(true);
    }
  };

  useEffect(() => {
    if (!isAddTaskOpen || isAddTaskClosing) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const insidePanel = addTaskPanelRef.current?.contains(target);
      const onAddTaskButton = addTaskButtonRef.current?.contains(target);
      if (!insidePanel && !onAddTaskButton) closeAddTaskPanel();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isAddTaskOpen, isAddTaskClosing]);

  const renderKanbanBoard = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", background: "#f8faf8", borderRadius: "16px", overflow: "hidden", marginTop: "16px" }}>
        <div
          ref={addTaskWrapRef}
          style={{ padding: "16px", background: "#fff", borderBottom: "1px solid #e2e8f0", position: "relative" }}
        >
          <button
            ref={addTaskButtonRef}
            type="button"
            onClick={handleAddTaskButtonClick}
            style={{
              padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8faf8",
              color: "#0f1f10", fontSize: 15, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.06)", transition: "all 0.2s",
            }}
          >
            タスク追加
          </button>
          {isAddTaskOpen && (
            <div
              ref={addTaskPanelRef}
              style={{
                position: "absolute",
                top: "100%",
                left: 16,
                right: 16,
                marginTop: 8,
                padding: "14px",
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 12px 32px rgba(0,0,0,0.16)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                zIndex: 10,
                animation: isAddTaskClosing
                  ? "addTaskPanelFloatOut 0.22s ease-in forwards"
                  : "addTaskPanelFloatIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <input
                value={kanbanInput}
                onChange={e => setKanbanInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddKanbanSubmit(); if (e.key === "Escape") closeAddTaskPanel(); }}
                placeholder="新しいタスクを入力..."
                style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8faf8", color: "#0f1f10", fontSize: 15, outline: "none" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={kanbanPriority}
                  onChange={e => setKanbanPriority(e.target.value as any)}
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8faf8", color: "#0f1f10", fontSize: 14, cursor: "pointer", fontWeight: 600 }}
                >
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}優先度</option>)}
                </select>
                <button
                  onClick={handleAddKanbanSubmit}
                  disabled={addKanbanTaskMutation.isPending}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#13ec37", color: "#0f1f10", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 10px rgba(19,236,55,0.2)" }}
                >
                  ＋ 追加
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", padding: "12px 16px 8px", gap: 8, background: "#fff" }}>
          {COLUMNS.map((col, i) => {
            const count = currentTasksToDisplay.filter(t => t.status === col.id).length;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => {
                  setActiveCol(i);
                  const el = kanbanScrollRef.current;
                  if (el) {
                    const left = i * el.offsetWidth;
                    el.scrollTo({ left, behavior: "smooth" });
                  }
                }}
                style={{
                  flex: 1, padding: "8px 4px", borderRadius: 8, border: "none",
                  background: activeCol === i ? col.color : "#f1f5f9",
                  color: activeCol === i ? "#fff" : "#64748b",
                  fontWeight: 800, fontSize: 12, cursor: "pointer", transition: "all 0.2s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}
              >
                <span>{col.label.split(" ")[1]}</span>
                <span style={{ fontSize: 16, fontWeight: 900 }}>{count}</span>
              </button>
            );
          })}
        </div>

        <div
          ref={kanbanScrollRef}
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const idx = Math.round(target.scrollLeft / target.offsetWidth);
            setActiveCol(idx);
          }}
          style={{
            display: "flex", overflowX: "scroll", scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch", scrollbarWidth: "none", flex: 1,
          }}
        >
          {COLUMNS.map((col) => {
            const colTasks = currentTasksToDisplay
              .filter(t => t.status === col.id)
              .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

            return (
              <div key={col.id} style={{ minWidth: "100%", scrollSnapAlign: "start", padding: "8px 16px 24px", boxSizing: "border-box" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {colTasks.map(task => renderTaskCard(task, col))}
                  {colTasks.length === 0 && (
                    <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 14, fontWeight: 700, paddingTop: 32, paddingBottom: 32 }}>
                      タスクがありません
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="page">
      <section className="visionCard">
        <p className="chip">Goal Setup</p>
        <h2>長期目標を期限ベースで分解</h2>
        <p className="mutedText">期限までの期間に合わせて、年次・月次・週次・日次の計画を自動生成します</p>
      </section>

      <div className="card">
        <div className="tabRow goalSectionTabRow">
          <div
            className="goalSectionActivePill"
            style={{ transform: `translateX(${goalSectionTabIndex * 100}%)` }}
            aria-hidden="true"
          />
          <button
            type="button"
            className={["tabBtn", goalSectionTab === "review" ? "active" : ""].join(" ").trim()}
            onClick={() => setGoalSectionTab("review")}
          >
            目標確認
          </button>
          <button
            type="button"
            className={["tabBtn", goalSectionTab === "create" ? "active" : ""].join(" ").trim()}
            onClick={() => setGoalSectionTab("create")}
          >
            目標作成
          </button>
        </div>
      </div>

      {goalSectionTab === "create" && (
        <div className={`goalSectionTransition ${goalSectionTransitionClass}`}>
        <form className="card flex flex-col items-center gap-2 p-2" onSubmit={handleCreateGoal}>
          <>
            <h3 className="text-2xl text-center m-4 font-normal tracking-[0.1em] uppercase">長期目標を新規作成</h3>
            <input
              className="goalField"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setIsGoalInputActive(true)}
              onBlur={() => setIsGoalInputActive(false)}
              placeholder="長期目標を入力"
            />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="期限を選択"
                value={deadline ? dayjs(deadline) : null}
                onChange={(newValue: dayjs.Dayjs | null) => {
                  setDeadline(newValue && newValue.isValid() ? newValue.format("YYYY-MM-DD") : "");
                }}
                disablePast
                slotProps={{
                  textField: {
                    className: "mb-4 goalField",
                    onFocus: () => setIsGoalInputActive(true),
                    onBlur: () => setIsGoalInputActive(false),
                    fullWidth: true,
                  },
                }}
              />
            </LocalizationProvider>
            {breakdownMutation.isPending ? (
              <div className="flex flex-col items-center justify-center mt-10 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[#13ec37] opacity-20 animate-ping"></div>
                  <img src="/loading_panda.png" className="w-20 h-20 drop-shadow-lg relative z-10" alt="Loading Panda" style={{ animation: 'spin 2s linear infinite' }} />
                </div>
                <p className="mt-4 text-sm font-extrabold text-[#0fbf2c] tracking-widest" style={{ animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
                  考え中...
                </p>
              </div>
            ): (
            <div className="relative inline-flex flex-col items-center mt-14">
              <span className={["whitespace-nowrap rounded-lg bg-gray-800 mt-1 px-3 py-1.5", "text-sm text-white shadow-md absolute -top-10 left-1/2", "-translate-x-1/2 after:content-[''] after:absolute", "after:top-full after:left-1/2 after:-translate-x-1/2", "after:border-[6px] after:border-transparent after:border-t-gray-800"].join(" ")}>
                {breakdownMutation.isPending ? "君を夢へ導くよ！" : hasAllInputs ? "それじゃあ夢を叶えよう！" : hasGoalAndDeadline ? "今の状況を教えて！" : isGoalInputActive ? "目標を教えて！" : "僕と相談しながら決めよう!"}
              </span>
              <img src="/panda.png" alt="Mentor Panda" className="h-20 object-contain drop-shadow-sm" />
            </div>)}
            {hasGoalAndDeadline && (
              <textarea
                value={currentSituation}
                onChange={(e) => setCurrentSituation(e.target.value)}
                placeholder="現状を入力"
                rows={3}
              />
            )}
            <button type="submit" disabled={!canSubmit}>
              {breakdownMutation.isPending ? <span className="loadingInline"><span className="loadingSpinner" aria-hidden="true" />プラン考え中</span> : "プランを立てる"}
            </button>            
            {breakdownMutation.isError && (
              <div style={{ marginTop: "12px", padding: "12px", background: "#fef2f2", borderRadius: "12px", border: "1px solid #fecaca" }}>
                {(breakdownMutation.error as any)?.response?.data?.detail === "FREE_LIMIT_REACHED" ? (
                  <p style={{ color: "#b91c1c", margin: 0, fontSize: "13px", fontWeight: "bold" }}>
                    無料プランでの1日のブレイクダウン上限（1回）に達しました。<br/>
                    右上の設定ボタンからプレミアム（月額300円）にアップグレードすると無制限に利用できます！
                  </p>
                ) : (
                  <p style={{ color: "#b91c1c", margin: 0, fontSize: "13px", fontWeight: "bold" }}>
                    ブレイクダウンに失敗しました。Geminiキーまたはバックエンドを確認してください。
                  </p>
                )}
              </div>
            )}
          </>
        </form>
        </div>
      )}

      {goalSectionTab === "review" && (
        <div className={`goalSectionTransition ${goalSectionTransitionClass}`}>
          <form className="card flex flex-col items-center gap-2 p-2">
            {goalOptions.length > 0 && <h3 className="text-2xl text-center m-4 font-normal tracking-[0.1em] uppercase">目標の修正を相談する</h3>}
            <div style={{ width: "100%" }} className="flex flex-col items-center gap-2">
              {goalOptions.length > 0 ? (
                <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
                  <FormControl fullWidth sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}>
                    <InputLabel id="goals-page-select-label">目標を選択</InputLabel>
                    <Select
                      labelId="goals-page-select-label"
                      value={activeGoalId === null ? "" : String(activeGoalId)}
                      label="目標を選択"
                      onChange={(e: SelectChangeEvent<string>) => {
                        const nextValue = e.target.value;
                        setActiveGoalId(nextValue === "" ? null : Number(nextValue));
                        setChatHistory([]);
                        setProposals([]);
                      }}
                    >
                      {goalOptions.map((goal: any) => (
                        <MenuItem key={goal.id} value={String(goal.id)}>
                          {goal.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              ) : null}
            </div>
            {!activeGoalId && goalOptions.length > 0 && <p className="mutedText">目標を選択してください。</p>}
            {goalOptions.length === 0 ? (
              <button type="button" onClick={() => setGoalSectionTab("create")}>目標を作成する</button>
            ) : (
              <div className="chatInputRow goalChatInputRow">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="例: 週次タスクをもっと具体化して"
                  disabled={!activeGoalId}
                />
                <button type="button" onClick={handleSendRevisionChat} disabled={!activeGoalId || !chatInput.trim()}>
                  <span aria-hidden="true">➤</span>
                </button>
              </div>
            )}
            {revisionMutation.isPending ? (
              <div className="flex flex-col items-center justify-center mt-6 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[#13ec37] opacity-20 animate-ping"></div>
                  <img src="/loading_panda.png" className="w-20 h-20 drop-shadow-lg relative z-10" alt="Loading Panda" style={{ animation: 'spin 2s linear infinite' }} />
                </div>
                <p className="mt-4 text-sm font-extrabold text-[#0fbf2c] tracking-widest" style={{ animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>考え中...</p>
              </div>
            ): (
              <div className="relative inline-flex flex-col items-center mt-10">
                <span className={["whitespace-nowrap rounded-lg bg-gray-800 mt-1 px-3 py-1.5", "text-sm text-white shadow-md absolute -top-10 left-1/2", "-translate-x-1/2 after:content-[''] after:absolute", "after:top-full after:left-1/2 after:-translate-x-1/2", "after:border-[6px] after:border-transparent after:border-t-gray-800"].join(" ")}>
                  {goalOptions.length === 0 ? "まず目標を作成してね！" : "修正が必要だったら言ってね！"}
                </span>
                <img src="/panda.png" alt="Mentor Panda" className="h-20 object-contain drop-shadow-sm" />
              </div>
            )}
          </form>
        </div>
      )}

      {goalSectionTab === "review" && activeGoalId && goalTasks.data && (
        <>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 className="text-2xl font-normal tracking-[0.1em] uppercase m-0">プラン</h3>
              <button type="button" onClick={() => setIsDeleteConfirmOpen(true)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "6px 12px", width: "auto", margin: 0, fontSize: "12px", fontWeight: 800, borderRadius: "8px" }}>目標を削除</button>
            </div>
            
            <div className="tabRow planTabRow">
              <div
                className="planTabActivePill"
                style={{ width: `calc((100% - 8px) / ${Math.max(1, availablePlanTabs.length)})`, transform: `translateX(${planTabIndex * 100}%)` }}
                aria-hidden="true"
              />
              {availablePlanTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={["tabBtn", planTab === tab ? "active" : ""].join(" ").trim()}
                  onClick={() => setPlanTab(tab)}
                >
                  {tab === "yearly" ? "年次" : tab === "monthly" ? "月次" : tab === "weekly" ? "週次" : "日次"}
                </button>
              ))}
            </div>

            <div className={`planContentTransition ${planTransitionClass}`}>
               {planTab === "daily" ? renderKanbanBoard() : renderPlanList()}
            </div>
          </div>
          
          <Dialog
            open={isDeleteConfirmOpen}
            onClose={() => setIsDeleteConfirmOpen(false)}
            TransitionComponent={Fade}
            transitionDuration={{ enter: 400, exit: 300 }}
            PaperProps={{ sx: { width: "min(320px, calc(100vw - 32px))", background: "#fff", borderRadius: "14px", padding: "16px" } }}
          >
            <div style={{ display: "grid", gap: "12px" }}>
              <p style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>本当に削除しますか？</p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button type="button" onClick={() => setIsDeleteConfirmOpen(false)} style={{ background: "#e2e8f0", color: "#0f172a", width: "auto", margin: 0 }}>いいえ</button>
                <button type="button" onClick={() => { if (activeGoalId) { setIsDeleteConfirmOpen(false); deleteMutation.mutate(activeGoalId); } }} style={{ background: "#dc2626", color: "#fff", width: "auto", margin: 0 }}>はい</button>
              </div>
            </div>
          </Dialog>
        </>
      )}
    </section>
  );
}