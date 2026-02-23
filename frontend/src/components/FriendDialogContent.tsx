import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { searchUserByEmail, addFriend, fetchFriends } from "../lib/api";

export function FriendsDialogContent() {
  const [email, setEmail] = useState("");
  const queryClient = useQueryClient();

  const search = useMutation({
    mutationFn: searchUserByEmail,
    onError: () => alert("ユーザーが見つかりませんでした。"),
  });

  const add = useMutation({
    mutationFn: addFriend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      alert("フレンドを追加しました！");
    },
    onError: (err: any) => alert(err.response?.data?.detail || "追加に失敗しました。"),
  });

  const friends = useQuery({ queryKey: ["friends"], queryFn: fetchFriends });

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
            Add
          </button>
        </div>
      )}

      {/* フレンド一覧 */}
      <div>
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Current Friends</h4>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {friends.data?.map((f: any) => (
            <div key={f.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl bg-white">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">
                {f.name[0].toUpperCase()}
              </div>
              <p className="text-sm font-medium">{f.name}</p>
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