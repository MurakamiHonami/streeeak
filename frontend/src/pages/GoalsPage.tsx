import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import {
  applyAcceptedRevisions,
  createGoalAndBreakdown,
  deleteGoal,
  fetchGoals,
  fetchGoalTasks,
  revisionChat,
  updateTask,
} from "../lib/api";

import type { 
  DraftTask, 
  RevisionChatMessage, 
  TaskRevisionProposal,
  TaskType,
  Task,
  Goal,
  Post,
  RankingItem,
  RevisionChatResponse 
} from "../types";
type PlanTab = "yearly" | "monthly" | "weekly" | "daily";

export function GoalsPage() {
  const location = useLocation();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [currentSituation, setCurrentSituation] = useState("");
  const [isGoalInputActive, setIsGoalInputActive] = useState(false);
  const [activeGoalId, setActiveGoalId] = useState<number | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [editingDailyTaskId, setEditingDailyTaskId] = useState<number | null>(null);
  const [editingDailyTitle, setEditingDailyTitle] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<RevisionChatMessage[]>([]);
  const [proposals, setProposals] = useState<TaskRevisionProposal[]>([]);
  const [decisionMap, setDecisionMap] = useState<Record<string, "accepted" | "rejected">>({});
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [goalSectionTab, setGoalSectionTab] = useState<"create" | "review">("review");
  const [planTab, setPlanTab] = useState<PlanTab>("yearly");
  const goalSectionPrevTabRef = useRef<"create" | "review">("review");
  const planPrevTabRef = useRef<PlanTab>("yearly");
  const lastInitializedGoalIdRef = useRef<number | null>(null);
  const proposalRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const yearlyScrollRef = useRef<HTMLDivElement | null>(null);
  const monthlyScrollRef = useRef<HTMLDivElement | null>(null);
  const weeklyScrollRef = useRef<HTMLDivElement | null>(null);
  const dailyScrollRef = useRef<HTMLDivElement | null>(null);
  const yearlyItemRefs = useRef<Record<number, HTMLElement | null>>({});
  const monthlyItemRefs = useRef<Record<number, HTMLElement | null>>({});
  const weeklyItemRefs = useRef<Record<number, HTMLElement | null>>({});
  const dailyDateRefs = useRef<Record<string, HTMLElement | null>>({});
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
  const yearlyTasks = monthlyTasks.filter((t) => t.title.startsWith("1年目の目標:") || t.title.includes("年目の目標:"));
  const monthlyPlanTasks = monthlyTasks.filter((t) => !t.title.includes("年目の目標:"));

  const doneTaskIds = useMemo(() => {
    const ids = new Set<number>();
    for (const task of goalTasks.data ?? []) {
      if (task.is_done) ids.add(task.id);
    }
    return ids;
  }, [goalTasks.data]);

  const formatDateLabel = (value: string) => {
    if (value === "no-date") return "日付未設定";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
  };

  const todayKey = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const selectedGoal = useMemo(
    () => goals.data?.find((goal: any) => goal.id === activeGoalId) ?? null,
    [goals.data, activeGoalId],
  );

  const elapsedDaysSinceGoalStart = useMemo(() => {
    if (!selectedGoal?.created_at) return 0;
    const start = new Date(selectedGoal.created_at);
    const now = new Date();
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.floor((nowDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)));
  }, [selectedGoal]);

  const currentYearIndex = yearlyTasks.length > 0 ? Math.min(yearlyTasks.length - 1, Math.floor(elapsedDaysSinceGoalStart / 365)) : -1;
  const currentMonthIndex =
    monthlyPlanTasks.length > 0 ? Math.min(monthlyPlanTasks.length - 1, Math.floor(elapsedDaysSinceGoalStart / 30)) : -1;
  const currentWeekIndex = weeklyTasks.length > 0 ? Math.min(weeklyTasks.length - 1, Math.floor(elapsedDaysSinceGoalStart / 7)) : -1;
  const currentWeekNumber =
    currentWeekIndex >= 0
      ? (weeklyTasks[currentWeekIndex]?.week_number ?? currentWeekIndex + 1)
      : null;
  const currentYearTask = currentYearIndex >= 0 ? yearlyTasks[currentYearIndex] : null;
  const currentMonthTask = currentMonthIndex >= 0 ? monthlyPlanTasks[currentMonthIndex] : null;
  const currentWeekTask = currentWeekIndex >= 0 ? weeklyTasks[currentWeekIndex] : null;
  const dailyTasks = appliedDraftTasks.filter(
    (t) =>
      t.task_type === "daily" &&
      (currentWeekNumber === null || t.week_number === currentWeekNumber || t.week_number == null),
  );
  const dailyTasksByDate = useMemo(() => {
    const groups = new Map<string, DraftTask[]>();
    for (const task of dailyTasks) {
      const key = task.date ?? "no-date";
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

  const currentDailyDateKey = useMemo(() => {
    const dated = dailyTasksByDate
      .map(([dateKey]) => dateKey)
      .filter((dateKey) => dateKey !== "no-date");
    if (!dated.length) return null;
    if (dated.includes(todayKey)) return todayKey;

    const today = new Date(todayKey);
    let best: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const key of dated) {
      const d = new Date(key);
      const dist = Math.abs(d.getTime() - today.getTime());
      if (dist < bestDistance) {
        best = key;
        bestDistance = dist;
      }
    }
    return best;
  }, [dailyTasksByDate, todayKey]);
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
    if (dailyTasksByDate.length > 0 || dailyTasks.length > 0) tabs.push("daily");
    if (tabs.length === 0) tabs.push("monthly");
    return tabs;
  }, [yearlyTasks.length, monthlyPlanTasks.length, weeklyTasks.length, dailyTasksByDate.length, dailyTasks.length]);
  const primaryPlanTab = availablePlanTabs[0];
  const planTabIndex = Math.max(0, availablePlanTabs.indexOf(planTab));
  const previousPlanTabIndex = Math.max(0, availablePlanTabs.indexOf(planPrevTabRef.current));
  const planTransitionClass =
    planTabIndex > previousPlanTabIndex
      ? "planContentTransitionForward"
      : planTabIndex < previousPlanTabIndex
      ? "planContentTransitionBackward"
      : "planContentTransitionNeutral";

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

  const moveDailyTaskMutation = useMutation({
    mutationFn: ({ taskId, targetDate }: { taskId: number; targetDate: string }) =>
      updateTask(taskId, { date: targetDate }),
    onSuccess: () => {
      if (!activeGoalId) return;
      queryClient.invalidateQueries({ queryKey: ["goalTasks", activeGoalId] });
      queryClient.invalidateQueries({ queryKey: ["dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["weeklyDailyTasks"] });
    },
  });

  const editDailyTaskMutation = useMutation({
    mutationFn: ({ taskId, title }: { taskId: number; title: string }) =>
      updateTask(taskId, { title }),
    onSuccess: () => {
      if (!activeGoalId) return;
      queryClient.invalidateQueries({ queryKey: ["goalTasks", activeGoalId] });
      queryClient.invalidateQueries({ queryKey: ["dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["weeklyDailyTasks"] });
      setEditingDailyTaskId(null);
      setEditingDailyTitle("");
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

  const scrollToProposal = (proposalId: string) => {
    const target = proposalRefs.current[proposalId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToNextProposal = (
    currentProposalId: string,
    nextDecisionMap: Record<string, "accepted" | "rejected">,
  ) => {
    const currentIndex = proposals.findIndex((p) => p.proposal_id === currentProposalId);
    if (currentIndex < 0) return;

    for (let i = currentIndex + 1; i < proposals.length; i += 1) {
      const next = proposals[i];
      if (!nextDecisionMap[next.proposal_id]) {
        requestAnimationFrame(() => scrollToProposal(next.proposal_id));
        return;
      }
    }

    for (let i = 0; i < currentIndex; i += 1) {
      const next = proposals[i];
      if (!nextDecisionMap[next.proposal_id]) {
        requestAnimationFrame(() => scrollToProposal(next.proposal_id));
        return;
      }
    }
  };

  const handleProposalDecision = (proposal: TaskRevisionProposal, decision: "accepted" | "rejected") => {
    const nextDecisionMap = { ...decisionMap, [proposal.proposal_id]: decision };
    setDecisionMap(nextDecisionMap);
    scrollToNextProposal(proposal.proposal_id, nextDecisionMap);
    if (decision === "accepted" && activeGoalId) {
      applyMutation.mutate(
        {
          goalId: activeGoalId,
          acceptedProposals: [proposal],
        },
        {
          onError: () => {
            setDecisionMap((prev) => {
              const rollback = { ...prev };
              delete rollback[proposal.proposal_id];
              return rollback;
            });
          },
        },
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

  const getTaskDecision = (taskId?: number) => {
    if (!taskId) return undefined;
    const proposal = proposalsByTaskId.get(taskId);
    if (!proposal) return undefined;
    return decisionMap[proposal.proposal_id];
  };

  const getTaskTitleStyle = (taskId?: number) => {
    const decision = getTaskDecision(taskId);
    if (decision === "accepted") {
      return {
        background: "#dcfce7",
        border: "1px solid #86efac",
        borderRadius: "8px",
        padding: "8px",
      };
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
          <button
            type="button"
            onClick={() => handleProposalReset(proposal.proposal_id)}
            style={{ background: "#94a3b8", color: "#0f172a", margin: 0, width: "auto", padding: "6px 10px" }}
          >
            戻る
          </button>
        </div>
      );
    }

    return (
      <div className="proposalCard" style={{ marginTop: "8px", background: "#f8faf8" }}>
        <div
          className="proposalCard"
          ref={(el) => {
            proposalRefs.current[proposal.proposal_id] = el;
          }}
        >
          <div
            style={{
              background: "#fee2e2",
              color: "#7f1d1d",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "8px",
              marginBottom: "8px",
            }}
          >
            <small style={{ display: "block", fontWeight: 700, marginBottom: "4px" }}>Before</small>
            <p style={{ margin: 0 }}>{proposal.before}</p>
          </div>
          <div
            style={{
              background: "#dcfce7",
              color: "#14532d",
              border: "1px solid #86efac",
              borderRadius: "8px",
              padding: "8px",
            }}
          >
            <small style={{ display: "block", fontWeight: 700, marginBottom: "4px" }}>After</small>
            <p style={{ margin: 0 }}>{proposal.after}</p>
          </div>
          <div className="rowActions">
            <button
              type="button"
              onClick={() => handleProposalDecision(proposal, "accepted")}
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => handleProposalDecision(proposal, "rejected")}
              style={{ background: "#475569", color: "#fff" }}
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!proposals.length) return;
    const firstUndecided = proposals.find((p) => !decisionMap[p.proposal_id]);
    if (!firstUndecided) return;
    requestAnimationFrame(() => scrollToProposal(firstUndecided.proposal_id));
  }, [proposals]);

  useEffect(() => {
    if (!availablePlanTabs.includes(planTab)) {
      setPlanTab(availablePlanTabs[0]);
    }
  }, [availablePlanTabs, planTab]);

  useEffect(() => {
    if (!activeGoalId) {
      lastInitializedGoalIdRef.current = null;
      return;
    }
    if (!goalTasks.data) return;
    if (lastInitializedGoalIdRef.current !== activeGoalId) {
      setPlanTab(availablePlanTabs[0]);
      lastInitializedGoalIdRef.current = activeGoalId;
    }
  }, [activeGoalId, goalTasks.data, availablePlanTabs]);

  useEffect(() => {
    planPrevTabRef.current = planTab;
  }, [planTab]);

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
    const requestedTab = (location.state as { goalSectionTab?: "create" | "review" } | null)?.goalSectionTab;
    if (requestedTab === "create" || requestedTab === "review") {
      setGoalSectionTab(requestedTab);
    }
  }, [location.state]);

  useEffect(() => {
    goalSectionPrevTabRef.current = goalSectionTab;
  }, [goalSectionTab]);

  useEffect(() => {
    if (!activeGoalId || !goalTasks.data) return;
    const scrollInContainer = (
      container: HTMLDivElement | null,
      target: HTMLElement | null,
    ) => {
      if (!container || !target) return;
      const top = target.offsetTop - container.offsetTop - 8;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    };

    requestAnimationFrame(() => {
      if (currentYearIndex >= 0) scrollInContainer(yearlyScrollRef.current, yearlyItemRefs.current[currentYearIndex]);
      if (currentMonthIndex >= 0) scrollInContainer(monthlyScrollRef.current, monthlyItemRefs.current[currentMonthIndex]);
      if (currentWeekIndex >= 0) scrollInContainer(weeklyScrollRef.current, weeklyItemRefs.current[currentWeekIndex]);
      if (currentDailyDateKey) scrollInContainer(dailyScrollRef.current, dailyDateRefs.current[currentDailyDateKey]);
    });
  }, [
    activeGoalId,
    goalTasks.data,
    currentYearIndex,
    currentMonthIndex,
    currentWeekIndex,
    currentDailyDateKey,
  ]);

  const handleDropDailyTask = (targetDate: string, rawTaskId: string) => {
    const taskId = Number(rawTaskId);
    if (!Number.isFinite(taskId) || targetDate === "no-date") return;
    moveDailyTaskMutation.mutate({ taskId, targetDate });
  };

  const startEditingDailyTask = (taskId: number | undefined, currentTitle: string) => {
    if (!taskId) return;
    setEditingDailyTaskId(taskId);
    setEditingDailyTitle(currentTitle);
  };

  const saveEditingDailyTask = () => {
    if (!editingDailyTaskId) return;
    const nextTitle = editingDailyTitle.trim();
    if (!nextTitle) return;
    editDailyTaskMutation.mutate({ taskId: editingDailyTaskId, title: nextTitle });
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
                onChange={(newValue) => {
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
            <div className="relative inline-flex flex-col items-center mt-14">
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
            )}
            {hasGoalAndDeadline && (
              <textarea
                value={currentSituation}
                onChange={(e) => setCurrentSituation(e.target.value)}
                placeholder="現状を入力"
                rows={3}
              />
            )}
            <button type="submit" disabled={!canSubmit}>
              {breakdownMutation.isPending ? (
                <span className="loadingInline">
                  <span className="loadingSpinner" aria-hidden="true" />
                  プラン考え中
                </span>
              ) : (
                "プランを立てる"
              )}
            </button>            
            {breakdownMutation.isError && (
              <p style={{ color: "#c0392b", margin: 0 }}>
                ブレイクダウンに失敗しました。Geminiキーまたはバックエンドを確認してください。
              </p>
            )}
          </>
        </form>
        </div>
      )}

      {goalSectionTab === "review" && (
        <div className={`goalSectionTransition ${goalSectionTransitionClass}`}>
          <form className="card flex flex-col items-center gap-2 p-2">
            {goalOptions.length > 0 && (
              <h3 className="text-2xl text-center m-4 font-normal tracking-[0.1em] uppercase">目標の修正を相談する</h3>
            )}
            <div style={{ width: "100%" }} className="flex flex-col items-center gap-2">
              {goalOptions.length > 0 ? (
                <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
                  <FormControl
                    fullWidth
                    sx={{
                      width: "100%",
                      maxWidth: "100%",
                      minWidth: 0,
                      "& .MuiInputLabel-root": { color: "#666" },
                      "& .MuiInputLabel-root.Mui-focused": { color: "#111" },
                      "& .MuiOutlinedInput-root": {
                        width: "100%",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        "& fieldset": { borderColor: "#ccc" },
                        "&:hover fieldset": { borderColor: "#888" },
                        "&.Mui-focused fieldset": { borderColor: "#111" },
                      },
                      "& .MuiSelect-select": {
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                    }}
                  >
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
              <button type="button" onClick={() => setGoalSectionTab("create")}>
                目標を作成する
              </button>
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
                  <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
                    送信
                  </span>
                </button>
              </div>
            )}
            {revisionMutation.isPending ? (
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
            ): (
              <div className="relative inline-flex flex-col items-center mt-10">
                <span
                  className={[
                    "whitespace-nowrap rounded-lg bg-gray-800 mt-1 px-3 py-1.5",
                    "text-sm text-white shadow-md absolute -top-10 left-1/2",
                    "-translate-x-1/2 after:content-[''] after:absolute",
                    "after:top-full after:left-1/2 after:-translate-x-1/2",
                    "after:border-[6px] after:border-transparent after:border-t-gray-800",
                  ].join(" ")}
                >
                  {goalOptions.length === 0 ? "まず目標を作成してね！" : "修正が必要だったら言ってね！"}
                </span>
                <img src="/panda.png" alt="Mentor Panda" className="h-20 object-contain drop-shadow-sm" />
              </div>
            )}
            {revisionMutation.isError && (
              <p style={{ color: "#c0392b", margin: 0 }}>提案生成に失敗しました。再試行してください。</p>
            )}
          </form>
        </div>
        
      )}

      {goalSectionTab === "review" && activeGoalId && goalTasks.data && (
        <>
          <div className="card">
            <h3 className="text-2xl text-center m-4 font-normal tracking-[0.1em] uppercase">プラン</h3>
            <div className="tabRow planTabRow">
              <div
                className="planTabActivePill"
                style={{
                  width: `calc((100% - 8px) / ${Math.max(1, availablePlanTabs.length)})`,
                  transform: `translateX(${planTabIndex * 100}%)`,
                }}
                aria-hidden="true"
              />
              {availablePlanTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={["tabBtn", planTab === tab ? "active" : ""].join(" ").trim()}
                  onClick={() => setPlanTab(tab)}
                >
                  {tab === "yearly" ? "年" : tab === "monthly" ? "月" : tab === "weekly" ? "週" : "日"}
                </button>
              ))}
            </div>

            {planTab === "yearly" && (
              <div className={`planContentTransition ${planTransitionClass}`}>
              <section className="planUnit">
                <h4>
                  {yearlyTasks.length}年プラン{selectedGoal?.deadline ? `：${selectedGoal.deadline}まで` : ""}
                </h4>
                {primaryPlanTab === "yearly" && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <button
                      type="button"
                      onClick={() => setIsDeleteConfirmOpen(true)}
                      style={{ background: "#dc2626", color: "#fff", padding: "6px 10px", margin: 0, width: "auto", fontSize: "12px", fontWeight: 600 }}
                      title="この目標を削除"
                    >
                      この目標を削除する
                    </button>
                  </div>
                )}
                {yearlyTasks.length === 0 && <p className="mutedText">タスクがありません</p>}
                <div className="planScrollArea" ref={yearlyScrollRef}>
                  {yearlyTasks.map((task, idx) => (
                    <section
                      key={task.task_id || idx}
                      ref={(el) => {
                        yearlyItemRefs.current[idx] = el;
                      }}
                    >
                      <p
                        className={idx === currentYearIndex ? "currentPeriodLabel" : undefined}
                        style={{ margin: "6px 0 8px", fontSize: "13px", fontWeight: 700, color: "#334155" }}
                      >
                        {idx + 1}年目
                        {idx === currentYearIndex ? "（今年）" : ""}
                      </p>
                      <div className={["taskRow", idx === currentYearIndex ? "currentPeriodRow" : ""].join(" ").trim()}>
                        <div style={{ width: "100%" }}>
                          <p style={getTaskTitleStyle(task.task_id)}>{task.title}</p>
                          {renderTaskProposalReview(task.task_id)}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </section>
              </div>
            )}

            {planTab === "monthly" && (
            <div className={`planContentTransition ${planTransitionClass}`}>
            <section className="planUnit">
              {yearlyTasks.length > 0 && (
                <div className="taskRow currentPeriodRow">
                  <div style={{ width: "100%" }}>
                    <p style={{ marginBottom: "4px", fontSize: "12px", fontWeight: 700, color: "#15803d" }}>
                      今年の目標
                    </p>
                    <p>{currentYearTask ? currentYearTask.title : "年次タスクがありません"}</p>
                  </div>
                </div>
              )}
              <h4>
                {monthlyPlanTasks.length > 0 ? `${monthlyPlanTasks.length}ヶ月プラン` : "月次プラン"}
                {selectedGoal?.deadline ? `：${selectedGoal.deadline}まで` : ""}
              </h4>
              {primaryPlanTab === "monthly" && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    style={{ background: "#dc2626", color: "#fff", padding: "6px 10px", margin: 0, width: "auto", fontSize: "12px", fontWeight: 600 }}
                    title="この目標を削除"
                  >
                    この目標を削除する
                  </button>
                </div>
              )}
              {monthlyPlanTasks.length === 0 && <p className="mutedText">タスクがありません</p>}
              {monthlyPlanTasks.length > 0 && (
                <div className="planScrollArea" ref={monthlyScrollRef}>
                  {monthlyPlanTasks.map((task, idx) => (
                    <div
                      key={task.task_id || idx}
                      ref={(el) => {
                        monthlyItemRefs.current[idx] = el;
                      }}
                    >
                      <p
                        className={idx === currentMonthIndex ? "currentPeriodLabel" : undefined}
                        style={{ margin: "6px 0 8px", fontSize: "13px", fontWeight: 700, color: "#334155" }}
                      >
                        {idx + 1}ヶ月目
                        {idx === currentMonthIndex ? "（今月）" : ""}
                      </p>
                      <div className={["taskRow", idx === currentMonthIndex ? "currentPeriodRow" : ""].join(" ").trim()}>
                        <div style={{ width: "100%" }}>
                          <p style={getTaskTitleStyle(task.task_id)}>{stripMonthPrefix(task.title)}</p>
                          {renderTaskProposalReview(task.task_id)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            </div>
            )}

            {planTab === "weekly" && (
            <div className={`planContentTransition ${planTransitionClass}`}>
            <section className="planUnit">
              <div className="taskRow currentPeriodRow">
                <div style={{ width: "100%" }}>
                  <p style={{ marginBottom: "4px", fontSize: "12px", fontWeight: 700, color: "#15803d" }}>
                    今月の目標
                  </p>
                  <p>{currentMonthTask ? stripMonthPrefix(currentMonthTask.title) : "月次タスクがありません"}</p>
                </div>
              </div>
              <h4>
                {weeklyTasks.length === 4 ? "直近1ヶ月の週次プラン" : `${weeklyTasks.length}週間の週次プラン`}
                {selectedGoal?.deadline ? `：${selectedGoal.deadline}まで` : ""}
              </h4>
              {primaryPlanTab === "weekly" && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    style={{ background: "#dc2626", color: "#fff", padding: "6px 10px", margin: 0, width: "auto", fontSize: "12px", fontWeight: 600 }}
                    title="この目標を削除"
                  >
                    この目標を削除する
                  </button>
                </div>
              )}
              {weeklyTasks.length === 0 && <p className="mutedText">タスクがありません</p>}
              {weeklyTasks.length > 0 && (
                <div className="planScrollArea" ref={weeklyScrollRef}>
                  {weeklyTasks.map((task, idx) => (
                    <section
                      key={task.task_id || idx}
                      ref={(el) => {
                        weeklyItemRefs.current[idx] = el;
                      }}
                    >
                      <p
                        className={idx === currentWeekIndex ? "currentPeriodLabel" : undefined}
                        style={{ margin: "6px 0 8px", fontSize: "13px", fontWeight: 700, color: "#334155" }}
                      >
                        {idx + 1}週目
                        {idx === currentWeekIndex ? "（今週）" : ""}
                      </p>
                      <div className={["taskRow", idx === currentWeekIndex ? "currentPeriodRow" : ""].join(" ").trim()}>
                        <div style={{ width: "100%" }}>
                          <p style={getTaskTitleStyle(task.task_id)}>{stripWeekPrefix(task.title)}</p>
                          {renderTaskProposalReview(task.task_id)}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>
            </div>
            )}

            {planTab === "daily" && (
            <div className={`planContentTransition ${planTransitionClass}`}>
            <section className="planUnit">
              <div className="taskRow currentPeriodRow">
                <div style={{ width: "100%" }}>
                  <p style={{ marginBottom: "4px", fontSize: "12px", fontWeight: 700, color: "#15803d" }}>
                    今週の目標
                  </p>
                  <p>{currentWeekTask ? stripWeekPrefix(currentWeekTask.title) : "週次タスクがありません"}</p>
                </div>
              </div>
              <h4>直近1週間のTODO</h4>
              {primaryPlanTab === "daily" && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    style={{ background: "#dc2626", color: "#fff", padding: "6px 10px", margin: 0, width: "auto", fontSize: "12px", fontWeight: 600 }}
                    title="この目標を削除"
                  >
                    この目標を削除する
                  </button>
                </div>
              )}
              {dailyTasks.length === 0 && <p className="mutedText">タスクがありません</p>}
              {dailyTasksByDate.length > 0 && (
                <div className="planScrollArea planScrollAreaDaily" ref={dailyScrollRef}>
                  {dailyTasksByDate.map(([dateKey, tasks]) => (
                    <section
                      key={dateKey}
                      ref={(el) => {
                        dailyDateRefs.current[dateKey] = el;
                      }}
                      className={[
                        "dailyDropSection",
                        dragOverDate === dateKey ? "dailyDropSectionActive" : "",
                        dateKey === todayKey ? "todayDropSection" : "",
                        dateKey === "no-date" ? "dailyDropSectionDisabled" : "",
                      ]
                        .join(" ")
                        .trim()}
                      onDragOver={(e) => {
                        if (dateKey === "no-date") return;
                        e.preventDefault();
                        setDragOverDate(dateKey);
                      }}
                      onDragLeave={() => {
                        if (dragOverDate === dateKey) setDragOverDate(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverDate(null);
                        handleDropDailyTask(dateKey, e.dataTransfer.getData("text/plain"));
                      }}
                    >
                      <p
                        className={dateKey === todayKey ? "todayLabel" : undefined}
                        style={{ margin: "6px 0 8px", fontSize: "13px", fontWeight: 700, color: "#334155" }}
                      >
                        {formatDateLabel(dateKey)}
                        {dateKey === todayKey ? "（今日）" : ""}
                      </p>
                      {dragOverDate === dateKey && draggingTaskId && (
                        <p className="dropHint">ここにドロップしてこの日付へ移動</p>
                      )}
                      {tasks.map((task, idx) => (
                        (() => {
                          const isDone = task.task_id ? doneTaskIds.has(task.task_id) : false;
                          return (
                        <div
                          key={task.task_id || `${dateKey}-${idx}`}
                          className={[
                            "taskRow",
                            "dailyTaskRow",
                            task.task_id && dateKey !== "no-date" ? "draggableTaskRow" : "",
                            draggingTaskId === task.task_id ? "draggingTaskRow" : "",
                            isDone ? "completedTaskRow" : "",
                          ]
                            .join(" ")
                            .trim()}
                          onDragEnd={() => {
                            setDraggingTaskId(null);
                            setDragOverDate(null);
                          }}
                        >
                          <div className="taskBody">
                            {task.task_id && dateKey !== "no-date" && (
                              <span
                                className="dragHandle"
                                draggable
                                onDragStart={(e) => {
                                  setDraggingTaskId(task.task_id!);
                                  e.dataTransfer.setData("text/plain", String(task.task_id));
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => {
                                  setDraggingTaskId(null);
                                  setDragOverDate(null);
                                }}
                                title="ドラッグして日付移動"
                                aria-label="ドラッグして日付移動"
                              >
                                ⋮⋮
                              </span>
                            )}
                            <div className="taskContent">
                              {isDone && <span className="doneBadge">完了</span>}
                              {editingDailyTaskId === task.task_id ? (
                                <div className="chatInputRow">
                                  <input
                                    autoFocus
                                    value={editingDailyTitle}
                                    onChange={(e) => setEditingDailyTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveEditingDailyTask();
                                      if (e.key === "Escape") {
                                        setEditingDailyTaskId(null);
                                        setEditingDailyTitle("");
                                      }
                                    }}
                                  />
                                  <button type="button" onClick={saveEditingDailyTask} disabled={editDailyTaskMutation.isPending}>
                                    保存
                                  </button>
                                  <button
                                    type="button"
                                    style={{ background: "#64748b", color: "#fff" }}
                                    onClick={() => {
                                      setEditingDailyTaskId(null);
                                      setEditingDailyTitle("");
                                    }}
                                  >
                                    キャンセル
                                  </button>
                                </div>
                              ) : (
                                <p
                                  onClick={() => startEditingDailyTask(task.task_id, task.title)}
                                  style={{
                                    ...(getTaskTitleStyle(task.task_id) ?? {}),
                                    cursor: task.task_id ? "text" : "default",
                                  }}
                                  className={isDone ? "doneTaskTitle" : undefined}
                                  title="クリックして編集"
                                >
                                  {task.title}
                                </p>
                              )}
                              {task.subtasks && task.subtasks.length > 0 && (
                                <ul className="detailTodoList">
                                  {task.subtasks.map((line, detailIdx) => (
                                    <li key={detailIdx}>{line}</li>
                                  ))}
                                </ul>
                              )}
                              {renderTaskProposalReview(task.task_id)}
                            </div>
                          </div>
                        </div>
                          );
                        })()
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </section>
            </div>
            )}
          </div>
          {isDeleteConfirmOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  width: "min(320px, calc(100vw - 32px))",
                  background: "#fff",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  padding: "16px",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>本当に削除しますか？</p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(false)}
                    style={{ background: "#e2e8f0", color: "#0f172a", width: "auto", margin: 0 }}
                  >
                    いいえ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeGoalId) return;
                      setIsDeleteConfirmOpen(false);
                      deleteMutation.mutate(activeGoalId);
                    }}
                    style={{ background: "#dc2626", color: "#fff", width: "auto", margin: 0 }}
                  >
                    はい
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}