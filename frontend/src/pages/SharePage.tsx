import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPost, fetchPosts, fetchRanking, getAuthSession, appContext, fetchDailyTasks } from "../lib/api";
import { Dialog, DialogContent, IconButton, Fade } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { FriendsDialogContent } from "../components/FriendsDialogContent";
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import ArrowCircleLeftIcon from '@mui/icons-material/ArrowCircleLeft';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

export function SharePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tab, setTab] = useState<"feed" | "rank">("feed");
  
  const [comment, setComment] = useState(localStorage.getItem("streeeak_draft_comment") || "");
  const [achieved, setAchieved] = useState("0");

  const [postTime, setPostTime] = useState(localStorage.getItem("streeeak_post_time") || "22:00");
  const [tempTime, setTempTime] = useState(localStorage.getItem("streeeak_temp_post_time") || postTime);
  const [timeLockEnd, setTimeLockEnd] = useState(Number(localStorage.getItem("streeeak_post_deadline_lock")) || 0);
  const [countdownStr, setCountdownStr] = useState("");
  const [isLocked, setIsLocked] = useState(Date.now() < timeLockEnd);

  const commentRef = useRef(comment);
  const achievedRef = useRef(achieved);

  useEffect(() => { 
    commentRef.current = comment; 
    localStorage.setItem("streeeak_draft_comment", comment);
  }, [comment]);
  
  useEffect(() => { achievedRef.current = achieved; }, [achieved]);

  useEffect(() => {
    localStorage.setItem("streeeak_temp_post_time", tempTime);
  }, [tempTime]);

  useEffect(() => {
    if (!getAuthSession()) {
      navigate("/login");
    }
  }, [navigate]);

  const posts = useQuery({ queryKey: ["posts"], queryFn: fetchPosts });
  const ranking = useQuery({ queryKey: ["ranking", "social"], queryFn: () => fetchRanking(50) });
  const dailyTasks = useQuery({ queryKey: ["dailyTasks", appContext.today], queryFn: fetchDailyTasks });

  const tasks = dailyTasks.data ?? [];
  const doneCount = tasks.filter((task) => task.is_done).length;
  const totalCount = tasks.length;
  const doneRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (dailyTasks.data) {
      setAchieved(totalCount > 0 ? (doneCount / totalCount).toFixed(2) : "0");
    }
  }, [doneCount, totalCount, dailyTasks.data]);

  const createMutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      setComment("");
      localStorage.removeItem("streeeak_draft_comment");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const handleSavePostTime = (newTime: string) => {
    const lockUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
    setPostTime(newTime);
    setTempTime(newTime);
    setTimeLockEnd(lockUntil);
    setIsLocked(true);
    localStorage.setItem("streeeak_post_time", newTime);
    localStorage.setItem("streeeak_temp_post_time", newTime);
    localStorage.setItem("streeeak_post_deadline_lock", lockUntil.toString());
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const [hours, minutes] = postTime.split(":").map(Number);
      
      const targetToday = new Date();
      targetToday.setHours(hours, minutes, 0, 0);

      let targetForCountdown = new Date(targetToday);
      if (now > targetForCountdown) {
         targetForCountdown.setDate(targetForCountdown.getDate() + 1);
      }
      
      const diffMs = targetForCountdown.getTime() - now.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
      
      setCountdownStr(`${diffHrs}時間 ${diffMins}分 ${diffSecs}秒`);

      const todayStr = now.toISOString().slice(0, 10);
      const lastPostDate = localStorage.getItem("streeeak_last_auto_post_date");

      if (now >= targetToday && lastPostDate !== todayStr && lastPostDate !== "pending") {
        localStorage.setItem("streeeak_last_auto_post_date", "pending");
        createMutation.mutate(
            { comment: commentRef.current || "今日のタスクを完了しました！", achieved: Number(achievedRef.current) },
            {
                onSuccess: () => {
                    localStorage.setItem("streeeak_last_auto_post_date", todayStr);
                },
                onError: () => {
                    localStorage.removeItem("streeeak_last_auto_post_date");
                }
            }
        );
      }

      setIsLocked(Date.now() < timeLockEnd);
    }, 1000);

    return () => clearInterval(interval);
  }, [postTime, timeLockEnd, createMutation]);

  return (
    <section className="page font-['Plus_Jakarta_Sans',sans-serif]">
      <style>{`
        @keyframes fadeInUpSoft {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUpSoft 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-[24px] font-extrabold m-0 tracking-[-0.02em] text-[#0f1f10]">COMMUNITY</h2>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 bg-[#13ec37] text-[#0f1f10] px-4 py-2 rounded-full text-[13px] font-bold shadow-[0_4px_16px_rgba(19,236,55,0.25)] border-none transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
        >
          <PersonAddIcon fontSize="small" />
          Add Friends
        </button>
      </div>

      <Dialog 
        open={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)}
        TransitionComponent={Fade}
        transitionDuration={{ enter: 400, exit: 300 }}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: '24px', border: '1px solid #e8ede8', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' } }}
      >
        <div className="flex justify-between items-center px-6 pt-6 pb-2">
          <h3 className="text-xl font-extrabold m-0 text-[#0f1f10]">Find Friends</h3>
          <IconButton onClick={() => setIsDialogOpen(false)} className="transition-transform duration-300 hover:rotate-90"><CloseIcon /></IconButton>
        </div>
        <DialogContent sx={{ px: 3, pb: 4 }}>
          <FriendsDialogContent />
        </DialogContent>
      </Dialog>

      <div className="flex gap-2 mb-5">
        <button 
          className={`flex-1 py-3 rounded-xl font-bold text-[13px] border transition-all duration-300 cursor-pointer ${
            tab === "feed" 
              ? "bg-[#13ec37]/10 border-[#13ec37]/30 text-[#0fbf2c] shadow-[0_4px_12px_rgba(19,236,55,0.1)]" 
              : "bg-white border-[#e8ede8] text-[#64748b] hover:bg-gray-50"
          }`}
          onClick={() => setTab("feed")}
        >
          <ViewTimelineIcon className="mr-1" fontSize="small"/> Feed
        </button>
        <button 
          className={`flex-1 py-3 rounded-xl font-bold text-[13px] border transition-all duration-300 cursor-pointer ${
            tab === "rank" 
              ? "bg-[#13ec37]/10 border-[#13ec37]/30 text-[#0fbf2c] shadow-[0_4px_12px_rgba(19,236,55,0.1)]" 
              : "bg-white border-[#e8ede8] text-[#64748b] hover:bg-gray-50"
          }`}
          onClick={() => setTab("rank")}
        >
          <MilitaryTechIcon className="mr-1" fontSize="small"/> Ranking
        </button>
      </div>

      <div key={tab} className="grid gap-5 animate-fade-in-up">
        {tab === "feed" ? (
          <>
            <div className="bg-white rounded-[20px] border border-[#e8ede8] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.05)] grid gap-3">
              <div className="bg-[#f8faf8] border border-[#e8ede8] rounded-xl p-3 text-sm">
                <div className="flex justify-between items-center mb-3">
                  <div className="font-bold text-[#0f1f10] flex items-center gap-1.5">
                    <AccessTimeIcon fontSize="small" className="text-[#0fbf2c]"/> 自動投稿設定
                  </div>
                  {isLocked && <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-1 rounded-full font-bold">{new Date(timeLockEnd).toLocaleDateString()}まで変更不可</span>}
                </div>
                <div className="flex gap-2 items-center mb-3">
                  <input 
                    type="time" 
                    value={isLocked ? postTime : tempTime} 
                    onChange={(e) => setTempTime(e.target.value)}
                    disabled={isLocked}
                    className="flex-1 border border-[#e8ede8] rounded-lg p-2 text-[14px] outline-none text-[#0f1f10] bg-white font-bold disabled:opacity-60"
                  />
                  {!isLocked && (
                    <button 
                      onClick={() => handleSavePostTime(tempTime)}
                      className="bg-[#0f1f10] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-transform active:scale-95"
                    >
                      保存
                    </button>
                  )}
                </div>
                <div className="text-[#0fbf2c] font-extrabold text-[12px] bg-[#13ec37]/10 p-2.5 rounded-lg text-center tracking-wider">
                  自動投稿まであと: {countdownStr || "計算中..."}
                </div>
              </div>

              <textarea
                className="w-full bg-[#f6f8f6] border border-[#e8ede8] rounded-xl p-3 text-[#0f1f10] text-[14px] outline-none box-border resize-none font-['Plus_Jakarta_Sans',sans-serif] mt-1"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="今日やったこと"
                rows={2}
              />
              
              <div className="flex flex-col gap-2 mt-2 border-t border-[#e8ede8] pt-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-[0.08em]">今日の達成率:</label>
                  <div className="flex items-center gap-2">
                    <span className={`text-[20px] font-extrabold ${doneRate === 100 ? 'text-[#13ec37]' : 'text-[#0fbf2c]'}`}>
                      {doneRate}%
                    </span>
                    <span className="text-[13px] text-[#64748b] font-bold">
                      ({doneCount}/{totalCount})
                    </span>
                  </div>
                </div>
                
                <div className="h-[10px] bg-[#f1f5f9] rounded-full overflow-hidden w-full mb-2">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${doneRate === 100 ? 'bg-[#13ec37] shadow-[0_0_8px_rgba(19,236,55,0.4)]' : 'bg-[#0fbf2c]'}`}
                    style={{ width: `${doneRate}%` }} 
                  />
                </div>
                
                <button
                  className="w-full bg-[#13ec37] text-[#0f1f10] px-6 py-3 rounded-xl text-[14px] font-bold shadow-[0_4px_16px_rgba(19,236,55,0.25)] border-none transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50 mt-1"
                  onClick={() => createMutation.mutate({ comment, achieved: Number(achieved) })}
                  disabled={!comment || createMutation.isPending}
                >
                  {createMutation.isPending ? "Posting..." : "Share Now"}
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              <h3 className="text-[11px] font-bold text-[#64748b] uppercase tracking-[0.1em] m-0 mb-1 px-1">Live Feed</h3>
              {posts.data?.length ? (
                posts.data.map((post) => {
                  const isYou = post.user_id === appContext.userId;
                  const pct = Math.round(post.achieved * 100);
                  const isPerfect = pct === 100;
                  
                  return (
                    <div key={post.id} className={`bg-white rounded-[20px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.05)] border ${
                      isYou ? 'border-[#13ec37]/30 bg-[#13ec37]/5' : 'border-[#e8ede8]'
                    }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-bold shrink-0 ${
                          isYou ? 'border-[2px] border-[#13ec37] bg-[#13ec37]/10 text-[#0fbf2c]' : 'border-[2px] border-[#e8ede8] bg-[#f1f5f9] text-[#64748b]'
                        }`}>
                          {post.user_id || "U"}
                        </div>
                        <div className="flex-1">
                          <div className={`text-[14px] font-bold ${isYou ? 'text-[#0fbf2c]' : 'text-[#0f1f10]'}`}>
                            {post.user_id}{isYou && " 🌟"}
                          </div>
                          <div className="text-[11px] text-[#64748b] mt-0.5">{post.date}</div>
                        </div>
                        <span className={`text-[18px] font-extrabold ${isPerfect ? 'text-[#13ec37]' : 'text-[#f59e0b]'}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-[8px] bg-[#f1f5f9] rounded-full overflow-hidden mb-3">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${isPerfect ? 'bg-[#13ec37] shadow-[0_0_8px_rgba(19,236,55,0.4)]' : 'bg-[#fbbf24]'}`}
                          style={{ width: `${pct}%` }} 
                        />
                      </div>
                      <p className="text-[13px] m-0 leading-relaxed text-[#0f1f10]">{post.comment}</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-[#64748b] text-[13px] px-1">まだ投稿がありません。</p>
              )}
            </div>
          </>
        ) : (
          <div className="grid gap-3">
            <h3 className="text-[11px] font-bold text-[#64748b] uppercase tracking-[0.1em] m-0 mb-1 px-1">Weekly Ranking</h3>
            {ranking.data?.length ? (
              ranking.data.map((r, i) => {
                const rank = i + 1;
                const isYou = r.user_id === appContext.userId;
                const pct = Math.round((r.achieved_avg || 0) * 100);
                
                return (
                  <div key={r.user_id} className={`bg-white rounded-[20px] flex items-center gap-3 p-[16px_20px] shadow-[0_1px_4px_rgba(0,0,0,0.05)] border ${
                    isYou ? 'border-[1.5px] border-[#13ec37]/30 bg-[#13ec37]/5' : 'border border-[#e8ede8]'
                  }`}>
                    <span className={`w-[28px] text-center font-black ${
                      rank <= 3 ? 'text-[20px]' : 'text-[14px]'
                    } ${
                      rank === 1 ? 'text-[#f59e0b]' : rank === 2 ? 'text-[#94a3b8]' : rank === 3 ? 'text-[#cd7f32]' : 'text-[#64748b]'
                    }`}>
                      #{rank}
                    </span>
                    
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-bold shrink-0 ${
                      isYou ? 'border-[2px] border-[#13ec37] bg-[#13ec37]/10 text-[#0fbf2c]' : 'border-[2px] border-[#e8ede8] bg-[#f1f5f9] text-[#64748b]'
                    }`}>
                      {r.user_name?.[0] || "U"}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-end mb-1.5">
                        <span className={`text-[14px] font-bold ${isYou ? 'text-[#0fbf2c]' : 'text-[#0f1f10]'}`}>
                          {r.user_name}{isYou && <ArrowCircleLeftIcon fontSize="small" className="ml-1 opacity-70"/>}
                        </span>
                      </div>
                      <div className="h-[8px] bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ 
                            width: `${pct}%`,
                            background: isYou ? '#13ec37' : '#94a3b8',
                            boxShadow: isYou ? '0 0 8px rgba(19,236,55,0.4)' : 'none'
                          }} 
                        />
                      </div>
                    </div>
                    
                    <span className={`text-[15px] font-extrabold min-w-[36px] text-right ${isYou ? 'text-[#0fbf2c]' : 'text-[#0f1f10]'}`}>
                      {pct}%
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-[#64748b] text-[13px] px-1">ランキングデータがありません。</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}