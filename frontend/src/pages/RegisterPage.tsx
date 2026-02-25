import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../lib/api";

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: () => {
      setMessage("認証メールを送信しました。メール内のリンクをクリックして登録を完了してください。");
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || "登録に失敗しました。入力内容を確認してください。");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ email, name, password });
  };

  return (
    <section className="page flex flex-col justify-center min-h-[80vh]">
      <div className="card text-center">
        <h2 className="font-medium text-2xl mb-6">新規登録</h2>
        
        {message ? (
          <div className="p-4 bg-green-100 text-green-800 rounded-lg">{message}</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="ユーザー名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "登録中..." : "登録してメールを送信"}
            </button>
          </form>
        )}
        <div className="mt-6 flex flex-col gap-4 text-sm">
          <Link to="/login" className="text-gray-500 underline">すでにアカウントをお持ちの方はこちら</Link>
          <Link to="/tokushoho" className="text-gray-400 text-xs hover:text-gray-600 transition-colors">特定商取引法に基づく表記</Link>
        </div>
      </div>
    </section>
  );
}