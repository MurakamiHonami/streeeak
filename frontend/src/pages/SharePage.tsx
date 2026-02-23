import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchPosts, fetchRanking, getAuthSession } from "../lib/api";
import { Dialog, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { FriendsDialogContent } from "../components/FriendDialogContent";

export function SharePage() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!getAuthSession()) {
      navigate("/login");
    }
  }, [navigate]);

  const posts = useQuery({ queryKey: ["posts"], queryFn: fetchPosts });
  const ranking = useQuery({ queryKey: ["ranking"], queryFn: fetchRanking });

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

      <div className="space-y-6">
        <div className="card">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Live Feed</h3>
          {posts.data?.map((post) => (
            <div key={post.id} className="taskRow border-b border-gray-50 last:border-0 py-4">
              <div className="flex justify-between items-center">
                <p className="font-medium text-gray-800">{post.comment}</p>
                <span className="text-xl font-black italic">{(post.achieved * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}