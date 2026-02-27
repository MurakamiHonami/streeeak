import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api";

export function FriendsDialogContent() {
  const [email, setEmail] = useState("");
  const queryClient = useQueryClient();

  const search = useMutation({
    mutationFn: async (emailStr: string) => {
      const res = await apiClient.get(`/friendships/search?email=${emailStr}`);
      return res.data;
    },
    onError: () => alert("ユーザーが見つかりませんでした。"),
  });

  const add = useMutation({
    mutationFn: async (friendId: number) => {
      const res = await apiClient.post("/friendships", { friend_id: friendId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      alert("フレンド申請を送信しました！");
      setEmail("");
      search.reset();
    },
    onError: (err: any) => alert(err.response?.data?.detail || "申請に失敗しました。"),
  });

  const accept = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiClient.put(`/friendships/${requestId}/accept`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    },
  });

  const friends = useQuery({ 
    queryKey: ["friends"], 
    queryFn: async () => {
      const res = await apiClient.get("/friendships");
      return res.data;
    }
  });

  const requests = useQuery({
    queryKey: ["friendRequests"],
    queryFn: async () => {
      const res = await apiClient.get("/friendships/requests");
      return res.data;
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <input 
          type="email" 
          placeholder="friend@example.com" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 p-3 border border-gray-200 rounded-xl focus:border-black outline-none transition-all"
        />
        <button 
          onClick={() => search.mutate(email)}
          disabled={!email || search.isPending}
          className="bg-black text-white px-5 rounded-xl font-bold disabled:bg-gray-300"
        >
          Search
        </button>
      </div>

      {search.isSuccess && search.data && (
        <div className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center border border-dashed border-gray-300 animate-in fade-in slide-in-from-top-2">
          <div>
            <p className="font-bold">{search.data.name}</p>
            <p className="text-xs text-gray-500">{search.data.email}</p>
          </div>
          <button 
            onClick={() => add.mutate(search.data.id)}
            disabled={add.isPending}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold hover:scale-105 transition-transform"
          >
            Request
          </button>
        </div>
      )}

      {requests.data && requests.data.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-gray-900 m-0">フレンド申請</h4>
            <span className="bg-[#13ec37] text-black text-xs font-bold px-2 py-0.5 rounded-full">
              {requests.data.length}
            </span>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {requests.data.map((req: any) => (
              <div key={req.id} className="flex justify-between items-center p-3 border border-[#13ec37]/30 rounded-xl bg-[#13ec37]/5 transition-all hover:bg-[#13ec37]/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#13ec37] text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                    {req.name[0].toUpperCase()}
                  </div>
                  <p className="text-sm font-bold text-gray-900">{req.name}</p>
                </div>
                <button
                  onClick={() => accept.mutate(req.id)}
                  disabled={accept.isPending}
                  className="bg-[#13ec37] text-black px-4 py-1.5 rounded-lg text-xs font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  承認
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Current Friends</h4>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {friends.data?.map((f: any) => (
            <div key={f.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-white hover:border-gray-200 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {f.name[0].toUpperCase()}
                </div>
                <p className="text-sm font-medium">{f.name}</p>
              </div>
              {f.status === "pending" && (
                <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-md">
                  申請中
                </span>
              )}
            </div>
          ))}
          {friends.data?.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4 italic">No friends added yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}