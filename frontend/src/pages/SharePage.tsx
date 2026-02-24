import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPost, fetchPosts, fetchRanking, getAuthSession, appContext } from "../lib/api";
import { Dialog, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { FriendsDialogContent } from "../components/FriendsDialogContent";
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import ArrowCircleLeftIcon from '@mui/icons-material/ArrowCircleLeft';

export function SharePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tab, setTab] = useState<"feed" | "rank">("feed");
  const [comment, setComment] = useState("");
  const [achieved, setAchieved] = useState("0.8");

  useEffect(() => {
    if (!getAuthSession()) {
      navigate("/login");
    }
  }, [navigate]);

  const posts = useQuery({ queryKey: ["posts"], queryFn: fetchPosts });
  const ranking = useQuery({ queryKey: ["ranking", "social"], queryFn: () => fetchRanking(50) });

  const createMutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  return (
    <section className="page font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-[24px] font-extrabold m-0 tracking-[-0.02em] text-[#0f1f10]">COMMUNITY</h2>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 bg-[#13ec37] text-[#0f1f10] px-4 py-2 rounded-full text-[13px] font-bold shadow-[0_4px_16px_rgba(19,236,55,0.25)] border-none transition-transform active:scale-95 cursor-pointer"
        >
          <PersonAddIcon fontSize="small" />
          Add Friends
        </button>
      </div>

      <Dialog 
        open={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: '24px', border: '1px solid #e8ede8', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' } }}
      >
        <div className="flex justify-between items-center px-6 pt-6 pb-2">
          <h3 className="text-xl font-extrabold m-0 text-[#0f1f10]">Find Friends</h3>
          <IconButton onClick={() => setIsDialogOpen(false)}><CloseIcon /></IconButton>
        </div>
        <DialogContent sx={{ px: 3, pb: 4 }}>
          <FriendsDialogContent />
        </DialogContent>
      </Dialog>

      <div className="flex gap-2 mb-5">
        <button 
          className={`flex-1 py-3 rounded-xl font-bold text-[13px] border transition-colors cursor-pointer ${
            tab === "feed" 
              ? "bg-[#13ec37]/10 border-[#13ec37]/30 text-[#0fbf2c]" 
              : "bg-white border-[#e8ede8] text-[#64748b]"
          }`}
          onClick={() => setTab("feed")}
        >
          <ViewTimelineIcon/> Feed
        </button>
        <button 
          className={`flex-1 py-3 rounded-xl font-bold text-[13px] border transition-colors cursor-pointer ${
            tab === "rank" 
              ? "bg-[#13ec37]/10 border-[#13ec37]/30 text-[#0fbf2c]" 
              : "bg-white border-[#e8ede8] text-[#64748b]"
          }`}
          onClick={() => setTab("rank")}
        >
          <MilitaryTechIcon/> Ranking
        </button>
      </div>

      <div className="grid gap-5">
        {tab === "feed" ? (
          <>
            <div className="bg-white rounded-[20px] border border-[#e8ede8] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.05)] grid gap-3">
              <input
                className="w-full bg-[#f6f8f6] border border-[#e8ede8] rounded-xl p-3 text-[#0f1f10] text-[14px] outline-none box-border resize-none font-['Plus_Jakarta_Sans',sans-serif]"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="今日やったこと"
              />
              <div className="flex gap-3 items-center">
                <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-[0.08em]">ACHIEVED:</label>
                <input
                  className="bg-[#f6f8f6] border border-[#e8ede8] rounded-lg p-2 text-[#0f1f10] text-[14px] outline-none w-20 font-bold text-center"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={achieved}
                  onChange={(e) => setAchieved(e.target.value)}
                />
                <button
                  className="ml-auto bg-[#13ec37] text-[#0f1f10] px-5 py-2.5 rounded-full text-[13px] font-bold shadow-[0_4px_16px_rgba(19,236,55,0.25)] border-none transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                  onClick={() => createMutation.mutate({ comment, achieved: Number(achieved) })}
                  disabled={!comment || createMutation.isPending}
                >
                  {createMutation.isPending ? "Posting..." : "Share"}
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
                          className={`h-full rounded-full transition-all duration-500 ${isPerfect ? 'bg-[#13ec37] shadow-[0_0_8px_rgba(19,236,55,0.4)]' : 'bg-[#fbbf24]'}`}
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
                          {r.user_name}{isYou && <ArrowCircleLeftIcon/>}
                        </span>
                      </div>
                      <div className="h-[8px] bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
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