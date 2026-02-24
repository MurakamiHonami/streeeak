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
          <p className="statLabel">Top Rank</p>
          <p className="statValue">{ranking.data?.[0] ? "TOP" : "-"}</p>
        </div>
      </div>

      <section className="card">
        <div className="flex gap-1 items-center mb-4">
          <h3 className="font-medium text-3xl">Today's Tasks</h3>
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

      <section className="card mt-4">
        <div className="sectionHead">
          <h3 className="font-medium text-xl">Friend Ranking (TOP3)</h3>
        </div>
        {top3Ranking.length ? (
          top3Ranking.map((item, index) => (
            <div key={item.user_id} className="rankRow flex justify-between items-center border-b border-gray-50 last:border-0 py-4">
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-400">#{index + 1}</span>
                <span className="font-medium">{item.user_name}</span>
              </div>
              <strong className="text-xl font-black italic">{(item.achieved_avg * 100).toFixed(1)}%</strong>
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-sm mt-2">ランキングデータがありません。</p>
        )}
        {myRank !== null && myRank > 3 && myRankItem && (
          <div className="rankRow flex justify-between items-center border-t border-gray-200 pt-4 mt-2">
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-400">#{myRank}</span>
              <span className="font-medium">You ({myRankItem.user_name})</span>
            </div>
            <strong className="text-xl font-black italic">{(myRankItem.achieved_avg * 100).toFixed(1)}%</strong>
          </div>
        )}
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