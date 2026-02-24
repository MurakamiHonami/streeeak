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

  useEffect(() => {
    if (goals.data && goals.data.length > 0 && currentGoalId === "") {
      setCurrentGoalId(goals.data[goals.data.length - 1].id);
    }
  }, [goals.data, currentGoalId]);

  const handleChange = (event: SelectChangeEvent<number | "">) => {
    setCurrentGoalId(event.target.value as number | "");
  };

  const tasks = dailyTasks.data ?? [];
  const filteredTasks = currentGoalId !== "" 
    ? tasks.filter(task => task.goal_id === currentGoalId)
    : [];

  console.log(tasks)
  const doneCount = filteredTasks.filter((task) => task.is_done).length;
  const firstPendingId = filteredTasks.find((task) => !task.is_done)?.id;
  const doneRate = filteredTasks.length ? Math.round((doneCount / filteredTasks.length) * 100) : 0;
  
  const selectedGoal = goals.data?.find(g => g.id === currentGoalId);
  const rankingList = ranking.data ?? [];
  const top3Ranking = rankingList.slice(0, 3);
  const myRankIndex = rankingList.findIndex((item) => item.user_id === appContext.userId);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const myRankItem = myRankIndex >= 0 ? rankingList[myRankIndex] : null;
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
      <Box sx={{ minWidth: 120, mb: 2 }}>
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

      <section className="visionCard">
        <p className="chip">Long-term Vision</p>
        <h2>{selectedGoal ? selectedGoal.title : "長期目標が未設定です"}</h2>
        <p className="mutedText">今日の達成率: {doneRate}%</p>
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
        <div className="flex gap-1 items-center justify-center m-1">
          <h3 className="font-medium text-2xl">Today's Tasks</h3>
          <img src="/panda.png" alt="Mentor Panda" className="h-12 w-12 object-contain drop-shadow-sm" />
        </div>
        
        {filteredTasks.length ? (
          filteredTasks.map((task) => {
            const subTasks = task.note 
              ? task.note.split("\n").map(line => line.replace(/^- /, "").trim()).filter(Boolean)
              : [];

            if (subTasks.length === 0) {
              return (
                <TaskRow 
                  key={task.id} 
                  task={task} 
                  title={task.title} 
                  isNext={firstPendingId === task.id && !task.is_done}
                  onDone={() => doneMutation.mutate(task.id)}
                  onCarryOver={() => carryOverMutation.mutate(task.id)}
                />
              );
            }

            return (
              <div key={task.id} className="mb-4">
                <p className="text-sm font-bold text-gray-500 mb-2">■ {task.title}</p>
                {subTasks.map((subTaskText, idx) => (
                  <TaskRow 
                    key={`${task.id}-${idx}`} 
                    task={task} 
                    title={subTaskText} 
                    isNext={firstPendingId === task.id && !task.is_done && idx === 0}
                    onDone={() => doneMutation.mutate(task.id)}
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
        <p className={task.is_done ? "done" : ""}>{title}</p>
        {task.tags && <small>{task.tags}</small>}
      </div>
      <div className="rowActions flex flex-col">
        <button onClick={onDone} className="text-sm hover:opacity-70">
          {task.is_done ? <UndoIcon /> : <CheckIcon />}
        </button>
        {!task.is_done && (
          <button onClick={onCarryOver} className="text-sm bg-gray-200 hover:opacity-70">
            <MoveDownIcon />
          </button>
        )}
      </div>
    </div>
  );
}