import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPost, fetchPosts, fetchRanking } from "../lib/api";

export function SharePage() {
  const [tab, setTab] = useState<"feed" | "rank">("feed");
  const [comment, setComment] = useState("");
  const [achieved, setAchieved] = useState("0.8");
  const queryClient = useQueryClient();
  const posts = useQuery({ queryKey: ["posts"], queryFn: fetchPosts });
  const ranking = useQuery({ queryKey: ["ranking"], queryFn: fetchRanking });

  const createMutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  return (
    <section className="page">
      <div className="tabRow">
        <button className={tab === "feed" ? "tabBtn active" : "tabBtn"} onClick={() => setTab("feed")}>
          Feed
        </button>
        <button className={tab === "rank" ? "tabBtn active" : "tabBtn"} onClick={() => setTab("rank")}>
          Ranking
        </button>
      </div>

      <div className="card">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="今日やったこと"
        />
        <input
          type="number"
          min="0"
          max="1"
          step="0.1"
          value={achieved}
          onChange={(e) => setAchieved(e.target.value)}
        />
        <button
          onClick={() => createMutation.mutate({ comment, achieved: Number(achieved) })}
          disabled={!comment}
        >
          投稿する
        </button>
      </div>

      {tab === "feed" ? (
        <div className="card">
          <h3>投稿フィード</h3>
          {posts.data?.map((post) => (
            <div key={post.id} className="taskRow">
              <p>{post.comment}</p>
              <small>{(post.achieved * 100).toFixed(0)}%</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <h3>ランキング</h3>
          {ranking.data?.map((item, i) => (
            <div key={item.user_id} className="rankRow">
              <span>#{i + 1}</span>
              <span>{item.user_name}</span>
              <strong>{(item.achieved_avg * 100).toFixed(1)}%</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
