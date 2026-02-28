import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appContext, carryOverTask, fetchDailyTasks, fetchRanking, toggleTaskDone, updateTask, fetchGoals, resolveApiAssetUrl } from "../lib/api";
import CheckIcon from '@mui/icons-material/Check';
import MoveDownIcon from '@mui/icons-material/MoveDown';
import UndoIcon from '@mui/icons-material/Undo';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { useNavigate } from "react-router-dom";

const COLUMNS = [
  { id: "todo", label: "📋 未着手", color: "#6366f1" },
  { id: "in_progress", label: "⚡ 進行中", color: "#f59e0b" },
  { id: "done", label: "✅ 完了", color: "#10b981" },
];

const PRIORITY: Record<string, { label: string; color: string }> = {
  high: { label: "高", color: "#ef4444" },
  mid: { label: "中", color: "#f59e0b" },
  low: { label: "低", color: "#6b7280" },
};

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dailyTasks = useQuery({ queryKey: ["dailyTasks"], queryFn: fetchDailyTasks });
  const ranking = useQuery({ queryKey: ["ranking", "home"], queryFn: () => fetchRanking(50) });
  const goals = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });

  const doneMutation = useMutation({
    mutationFn: toggleTaskDone,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dailyTasks"] }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: any }) => updateTask(taskId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dailyTasks"] }),
  });
  
  const carryOverMutation = useMutation({
    mutationFn: carryOverTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dailyTasks"] }),
  });

  const [currentGoalId, setCurrentGoalId] = useState<number | "">("");
  const [sasaThrows, setSasaThrows] = useState<number[]>([]);
  const [activeCol, setActiveCol] = useState(0);
  const kanbanScrollRef = useRef<HTMLDivElement | null>(null);
  
  
  const initializedGoalIdForKanban = useRef<number | "">("");

  useEffect(() => {
    const goalList = goals.data ?? [];
    if (goalList.length === 0) {
      if (currentGoalId !== "") {
        setCurrentGoalId("");
      }
      return;
    }

    if (currentGoalId !== "" && goalList.some((goal) => goal.id === currentGoalId)) {
      return;
    }

    const todayTasks = dailyTasks.data ?? [];
    const goalWithTodayTask = goalList.find((goal) =>
      todayTasks.some((task) => task.goal_id === goal.id)
    );
    setCurrentGoalId(goalWithTodayTask?.id ?? goalList[0].id);
  }, [goals.data, dailyTasks.data, currentGoalId]);

  const handleChange = (event: SelectChangeEvent<number | "">) => {
    setCurrentGoalId(event.target.value as number | "");
  };

  const handleDone = (task: any) => {
    if (!task.is_done) {
      const id = Date.now();
      setSasaThrows((prev) => [...prev, id]);
      setTimeout(() => {
        setSasaThrows((prev) => prev.filter((t) => t !== id));
      }, 1500);
      updateStatusMutation.mutate({ taskId: task.id, payload: { status: "done" } });
    } else {
        updateStatusMutation.mutate({ taskId: task.id, payload: { status: "todo" } });
    }
    doneMutation.mutate(task.id);
  };

  const moveTask = (taskId: number, newStatus: string) => {
    updateStatusMutation.mutate({ taskId, payload: { status: newStatus } });
    const task = dailyTasks.data?.find((t) => t.id === taskId);
    if (task) {
        if (newStatus === "done" && !task.is_done) {
            handleDone(task);
        } else if (newStatus !== "done" && task.is_done) {
            doneMutation.mutate(taskId);
        }
    }
  };

  const tasks = dailyTasks.data ?? [];
  const filteredTasks = useMemo(() => 
    currentGoalId !== "" ? tasks.filter(task => task.goal_id === currentGoalId) : [],
  [tasks, currentGoalId]);

  
  useEffect(() => {
    
    if (filteredTasks.length === 0 || initializedGoalIdForKanban.current === currentGoalId) {
      return;
    }
    const inProgressCount = filteredTasks.filter(t => !t.is_done && t.status === "in_progress").length;
    const todoCount = filteredTasks.filter(t => !t.is_done && (!t.status || t.status === "todo")).length;

    let targetCol = 0;
    

    if (inProgressCount > 0) {
      targetCol = 1;
    } else if (todoCount > 0) {
      targetCol = 0;
    } else {
      targetCol = 2;
    }

    setActiveCol(targetCol);
    initializedGoalIdForKanban.current = currentGoalId;
    if (kanbanScrollRef.current) {
      setTimeout(() => {
        kanbanScrollRef.current?.children[targetCol]?.scrollIntoView({ 
          behavior: "smooth", 
          block: "nearest", 
          inline: "start" 
        });
      }, 50);
    }
  }, [filteredTasks, currentGoalId]);

  const doneCount = filteredTasks.filter((task) => task.is_done || task.status === "done").length;
  const doneRate = filteredTasks.length ? Math.round((doneCount / filteredTasks.length) * 100) : 0;
  const isAllDone = filteredTasks.length > 0 && doneCount === filteredTasks.length;
  
  const selectedGoal = goals.data?.find(g => g.id === currentGoalId);
  const rankingList = ranking.data ?? [];
  const top3Ranking = rankingList.slice(0, 3);
  const myRankIndex = rankingList.findIndex((item) => item.user_id === appContext.userId);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
  
  const renderRankItem = (rank: number, isYou: boolean, data?: any) => {
    if (!data) return null;
    const isTop = rank === 1;
    const avatarSize = isTop ? "w-16 h-16 text-2xl" : "w-12 h-12 text-lg";
    
    const avatarBg = isYou 
      ? "bg-[#13ec37]/10 text-[#0fbf2c] border-[3px] border-[#13ec37] shadow-[0_4px_20px_rgba(19,236,55,0.25)]" 
      : "bg-white text-[#64748b] border-2 border-[#e8ede8]";
      
    const badgeBg = rank === 1 
      ? "bg-[#13ec37] text-[#0f1f10]" 
      : rank === 2 
        ? "bg-[#e2e8f0] text-[#475569]" 
        : "bg-[#f1f5f9] text-[#64748b]";
        
    const marginTop = rank === 1 ? "-mt-6" : "mt-0";

    return (
      <div key={data.user_id || rank} className={`flex flex-col items-center gap-2 ${marginTop}`}>
        <div className="relative">
          {data.avatar_url ? (
            <img
              src={resolveApiAssetUrl(data.avatar_url) ?? ""}
              alt={data.user_name || "User"}
              className={`${avatarSize} rounded-full object-cover ${isYou ? "border-[3px] border-[#13ec37] shadow-[0_4px_20px_rgba(19,236,55,0.25)]" : "border-2 border-[#e8ede8]"}`}
            />
          ) : (
            <div className={`${avatarSize} rounded-full flex items-center justify-center font-extrabold ${avatarBg}`}>
              {data.user_name?.[0] || "U"}
            </div>
          )}
          <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white ${badgeBg}`}>
            {rank}
          </div>
        </div>
        <div className="text-center">
          <p className={`text-[12px] m-0 ${isYou ? "font-extrabold text-[#0fbf2c]" : "font-bold text-[#0f1f10]"}`}>
            {data.user_name}
          </p>
          <p className="text-[10px] text-[#64748b] m-0 font-bold">
            {((data.achieved_avg || 0) * 100).toFixed(0)}%
          </p>
        </div>
      </div>
    );
  };

  const renderKanbanBoard = () => (
    <div style={{ display: "flex", flexDirection: "column", background: "#f8faf8", borderRadius: "20px", overflow: "hidden", marginTop: "16px" }}>
      <div style={{ display: "flex", padding: "12px 16px 8px", gap: 8, background: "#fff" }}>
        {COLUMNS.map((col, i) => {
          const count = filteredTasks.filter(t => {
            if (col.id === "done") return t.is_done || t.status === "done";
            if (col.id === "todo") return !t.is_done && (!t.status || t.status === "todo");
            return !t.is_done && t.status === col.id;
          }).length;
          return (
            <button
              type="button"
              key={col.id}
              onClick={() => {
                setActiveCol(i);
                kanbanScrollRef.current?.children[i]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
              }}
              style={{
                flex: 1, padding: "8px 4px", borderRadius: "12px", border: "none",
                background: activeCol === i ? col.color : "#f1f5f9",
                color: activeCol === i ? "#fff" : "#64748b",
                fontWeight: 800, fontSize: "11px", cursor: "pointer", transition: "all 0.2s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}
            >
              <span>{col.label.split(" ")[1]}</span>
              <span style={{ fontSize: "14px", fontWeight: 900 }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div
        ref={kanbanScrollRef}
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          const idx = Math.round(target.scrollLeft / target.offsetWidth);
          if (activeCol !== idx) setActiveCol(idx);
        }}
        style={{ display: "flex", overflowX: "scroll", scrollSnapType: "x mandatory", scrollbarWidth: "none", flex: 1 }}
      >
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter(t => {
            if (col.id === "done") return t.is_done || t.status === "done";
            if (col.id === "todo") return !t.is_done && (!t.status || t.status === "todo");
            return !t.is_done && t.status === col.id;
          });
          return (
            <div key={col.id} style={{ minWidth: "100%", scrollSnapAlign: "start", padding: "12px 16px 24px", boxSizing: "border-box" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {colTasks.map(task => {
                    const priorityData = PRIORITY[task.priority || 'mid'] || PRIORITY.mid;
                    const isDoneCol = col.id === "done";
                    
                    return (
                        <div key={task.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderLeft: `5px solid ${priorityData.color}`, borderRadius: "14px", padding: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                            <div className="flex justify-between items-start gap-4">
                            <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: isDoneCol ? "#94a3b8" : "#0f1f10", textDecoration: isDoneCol ? "line-through" : "none" }}>
                                {task.title}
                            </p>
                            <div className="flex gap-2">
                                {!isDoneCol && (
                                    <button type="button" onClick={() => carryOverMutation.mutate(task.id)} style={{ background: "#f1f5f9", color: "#64748b", padding: "4px", borderRadius: "8px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", height: "28px", width: "28px" }}>
                                        <MoveDownIcon fontSize="small" sx={{color:"#ef4444", opacity: 0.7}}/>
                                    </button>
                                )}
                                <button
                                    type="button" 
                                    onClick={() => handleDone(task)} 
                                    style={{ 
                                        background: isDoneCol ? "#10b981" : "#f1f5f9", 
                                        color: isDoneCol ? "#fff" : "#64748b", 
                                        padding: "4px", 
                                        borderRadius: "8px", 
                                        border: "none", 
                                        cursor: "pointer",
                                        display: "flex", 
                                        alignItems: "center", 
                                        justifyContent: "center",
                                        height: "28px", 
                                        width: "28px",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    {isDoneCol ? <UndoIcon fontSize="small" sx={{color: "#13ec37", opacity: 0.7}} /> : <CheckIcon fontSize="small" sx={{color: "#13ec37", opacity: 0.7}}/>}
                                </button>
                            </div>
                            </div>
                            
                            <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            {COLUMNS.filter(c => c.id !== col.id).map(c => (
                                <button
                                type="button"
                                key={c.id}
                                onClick={() => moveTask(task.id, c.id)}
                                style={{ fontSize: "10px", padding: "4px 10px", borderRadius: "8px", border: `1px solid ${c.color}`, background: "none", color: c.color, cursor: "pointer", fontWeight: 800 }}
                                >
                                → {c.label.split(" ")[1]}
                                </button>
                            ))}
                            </div>
                        </div>
                    );
                })}
                {colTasks.length === 0 && <div className="text-center py-8 text-gray-400 text-sm font-bold">タスクがありません</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="page">
      <Box sx={{ minWidth: 120, mt: 2 }}>
        <FormControl
          fullWidth
          sx={{
            '& .MuiInputLabel-root': { color: '#666' },
            '& .MuiInputLabel-root.Mui-focused': { color: '#111' },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: '#ccc', borderRadius: '12px' },
              '&:hover fieldset': { borderColor: '#888' },
              '&.Mui-focused fieldset': { borderColor: '#111' },
            },
          }}
        >
          <InputLabel id="goal-select-label">目標を選択</InputLabel>
          <Select
            labelId="goal-select-label"
            value={currentGoalId}
            label="目標を選択"
            onChange={handleChange}
          >
            {currentGoalId === "" && <MenuItem value=""><em>未選択</em></MenuItem>}
            {goals.data?.map((goal) => (
              <MenuItem key={goal.id} value={goal.id}>{goal.title}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <section className="visionCard">
        <p className="chip">Long-term Vision</p>
        <h2>{selectedGoal ? selectedGoal.title : "長期目標が未設定です"}</h2>
        <div className="flex justify-between items-end">
           <p className="mutedText">今日の達成率: {doneRate}%</p>
           {isAllDone && <span className="text-[#13ec37] font-black text-sm">ALL CLEAR! 🐼✨</span>}
        </div>
        <div className="progressTrack">
          <div className="progressFill" style={{ width: `${doneRate}%` }} />
        </div>
      </section>

      <div className="statsGrid">
        <div className="statCard">
          <p className="statLabel">Tasks Done</p>
          <p className="statValue">
            {doneCount} <span>/ {filteredTasks.length}</span>
          </p>
        </div>
        <div className="statCard">
          <p className="statLabel">Your Rank</p>
          <p className="statValue">{ranking.data?.[0] ? `#${myRank}` : "-"}</p>
        </div>
      </div>

      <section className="card">
        <div className="flex justify-center mb-4 relative">
          <div className={`relative ${isAllDone ? "u--bounceInUp" : sasaThrows.length > 0 ? "targetPulse" : ""}`}>
            {isAllDone && (
              <>
                <div style={{ backgroundImage: "url('/heart.svg')", width: 20, height: 20, position: "absolute", top: 0, left: -12, animation: "heart 1.5s infinite ease-out", backgroundSize: "contain", backgroundRepeat: "no-repeat", zIndex: 30 }} />
                <div style={{ backgroundImage: "url('/heart-reverse.svg')", width: 20, height: 20, position: "absolute", bottom: -6, right: -14, animation: "heart 1.5s 0.2s infinite ease-out", backgroundSize: "contain", backgroundRepeat: "no-repeat", zIndex: 30 }} />
              </>
            )}
            
            <img src="/panda.png" alt="Mentor Panda" className="w-28 h-28 object-contain drop-shadow-md relative z-10 img-preserve-size" />
            
            {sasaThrows.map((id) => (
              <div 
                key={id} 
                className="absolute z-20 pointer-events-none" 
                style={{ 
                  left: "50%", 
                  bottom: "-120px", 
                  marginLeft: "-24px", 
                  animation: "throwSasa 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards" 
                }}
              >
                <img src="/sasa_1.png" className="w-12 h-12 rocketPulse" alt="sasa" />
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes throwSasa {
            0% { transform: translateY(0) scale(0.5) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            70% { transform: translateY(-130px) scale(1) rotate(180deg); opacity: 1; }
            100% { transform: translateY(-130px) scale(1) rotate(180deg); opacity: 0; }
          }
        `}</style>
        
        <div className="flex gap-1 items-center justify-center m-1">
          <h3 className="font-medium text-2xl">Today's Tasks</h3>
        </div>

        {currentGoalId ? renderKanbanBoard() : (
          <button type="button" className="goalCreateBtn" onClick={() => navigate("/goals", { state: { goalSectionTab: "create" } })}>
            目標を作成する
          </button>
        )}
      </section>

      <section className="bg-white rounded-3xl border border-gray-100 p-3 shadow-sm mb-6">
        <div className="flex justify-center items-center mb-8">
          <div className="text-2xl font-medium tracking-widest uppercase pt-3 pl-3">Friend Ranking</div>
        </div>
        <div className="flex justify-center items-end gap-6 pt-2 pb-2">
          {top3Ranking.length > 0 ? (
            <>
              {top3Ranking.length > 1 && renderRankItem(2, top3Ranking[1].user_id === appContext.userId, top3Ranking[1])}
              {top3Ranking.length > 0 && renderRankItem(1, top3Ranking[0].user_id === appContext.userId, top3Ranking[0])}
              {top3Ranking.length > 2 && renderRankItem(3, top3Ranking[2].user_id === appContext.userId, top3Ranking[2])}
            </>
          ) : (
            <p className="text-sm text-gray-400">データがありません</p>
          )}
        </div>
      </section>
    </section>
  );
}