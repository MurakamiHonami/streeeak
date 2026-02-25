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

  async function handleSubmit(e: FormEvent) {
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
    <section className="page authPage">
      <div className="authContainer">
        <h1 className="gameTitle">STREEEAK</h1>
        <p className="gameSubtitle">START YOUR QUEST</p>

        <div className="tabRow authTabs">
          <button
            className={`tabBtn ${!isRegister ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            LOGIN
          </button>
          <button
            className={`tabBtn ${isRegister ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            REGISTER
          </button>
        </div>

        <form className="gameCard authCard" onSubmit={handleSubmit}>
          <div className="formGroup">
            <label className="authLabel">EMAIL</label>
            <input
              type="email"
              className="gameInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@email.com"
            />
          </div>

          {isRegister && (
            <div className="formGroup">
              <label className="authLabel">PLAYER NAME</label>
              <input
                type="text"
                className="gameInput"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
              />
            </div>
          )}

          <div className="formGroup">
            <label className="authLabel">PASSWORD</label>
            <input
              type="password"
              className="gameInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <div className="gameErrorBox">{error}</div>}

          <button className="gameBtn primaryBtn submitBtn" type="submit" disabled={!canSubmit || loading}>
            {loading ? "CONNECTING..." : isRegister ? "CREATE ACCOUNT" : "START GAME"}
          </button>
        </form>
      </div>
    </section>
  );
}