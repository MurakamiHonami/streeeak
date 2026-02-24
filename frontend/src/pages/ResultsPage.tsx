import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAllDailyTasks } from "../lib/api";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FlagIcon from '@mui/icons-material/Flag';
import StarHalfIcon from '@mui/icons-material/StarHalf';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DataExplorationIcon from '@mui/icons-material/DataExploration';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp';
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';
import FolderCopyIcon from '@mui/icons-material/FolderCopy';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BarChartIcon from '@mui/icons-material/BarChart';
interface DailyTask {
  is_done: boolean;
  week_number?: number;
  tags?: string;
}

interface WeekData {
  weekStr: string;
  week_number: number;
  done: number;
  total: number;
  pct: number;
}

interface CategoryStat {
  label: string;
  pct: number;
}

interface Achievement {
  icon: string;
  label: string;
  value: string;
  sub: string;
}

interface BarChartProps {
  data: WeekData[];
}


function getIsoWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function useWeeklyStats(tasks: any[], weeksCount: number = 7) {
  return useMemo(() => {
    const weeks: { weekStr: string; week_number: number; done: number; total: number; pct: number; }[] = [];
    for (let i = weeksCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const w = getIsoWeek(d);

      const dMon = new Date(d);
      const day = dMon.getDay() || 7;
      dMon.setDate(dMon.getDate() - day + 1);
      
      weeks.push({
        weekStr: `${dMon.getMonth() + 1}/${dMon.getDate()}`,
        week_number: w,
        done: 0,
        total: 0,
        pct: 0
      });
    }

    tasks.forEach(task => {
      if (!task.week_number) return;
      const targetWeek = weeks.find(w => w.week_number === task.week_number);
      if (targetWeek) {
        targetWeek.total += 1;
        if (task.is_done) {
          targetWeek.done += 1;
        }
      }
    });

    weeks.forEach(w => {
      w.pct = w.total > 0 ? Math.round((w.done / w.total) * 100) : 0;
    });

    return weeks;
  }, [tasks, weeksCount]);
}

