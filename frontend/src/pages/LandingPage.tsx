import { useNavigate } from "react-router-dom";
import { getAuthSession } from "../lib/api";

export function LandingPage() {
  const navigate = useNavigate();

  const handleStartFree = () => {
    console.log("[LP] 「無料で始める」クリック - query:", window.location.search);
    const session = getAuthSession();
    if (session) {
      navigate("/");
    } else {
      navigate("/auth/register");
    }
  };

  const handleLogin = () => {
    console.log("[LP] 「ログイン」クリック - query:", window.location.search);
    navigate("/auth/login");
  };

  return (
    <div className="lp-root">
      {/* Sticky Nav */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <span className="lp-nav-logo">
            Str<span className="lp-green">eee</span>ak
          </span>
          <div className="lp-nav-actions">
            <button className="lp-btn-ghost" onClick={handleLogin}>
              ログイン
            </button>
            <button className="lp-btn-green" onClick={handleStartFree}>
              無料で始める
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <p className="lp-eyebrow">習慣管理アプリ</p>
          <h1 className="lp-hero-title">
            毎日の積み重ねが、<br />
            <span className="lp-green">あなたを変える。</span>
          </h1>
          <p className="lp-hero-sub">
            目標を立て、タスクを刻み、仲間と競い合う。<br />
            Streeeak で、習慣の力を手に入れよう。
          </p>
          <div className="lp-hero-cta">
            <button className="lp-btn-green lp-btn-lg" onClick={handleStartFree}>
              無料で始める
            </button>
            <button className="lp-btn-outline lp-btn-lg" onClick={handleLogin}>
              ログイン
            </button>
          </div>
        </div>
        <div className="lp-hero-badge">🔥 ストリーク継続中</div>
      </section>

      {/* Features Section */}
      <section className="lp-features">
        <div className="lp-section-inner">
          <h2 className="lp-section-title">なぜ Streeeak なのか</h2>
          <div className="lp-feature-grid">
            <div className="lp-feature-card">
              <div className="lp-feature-icon">🎯</div>
              <h3>目標を構造化</h3>
              <p>月・週・日のタスクに分解して、確実に目標へ近づく。</p>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon">🔥</div>
              <h3>ストリークで継続</h3>
              <p>毎日の達成で連続記録を伸ばし、習慣を維持する。</p>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon">🏆</div>
              <h3>仲間と競い合う</h3>
              <p>友達と達成率をランキングで競い、モチベーションを高める。</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="lp-stats">
        <div className="lp-section-inner">
          <div className="lp-stat-grid">
            <div className="lp-stat-item">
              <div className="lp-stat-num">
                87<span className="lp-green">%</span>
              </div>
              <div className="lp-stat-label">ユーザーが3週間以上継続</div>
            </div>
            <div className="lp-stat-item">
              <div className="lp-stat-num">
                3<span className="lp-green">x</span>
              </div>
              <div className="lp-stat-label">目標達成率が向上</div>
            </div>
            <div className="lp-stat-item">
              <div className="lp-stat-num">∞</div>
              <div className="lp-stat-label">可能性は無限大</div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="lp-cta-section">
        <div className="lp-section-inner">
          <h2 className="lp-cta-title">今すぐ、始めよう。</h2>
          <p className="lp-cta-sub">無料で使えます。クレジットカード不要。</p>
          <button className="lp-btn-green lp-btn-xl" onClick={handleStartFree}>
            無料で始める →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span className="lp-nav-logo lp-footer-logo">
            Str<span className="lp-green">eee</span>ak
          </span>
          <p>© 2025 Streeeak. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
