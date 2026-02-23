import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      navigate("/");
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || "ログインに失敗しました。メールアドレスとパスワードを確認してください。");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <section className="page flex flex-col justify-center min-h-[80vh]">
      <div className="card text-center">
        <h2 className="font-medium text-2xl mb-6">ログイン</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <button type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <div className="mt-6 text-sm">
          <Link to="/register" className="text-gray-500 underline">新規登録はこちら</Link>
        </div>
      </div>
    </section>
  );
}