import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { 
  createPost, fetchPosts, fetchRanking, getAuthSession, 
  appContext, fetchDailyTasks, fetchUser, updateAutoPostTime, togglePostLike, deletePost, resolveApiAssetUrl
} from "../lib/api";
import { Dialog, DialogContent, IconButton, Fade, CircularProgress, Chip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { FriendsDialogContent } from "../components/FriendsDialogContent";
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import ArrowCircleLeftIcon from '@mui/icons-material/ArrowCircleLeft';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import StarsIcon from '@mui/icons-material/Stars';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TaskAltIcon from '@mui/icons-material/TaskAlt';

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
  const [inputMode, setInputMode] = useState<"text" | "task">("text");
  
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

  const { data: userProfile } = useQuery({ queryKey: ["user"], queryFn: fetchUser });
  const posts = useQuery({ queryKey: ["posts"], queryFn: fetchPosts });
  const ranking = useQuery({ queryKey: ["ranking", "social"], queryFn: () => fetchRanking(50) });
  const dailyTasks = useQuery({ queryKey: ["dailyTasks", appContext.today], queryFn: fetchDailyTasks });

  const tasks = dailyTasks.data ?? [];
  const doneCount = tasks.filter((task) => task.is_done).length;
  const totalCount = tasks.length;
  const doneRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const [selectedTasks, setSelectedTasks] = useState<number[]>(
      JSON.parse(localStorage.getItem("streeeak_draft_tasks") || "[]")
  );

  const tasksRef = useRef(tasks);
  const selectedTasksRef = useRef(selectedTasks);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => {
    selectedTasksRef.current = selectedTasks;
    localStorage.setItem("streeeak_draft_tasks", JSON.stringify(selectedTasks));
  }, [selectedTasks]);

  const handleTaskToggle = (taskId: number) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const buildFinalComment = (baseComment: string, taskList: any[], selected: number[]) => {
    if (selected.length === 0) return baseComment;
    const taskText = taskList
      .filter(t => selected.includes(t.id))
      .map((t) => `✓ ${t.title}`)
      .join('\n');
    return baseComment ? `${taskText}\n\n${baseComment}` : taskText;
  };

  useEffect(() => {
    if (userProfile?.auto_post_time && !isLocked) {
      const formatted = userProfile.auto_post_time.slice(0, 5);
      setPostTime(formatted);
      setTempTime(formatted);
    }
  }, [userProfile?.auto_post_time, isLocked]);

  useEffect(() => {
    if (dailyTasks.data) {
      setAchieved(totalCount > 0 ? (doneCount / totalCount).toFixed(2) : "0");
    }
  }, [doneCount, totalCount, dailyTasks.data]);

  const updateTimeMutation = useMutation({
    mutationFn: updateAutoPostTime,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user"] }),
  });

  const createMutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      setComment("");
      setSelectedTasks([]);
      localStorage.removeItem("streeeak_draft_comment");
      localStorage.removeItem("streeeak_draft_tasks");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const toggleLikeMutation = useMutation({
    mutationFn: togglePostLike,
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      const previousPosts = queryClient.getQueryData(["posts"]);
      
      queryClient.setQueryData(["posts"], (old: any) => {
        if (!old) return old;
        return old.map((p: any) => {
          if (p.id === postId) {
            const isLiked = !p.is_liked_by_you;
            return {
              ...p,
              is_liked_by_you: isLiked,
              likes_count: p.likes_count + (isLiked ? 1 : -1)
            };
          }
          return p;
        });
      });
      return { previousPosts };
    },
    onError: (err, variables, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(["posts"], context.previousPosts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePost,
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      const previousPosts = queryClient.getQueryData(["posts"]);
      
      queryClient.setQueryData(["posts"], (old: any) => {
        if (!old) return old;
        return old.filter((p: any) => p.id !== postId);
      });
      return { previousPosts };
    },
    onError: (err, variables, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(["posts"], context.previousPosts);
      }
    },
    onSettled: () => {
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
    
    updateTimeMutation.mutate(newTime);
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
        
        const finalCmt = buildFinalComment(
          commentRef.current || "今日のタスクを完了しました！", 
          tasksRef.current, 
          selectedTasksRef.current
        );

        createMutation.mutate(
            { comment: finalCmt, achieved: Number(achievedRef.current) },
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
        .bounce-transition {
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .post-card {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
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
              <div className="bg-[#f8faf8] border border-[#e8ede8] rounded-lex rounded-lg p-1 items-center gap-2 justify-center">
                <button
                  className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 text-[12px] font-bold transition-all rounded-lg duration-700 cursor-pointer m-2 min-h-[34px] ${
                    inputMode === "task" ? "bg-[#13ec37]/10 text-[#0fbf2c] shadow-sm shadow-[0_4px_12px_rgba(19,236,55,0.1)]": "bg-white border-[#e8ede8] text-[#0f1f10] shadow-sm shadow-[0_4px_12px_rgba(19,236,55,0.1)]"
                  }`}
                  onClick={() => setInputMode(prev => prev === "task" ? "text" : "task")}
                >
                  <FormatListBulletedIcon sx={{ fontSize: 14, display: 'block' }} />タスク選択
                </button>
                <div className={`grid transition-all duration-300 ease-in-out ${inputMode === "task" ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0 mt-0"}`}>
                    <div className="overflow-hidden">
                        <div className="max-h-[160px] overflow-y-auto pr-2  rounded-xl p-2 bg-[#f8faf8]">
                            {tasks.filter(task => task.is_done).length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {tasks.filter(task => task.is_done).map(task => (
                                        <Chip
                                        key={task.id}
                                        label={task.title}
                                        onClick={() => handleTaskToggle(task.id)}
                                        icon={selectedTasks.includes(task.id) ? <CheckCircleIcon /> : undefined}
                                        sx={{
                                          fontWeight: 'bold',
                                          fontSize: '12px',
                                          borderRadius: '8px',
                                          backgroundColor: selectedTasks.includes(task.id) ? '#13ec37' : 'transparent',
                                          color: selectedTasks.includes(task.id) ? '#0f1f10' : '#64748b',
                                          border: '1px solid',
                                          borderColor: selectedTasks.includes(task.id) ? '#13ec37' : '#e8ede8',
                                          '&:hover': {
                                            backgroundColor: selectedTasks.includes(task.id) ? '#0fbf2c' : '#f8faf8',
                                          },
                                          '& .MuiChip-icon': {
                                            color: selectedTasks.includes(task.id) ? '#0f1f10' : 'inherit'
                                          }
                                        }}
                                        />
                                    ))}
                                </div>
                            ) : (
                              <p className="text-xs text-[#64748b] text-center my-2 font-bold">今日のタスクがありません</p>
                            )}
                        </div>
                    </div>
                </div>
              </div>
              <textarea
                className="w-full bg-[#f6f8f6] border border-[#e8ede8] rounded-xl p-3 text-[#0f1f10] text-[14px] outline-none box-border resize-none font-['Plus_Jakarta_Sans',sans-serif] mt-1 transition-all focus:border-[#13ec37]/50"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={inputMode === "task" ? "追加のコメントがあれば入力" : "今日やったこと"}
                rows={inputMode === "task" ? 1 : 2}
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
                  className="relative flex justify-center items-center h-[48px] w-full bg-[#13ec37] text-[#0f1f10] rounded-xl text-[14px] font-bold shadow-[0_4px_16px_rgba(19,236,55,0.25)] border-none transition-all duration-300 hover:shadow-[0_6px_20px_rgba(19,236,55,0.35)] hover:-translate-y-0.5 active:scale-95 active:translate-y-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-1 overflow-hidden group"
                  onClick={() => {
                    const finalComment = buildFinalComment(comment, tasks, selectedTasks);
                    createMutation.mutate({ comment: finalComment, achieved: Number(achieved) });
                  }}
                  disabled={!(comment || selectedTasks.length > 0) || createMutation.isPending}
                >
                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-in-out ${createMutation.isPending ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <CircularProgress size={24} sx={{ color: '#0f1f10' }} />
                  </div>
                  <div className={`flex items-center justify-center gap-2 transition-all duration-300 ease-in-out ${createMutation.isPending ? 'opacity-0 -translate-y-8' : 'opacity-100 translate-y-0'}`}>
                    <SendIcon fontSize="small" className="transition-transform duration-700" />
                    <span>Share Now</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              <h3 className="text-[11px] font-bold text-[#64748b] uppercase tracking-[0.1em] m-0 mb-1 px-1">Live Feed</h3>
              {posts.data?.length ? (
                posts.data.map((post: any) => {
                  const isYou = post.user_id === appContext.userId;
                  const pct = Math.round(post.achieved * 100);
                  const isPerfect = pct === 100;
                  const initial = post.user_name ? post.user_name[0] : "U";
                  const displayName = post.user_name || `User ${post.user_id}`;
                  const isDeleting = deleteMutation.isPending && deleteMutation.variables === post.id;
                  
                  return (
                    <div 
                      key={post.id} 
                      className={`bg-[#f8faf8] post-card rounded-[20px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.05)] border ${
                        isYou ? 'border-[#13ec37]/30' : 'border-[#e8ede8]'
                      } ${isDeleting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {post.user_avatar_url ? (
                          <img
                            src={resolveApiAssetUrl(post.user_avatar_url) ?? ""}
                            alt={displayName}
                            className={`w-12 h-12 rounded-full object-cover shrink-0 ${
                              isYou ? 'border-[2px] border-[#13ec37]' : 'border-[2px] border-[#e8ede8]'
                            }`}
                          />
                        ) : (
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-bold shrink-0 ${
                            isYou ? 'border-[2px] border-[#13ec37] bg-[#13ec37]/10 text-[#0fbf2c]' : 'border-[2px] border-[#e8ede8] bg-[#f1f5f9] text-[#64748b]'
                          }`}>
                            {initial}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className={`flex items-center text-[14px] font-bold 'text-[#0f1f10]'}`}>
                            {displayName}
                            {isYou && <StarsIcon sx={{ fontSize: 16, ml: 0.5 }} />}
                          </div>
                          <div className="text-[11px] text-[#64748b] mt-0.5">{new Date(post.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <div>
                            {isYou && (
                              <button
                              onClick={() => {
                                  if (window.confirm("この投稿を削除しますか？")) {
                                    deleteMutation.mutate(post.id);
                                  }
                                }}
                                disabled={isDeleting}
                                className="flex items-center gap-1 px-1.5 py-1.5 rounded-full text-[12px] font-bold transition-all duration-300 cursor-pointer bg-white border border[#64748b]/30 text-[#64748b] hover:bg-[#13ec37]/10 active:scale-95 disabled:opacity-50"
                              >
                                <DeleteOutlineIcon fontSize="small" sx={{color:"#64748b"}}/>
                              </button>
                            )}
                          </div>
                          <span className={`text-[18px] font-extrabold ${isPerfect ? 'text-[#13ec37]' : 'text-[#0fbf2c]'}`}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-[8px] bg-[#f1f5f9] rounded-full overflow-hidden mb-3">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${isPerfect ? 'bg-[#13ec37] shadow-[0_0_8px_rgba(19,236,55,0.4)]' : 'bg-[#0fbf2c]'}`}
                          style={{ width: `${pct}%` }} 
                        />
                      </div>
                      
                      <div className="text-[13px] m-0 leading-relaxed text-[#0f1f10]">
                        {post.comment.split('\n').map((line: string, index: number, array: string[]) => {
                          if (line.startsWith('✓ ') || line.startsWith('・')) {
                            const text = line.startsWith('✓ ') ? line.substring(2) : line.substring(1);
                            return (
                              <div key={index} className="flex items-start gap-1 my-1">
                                <TaskAltIcon sx={{ color: "#13ec37", fontSize: 16, mt: "2px" }} />
                                <span className="font-bold">{text}</span>
                              </div>
                            );
                          }
                          return (
                            <span key={index}>
                              {line}
                              {index < array.length - 1 && <br />}
                            </span>
                          );
                        })}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-[#e8ede8]/50 flex justify-end items-center">
                        <button
                          onClick={() => toggleLikeMutation.mutate(post.id)}
                          disabled={toggleLikeMutation.isPending}
                          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold transition-all duration-300 cursor-pointer outline-none ${
                            post.is_liked_by_you 
                              ? 'bg-[#13ec37]/10 text-[#13ec37] shadow-[0_2px_8px_rgba(239,75,83,0.15)] border border-transparent' 
                              : 'bg-white border border-[#e8ede8] text-[#64748b] hover:bg-gray-50'
                          }`}
                        >
                          <div className="relative flex items-center justify-center w-5 h-5">
                            <FavoriteIcon 
                              fontSize="small" 
                              className={`absolute bounce-transition ${post.is_liked_by_you ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} 
                            />
                            <FavoriteBorderIcon 
                              fontSize="small" 
                              className={`absolute bounce-transition ${post.is_liked_by_you ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`} 
                              sx={{color: "#13ec37"}}
                            />
                          </div>
                          <span>{post.likes_count || 0}</span>
                        </button>
                      </div>
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
                    
                    {r.avatar_url ? (
                      <img
                        src={resolveApiAssetUrl(r.avatar_url) ?? ""}
                        alt={r.user_name || "User"}
                        className={`w-12 h-12 rounded-full object-cover shrink-0 ${
                          isYou ? 'border-[2px] border-[#13ec37]' : 'border-[2px] border-[#e8ede8]'
                        }`}
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-bold shrink-0 ${
                        isYou ? 'border-[2px] border-[#13ec37] bg-[#13ec37]/10 text-[#0fbf2c]' : 'border-[2px] border-[#e8ede8] bg-[#f1f5f9] text-[#64748b]'
                      }`}>
                        {r.user_name?.[0] || "U"}
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-end mb-1.5">
                        <div className={`flex items-center text-[14px] font-bold ${isYou ? 'text-[#0fbf2c]' : 'text-[#0f1f10]'}`}>
                          {r.user_name}
                          {isYou && <StarsIcon sx={{ fontSize: 16, ml: 0.5 }} />}
                        </div>
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