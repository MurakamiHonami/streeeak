import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { carryOverTask, fetchDailyTasks, fetchRanking, toggleTaskDone, fetchGoals } from "../lib/api";
import CheckIcon from '@mui/icons-material/Check';
import MoveDownIcon from '@mui/icons-material/MoveDown';
import UndoIcon from '@mui/icons-material/Undo';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { useState } from "react";

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

  const goals = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });

  const tasks = dailyTasks.data ?? [];
  const doneCount = tasks.filter((task) => task.is_done).length;
  const firstPendingId = tasks.find((task) => !task.is_done)?.id;
  const doneRate = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const latestGoal = goals.data && goals.data.length > 0 
    ? goals.data[goals.data.length - 1] 
    : null;
  const [currentGoal,setCurrentGoal] = useState(latestGoal?.title ?? "");

  const handleChange = (event: SelectChangeEvent) => {
    setCurrentGoal(event.target.value);
  };

  console.log(tasks);
  return (
    <section className="page">
      <Box sx={{ minWidth: 120 }}>
        <FormControl fullWidth>
          <InputLabel id="demo-simple-select-label">目標を選択</InputLabel>
          <Select
            value={latestGoal?.title ?? "目標が未設定です"}
            label="Goal"
            onChange={handleChange}
          >
            {goals.data?.map((goal) => (
              <MenuItem key={goal.id} value={goal.title}>{goal.title}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <section className="visionCard">
        <p className="chip">Long-term Vision</p>
        <h2>{latestGoal ? latestGoal.title : "長期目標が未設定です"}</h2>
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
        <div className="flex gap-1 items-center">
          <h3 className="font-medium text-3xl">Today's Tasks</h3>
          <img src="/panda.png" alt="Mentor Panda" className="h-12 w-12 object-contain drop-shadow-sm" />
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
              <div className="rowActions flex flex-col">
                <button onClick={() => doneMutation.mutate(task.id)} className="text-sm hover:opacity-70" >
                  {task.is_done ? <UndoIcon/> : <CheckIcon/>}
                </button>
                {!task.is_done && (
                  <button onClick={() => carryOverMutation.mutate(task.id)} className="text-sm bg-gray-200 hover:opacity-70">{<MoveDownIcon/>}</button>
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
          <h3 className="font-medium text-xl">Friend Ranking (TOP3)</h3>
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
