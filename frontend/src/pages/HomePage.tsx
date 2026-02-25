import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appContext, carryOverTask, fetchDailyTasks, fetchRanking, toggleTaskDone, fetchGoals } from "../lib/api";
import CheckIcon from '@mui/icons-material/Check';
import MoveDownIcon from '@mui/icons-material/MoveDown';
import UndoIcon from '@mui/icons-material/Undo';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';

export function HomePage() {
  const queryClient = useQueryClient();
  const dailyTasks = useQuery({ queryKey: ["dailyTasks"], queryFn: fetchDailyTasks });
  const ranking = useQuery({ queryKey: ["ranking", "home"], queryFn: () => fetchRanking(50) });
  const goals = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });

  const doneMutation = useMutation({
    mutationFn: toggleTaskDone,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dailyTasks"] }),
  });
  
  const carryOverMutation = useMutation({
    mutationFn: carryOverTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dailyTasks"] }),
  });

  const [currentGoalId, setCurrentGoalId] = useState<number | "">("");
  const [sasaThrows, setSasaThrows] = useState<number[]>([]);

  useEffect(() => {
    if (goals.data && goals.data.length > 0 && currentGoalId === "") {
      setCurrentGoalId(goals.data[goals.data.length - 1].id);
    }
  }, [goals.data, currentGoalId]);

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
    }
    doneMutation.mutate(task.id);
  };

  const tasks = dailyTasks.data ?? [];
  const filteredTasks = currentGoalId !== "" 
    ? tasks.filter(task => task.goal_id === currentGoalId)
    : [];

  const doneCount = filteredTasks.filter((task) => task.is_done).length;
  const firstPendingId = filteredTasks.find((task) => !task.is_done)?.id;
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
          <div className={`${avatarSize} rounded-full flex items-center justify-center font-extrabold ${avatarBg}`}>
            {data.user_name?.[0] || "U"}
          </div>
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

  return (
    <section className="page">
      <section className="visionCard">
        <p className="chip">Long-term Vision</p>
        <h2>{selectedGoal ? selectedGoal.title : "長期目標が未設定です"}</h2>
        <p className="mutedText">今日の達成率: {doneRate}%</p>
        <div className="progressTrack">
          <div className="progressFill" style={{ width: `${doneRate}%` }} />
        </div>
      </section>
      
      <Box sx={{ minWidth: 120, mt: 2 }}>
        <FormControl
          fullWidth
          sx={{
            '& .MuiInputLabel-root': { color: '#666' },
            '& .MuiInputLabel-root.Mui-focused': { color: '#111' },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: '#ccc' },
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
        <div className="flex gap-1 items-center justify-center m-1">
          <h3 className="font-medium text-2xl">Today's Tasks</h3>
        </div>
        
        <div className="flex justify-center my-6 relative">
          <div className={`relative ${isAllDone ? "u--bounceInUp" : sasaThrows.length > 0 ? "targetPulse" : ""}`}>
            {isAllDone && (
              <>
                <div style={{ backgroundImage: "url('/heart.svg')", width: 20, height: 20, position: "absolute", top: 0, left: -12, animation: "heart 1.5s infinite ease-out", backgroundSize: "contain", backgroundRepeat: "no-repeat", zIndex: 30 }} />
                <div style={{ backgroundImage: "url('/heart-reverse.svg')", width: 20, height: 20, position: "absolute", bottom: -6, right: -14, animation: "heart 1.5s 0.2s infinite ease-out", backgroundSize: "contain", backgroundRepeat: "no-repeat", zIndex: 30 }} />
              </>
            )}
            
            <img src="/panda.png" alt="Mentor Panda" className="w-28 h-28 object-contain drop-shadow-md relative z-10" />
            
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
        
        {filteredTasks.length ? (
          filteredTasks.map((task) => {
            const subTasks = task.note 
              ? task.note.split("\n").map((line: string) => line.replace(/^- /, "").trim()).filter(Boolean)
              : [];

            if (subTasks.length === 0) {
              return (
                <TaskRow 
                  key={task.id} 
                  task={task} 
                  title={task.title} 
                  isNext={firstPendingId === task.id && !task.is_done}
                  onDone={() => handleDone(task)}
                  onCarryOver={() => carryOverMutation.mutate(task.id)}
                />
              );
            }

            return (
              <div key={task.id} className="mb-4">
                <p className="text-sm font-bold text-gray-500 mb-2">■ {task.title}</p>
                {subTasks.map((subTaskText: string, idx: number) => (
                  <TaskRow 
                    key={`${task.id}-${idx}`} 
                    task={task} 
                    title={subTaskText} 
                    isNext={firstPendingId === task.id && !task.is_done && idx === 0}
                    onDone={() => handleDone(task)}
                    onCarryOver={() => carryOverMutation.mutate(task.id)}
                  />
                ))}
              </div>
            );
          })
        ) : (
          <p>この目標に対する今日のタスクはありません。</p>
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

function TaskRow({ task, title, isNext, onDone, onCarryOver }: any) {
  return (
    <div className={isNext ? "taskRow nextTask" : "taskRow"}>
      <div>
        <p className={`transition-all duration-300 ease-in-out ${task.is_done ? "done opacity-60" : ""}`}>{title}</p>
        {task.tags && <small>{task.tags}</small>}
      </div>
      <div className="rowActions flex flex-col items-center justify-center">
        <button 
          onClick={onDone} 
          className="relative w-8 h-8 flex items-center justify-center text-sm transition-transform duration-200 ease-in-out hover:scale-110 active:scale-90"
        >
          <div className={`absolute flex items-center justify-center transition-all duration-300 ease-in-out ${task.is_done ? 'opacity-0 scale-50 rotate-90 pointer-events-none' : 'opacity-100 scale-100 rotate-0'}`}>
            <CheckIcon />
          </div>
          <div className={`absolute flex items-center justify-center transition-all duration-300 ease-in-out ${task.is_done ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90 pointer-events-none'}`}>
            <UndoIcon />
          </div>
        </button>
        
        <div className={`transition-all duration-300 ease-in-out origin-top flex items-center justify-center ${task.is_done ? 'opacity-0 max-h-0 scale-y-0 pointer-events-none mt-0' : 'opacity-100 max-h-10 scale-y-100 mt-2'}`}>
          <button 
            onClick={onCarryOver} 
            className="w-8 h-8 flex items-center justify-center text-sm bg-gray-200 rounded-full transition-transform duration-200 ease-in-out hover:scale-110 active:scale-90"
          >
            <MoveDownIcon />
          </button>
        </div>
      </div>
    </div>
  );
}