import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPost, fetchPosts, fetchRanking, getAuthSession } from "../lib/api";
import { Dialog, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { FriendsDialogContent } from "../components/FriendDialogContent";

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
    <section className="page">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black tracking-tighter">COMMUNITY</h2>
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="flex items-center gap-2 bg-black text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-gray-800 transition-all active:scale-95"
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
        PaperProps={{ sx: { borderRadius: '24px', border: '1px solid #eee' } }}
      >
        <div className="flex justify-between items-center px-6 pt-6">
          <h3 className="text-xl font-bold">Find Friends</h3>
          <IconButton onClick={() => setIsDialogOpen(false)}><CloseIcon /></IconButton>
        </div>
        <DialogContent sx={{ px: 3, pb: 4 }}>
          <FriendsDialogContent />
        </DialogContent>
      </Dialog>

      <div className="tabRow mb-6">
        <button className={tab === "feed" ? "tabBtn active" : "tabBtn"} onClick={() => setTab("feed")}>
          Feed
        </button>
        <button className={tab === "rank" ? "tabBtn active" : "tabBtn"} onClick={() => setTab("rank")}>
          Ranking
        </button>
      </div>

      <div className="space-y-6">
        {tab === "feed" ? (
          <>
            <div className="card flex flex-col gap-3">
              <input
                className="p-3 border border-gray-200 rounded-lg w-full outline-none focus:border-black transition-colors"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="今日やったこと"
              />
              <div className="flex gap-3 items-center">
                <label className="text-sm font-bold text-gray-500">達成率:</label>
                <input
                  className="p-2 border border-gray-200 rounded-lg w-20 outline-none focus:border-black transition-colors"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={achieved}
                  onChange={(e) => setAchieved(e.target.value)}
                />
                <button
                  className="ml-auto bg-black text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-gray-800 disabled:opacity-30 transition-all"
                  onClick={() => createMutation.mutate({ comment, achieved: Number(achieved) })}
                  disabled={!comment || createMutation.isPending}
                >
                  {createMutation.isPending ? "投稿中..." : "投稿する"}
                </button>
              </div>
            </div>

            <div className="card">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Live Feed</h3>
              {posts.data?.length ? (
                posts.data.map((post) => (
                  <div key={post.id} className="taskRow border-b border-gray-50 last:border-0 py-4">
                    <div className="flex justify-between items-center w-full">
                      <p className="font-medium text-gray-800">{post.comment}</p>
                      <span className="text-xl font-black italic">{(post.achieved * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm">まだ投稿がありません。</p>
              )}
            </div>
          </>
        ) : (
          <div className="card">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Ranking (FRIENDS)</h3>
            {ranking.data?.length ? (
              ranking.data.map((item, i) => (
                <div key={item.user_id} className="rankRow flex justify-between items-center border-b border-gray-50 last:border-0 py-4">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-400">#{i + 1}</span>
                    <span className="font-medium">{item.user_name}</span>
                  </div>
                  <strong className="text-xl font-black italic">{(item.achieved_avg * 100).toFixed(1)}%</strong>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">ランキングデータがありません。</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}