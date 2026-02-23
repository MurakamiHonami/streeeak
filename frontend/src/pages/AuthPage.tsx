import { FormEvent, useMemo, useState } from "react";
import { login, register } from "../lib/api";

type AuthMode = "login" | "register";

type Props = {
  onAuthenticated: (userId: number) => void;
};

export function AuthPage({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";
  const canSubmit = useMemo(() => {
    if (!email || !password) {
      return false;
    }
    if (isRegister && !name.trim()) {
      return false;
    }
    return true;
  }, [email, password, name, isRegister]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = isRegister
        ? await register({ email, name: name.trim(), password })
        : await login({ email, password });
      onAuthenticated(session.userId);
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail ===
          "string"
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : "認証に失敗しました。入力内容を確認してください。";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="authSection">
      <div className="authModeRow">
        <button
          type="button"
          className={mode === "login" ? "tabBtn active" : "tabBtn"}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          ログイン
        </button>
        <button
          type="button"
          className={mode === "register" ? "tabBtn active" : "tabBtn"}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          新規登録
        </button>
      </div>

      <form className="card authCard" onSubmit={handleSubmit}>
        <h3>{isRegister ? "新規ユーザー登録" : "ログイン"}</h3>
        <label className="authLabel">
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
          />
        </label>

        {isRegister && (
          <label className="authLabel">
            表示名
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="あなたの名前"
            />
          </label>
        )}

        <label className="authLabel">
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8文字以上"
          />
        </label>

        {error && <p className="authError">{error}</p>}

        <button type="submit" disabled={!canSubmit || loading}>
          {loading ? "処理中..." : isRegister ? "登録して開始" : "ログイン"}
        </button>
      </form>
    </section>
  );
}