function BarChart({ data }: { data: any[] }) {
  const maxPct = 100;
  const chartH = 120;
  const barW = 28;
  const gap = 10;
  const totalW = data.length * (barW + gap) - gap;

  return (
    <div className="overflow-x-auto pb-1 no-scrollbar">
      <svg width={Math.max(totalW + 24, 300)} height={chartH + 40} className="block">
        {[0, 25, 50, 75, 100].map(v => {
          const y = chartH - (v / maxPct) * chartH;
          return (
            <g key={v}>
              <line x1={0} y1={y} x2={totalW + 24} y2={y} stroke="#e8ede8" strokeWidth={1} />
              {v > 0 && (
                <text x={totalW + 26} y={y + 4} fontSize={9} fill="#64748b" textAnchor="start">{v}%</text>
              )}
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = i * (barW + gap);
          const barH = (d.pct / maxPct) * chartH;
          const y = chartH - barH;
          const isLast = i === data.length - 1;
          const fill = isLast ? "#13ec37" : "#e2f5e6";
          const textColor = isLast ? "#0fbf2c" : "#64748b";
          return (
            <g key={i}>
              <rect x={x} y={0} width={barW} height={chartH} rx={6} fill="#f8faf8" />
              <rect 
                x={x} y={y} width={barW} height={barH} rx={6} fill={fill}
                style={{ filter: isLast ? "drop-shadow(0 0 6px rgba(19,236,55,0.4))" : "none" }} 
              />
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={9} fontWeight={700} fill={textColor}>
                {d.pct}%
              </text>
              <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" fontSize={9} fontWeight={600} fill={isLast ? "#13ec37" : "#64748b"}>
                {d.weekStr}
              </text>
            </g>
          );
        })}
        {(() => {
          const i = data.length - 1;
          const x = i * (barW + gap) + barW / 2;
          return (
            <text x={x} y={chartH + 26} textAnchor="middle" fontSize={8} fontWeight={700} fill="#13ec37">今週</text>
          );
        })()}
      </svg>
    </div>
  );
}

export function ResultsPage() {
  const [period, setPeriod] = useState<"4w" | "7w">("7w");
  const { data: allTasks = [] } = useQuery({ queryKey: ["allDailyTasks"], queryFn: fetchAllDailyTasks });

  const fullData = useWeeklyStats(allTasks, 7);
  const shownData = period === "7w" ? fullData : fullData.slice(3);

  const avgPct = shownData.length ? Math.round(shownData.reduce((s, d) => s + d.pct, 0) / shownData.length) : 0;
  const totalDone = shownData.reduce((s, d) => s + d.done, 0);
  const totalTasks = shownData.reduce((s, d) => s + d.total, 0);

  const validWeeks = shownData.filter(w => w.total > 0);
  const bestWeek = validWeeks.length ? validWeeks.reduce((max, w) => w.pct > max.pct ? w : max, validWeeks[0]) : null;
  const worstWeek = validWeeks.length ? validWeeks.reduce((min, w) => w.pct < min.pct ? w : min, validWeeks[0]) : null;

  const categoryMap = allTasks.reduce((acc, task) => {
    const key = task.tags || "未分類";
    if (!acc[key]) acc[key] = { done: 0, total: 0 };
    acc[key].total += 1;
    if (task.is_done) acc[key].done += 1;
    return acc;
  }, {} as Record<string, { done: number, total: number }>);

  const categoryData = Object.entries(categoryMap)
    .map(([label, stat]) => ({
      label,
      pct: stat.total ? Math.round((stat.done / stat.total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  const achievements = [
    { icon: <CheckCircleIcon sx={{color: "#13ec37"}}/>, label: "タスク完了", value: `${allTasks.filter((t: any) => t.is_done).length}件`, sub: "累計" },
    { icon: <FlagIcon sx={{color: "#13ec37"}}/>, label: "目標タスク", value: `${allTasks.length}件`, sub: "累計作成" },
    { icon: <StarHalfIcon sx={{color: "#13ec37"}}/>, label: "平均達成率", value: `${avgPct}%`, sub: `過去${period === "7w" ? 7 : 4}週` },
    { icon: <CalendarMonthIcon sx={{color: "#13ec37"}}/>, label: "活動週数", value: `${validWeeks.length}週`, sub: "記録あり" },
  ];

  const currentWeekPct = shownData[shownData.length - 1]?.pct || 0;
  const prevWeekPct = shownData[shownData.length - 2]?.pct || 0;
  const trend = currentWeekPct - prevWeekPct;

  return (
    <section className="grid gap-5 font-['Plus_Jakarta_Sans',sans-serif] pb-24">
      <section className="bg-[#0f172a] rounded-[20px] p-[24px] text-white relative overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.18)]">
        <div className="relative z-10">
          <div className="inline-flex items-center px-3 py-1 bg-[#13ec37]/15 border border-[#13ec37]/30 rounded-full text-[10px] font-bold tracking-[0.08em] uppercase text-[#13ec37] mb-3">
            Your Stats
          </div>
          <h2 className="text-[20px] font-extrabold leading-snug m-0 mb-1">
            平均達成率 <span className="text-[#13ec37]">{avgPct}%</span>
          </h2>
          <p className="text-[#94a3b8] text-[13px] m-0">
            累計 <strong className="text-white">{totalDone}</strong> / {totalTasks} タスク達成
          </p>
          <div className="h-[8px] bg-[#1e293b] rounded-full overflow-hidden mt-3">
            <div 
              className="h-full bg-[#13ec37] rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${avgPct}%`, boxShadow: "0 0 10px rgba(19,236,55,0.4)" }} 
            />
          </div>
        </div>
        <div className="absolute -top-5 -right-5 w-[120px] h-[120px] bg-[#13ec37]/10 rounded-full blur-[30px] z-0" />
        <div className="absolute -bottom-2 -left-2 w-[80px] h-[80px] bg-[#13ec37]/5 rounded-full blur-[20px] z-0" />
      </section>


      <section className="bg-white rounded-[20px] border border-[#e8ede8] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center mb-4">
          <div className="text-2xl text-center font-normal tracking-[0.1em] ml-12 m-2 tracking-[0.1em] uppercase"><BarChartIcon/> 週間達成率</div>
          <div className="flex gap-1.5">
            {[["4w", "4週"], ["7w", "7週"]].map(([key, label]) => (
              <button 
                key={key} 
                onClick={() => setPeriod(key as "4w" | "7w")} 
                className={`text-[11px] px-3 py-1 rounded-full font-bold transition-colors border ${
                  period === key 
                    ? "bg-[#13ec37]/10 border-[#13ec37]/30 text-[#13ec37]" 
                    : "bg-transparent border-[#e8ede8] text-[#64748b]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <BarChart data={shownData} />
        
        <div className="mt-3.5 p-3 flex items-center gap-2 bg-[#13ec37]/10 border border-[#13ec37]/30 rounded-xl text-[12px] text-[#0fbf2c] font-normal">
          {trend >= 0 ? (
            <>
              <ArrowCircleUpIcon fontSize="small" />
              <span>先週比 +{trend}pt — この調子で続けよう！</span>
            </>
          ) : (
            <>
              <ArrowCircleDownIcon fontSize="small" />
              <span>先週比 {trend}pt — 今週はここから挽回！</span>
            </>
          )}
        </div>
      </section>

      <section className="bg-white rounded-[20px] border border-[#e8ede8] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        <div className="text-2xl text-center m-4 font-normal tracking-[0.1em] uppercase mb-4"><MilitaryTechIcon/> 累計達成</div>
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((a, i) => (
            <div key={i} className="bg-[#f6f8f6] border border-[#e8ede8] rounded-2xl p-4">
              <div className="text-[22px] mb-1.5">{a.icon}</div>
              <div className="text-[18px] font-extrabold text-[#0f1f10] leading-none">{a.value}</div>
              <div className="text-[11px] font-bold text-[#64748b] mt-1">{a.label}</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">{a.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-[20px] border border-[#e8ede8] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        <div className="text-2xl text-center m-4 font-normal tracking-[0.1em] uppercase mb-4"><FolderCopyIcon/> カテゴリ別達成率</div>
        {categoryData.length > 0 ? categoryData.map((c, i) => (
          <div key={i} className={`mb-${i < categoryData.length - 1 ? '4' : '0'}`}>
            <div className="flex justify-between mb-1.5">
              <span className="text-[13px] font-bold text-[#0f1f10]">{c.label}</span>
              <span className="text-[13px] font-extrabold text-[#0fbf2c]">{c.pct}%</span>
            </div>
            <div className="h-[8px] bg-[#f1f5f9] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#13ec37] rounded-full shadow-[0_0_8px_rgba(19,236,55,0.4)] transition-all duration-500" 
                style={{ width: `${c.pct}%` }} 
              />
            </div>
          </div>
        )) : (
          <p className="text-[13px] text-[#64748b]">まだカテゴリの記録がありません。</p>
        )}
      </section>

      <div className="flex gap-3">
        <div className="bg-[#13ec37]/10 border border-[#13ec37]/30 rounded-[20px] p-4 flex-1">
          <div className="text-base font-normal tracking-[0.1em] uppercase text-[#0fbf2c] mb-2"><EmojiEventsIcon/> Best Week</div>
          <div className="text-[24px] font-extrabold text-[#13ec37]">{bestWeek ? `${bestWeek.pct}%` : "-"}</div>
          <div className="text-[12px] text-[#0fbf2c] mt-0.5 font-bold">{bestWeek ? bestWeek.weekStr : ""}</div>
        </div>
        <div className="bg-white border border-[#e8ede8] rounded-[20px] p-4 flex-1 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
          <div className="text-base font-normal tracking-[0.1em] uppercase text-[#64748b] mb-2"><TrendingDownIcon/> Worst Week</div>
          <div className="text-[24px] font-extrabold text-[#f59e0b]">{worstWeek ? `${worstWeek.pct}%` : "-"}</div>
          <div className="text-[12px] text-[#64748b] mt-0.5 font-bold">{worstWeek ? worstWeek.weekStr : ""}</div>
        </div>
      </div>
    </section>
  );
}