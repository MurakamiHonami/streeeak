import { useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { clearAuthSession, getAuthSession, isAuthenticated } from "./lib/api";
import { AuthPage } from "./pages/AuthPage";
import { GoalsPage } from "./pages/GoalsPage";
import { HomePage } from "./pages/HomePage";
import { LandingPage } from "./pages/LandingPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SharePage } from "./pages/SharePage";
import { Tokushoho } from "./pages/Tokushoho";

import { Settings } from "./components/Settings";
import SettingsIcon from '@mui/icons-material/Settings';
import IconButton from '@mui/material/IconButton';

function FeatureLockedPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const navigate = useNavigate();

  return (
    <section className="page">
      <div className="card" style={{ display: "grid", gap: 16, textAlign: "center" }}>
        <p className="chip">Members Only</p>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p className="mutedText" style={{ margin: 0 }}>
          {description}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="goalCreateBtn" onClick={() => navigate("/auth/login")}>
            ログインする
          </button>
          <button
            type="button"
            className="goalCreateBtn"
            style={{ background: "#f8faf8", color: "#0f1f10", border: "1px solid #d8e4d8" }}
            onClick={() => navigate("/auth/register")}
          >
            新規登録
          </button>
        </div>
      </div>
    </section>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const [currentUserId, setCurrentUserId] = useState<number | null>(() => getAuthSession()?.userId ?? null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const authenticated = isAuthenticated();

  const navOrder = ["/", "/goals", "/results", "/share"];
  const getPathRank = (path: string) => {
    const idx = navOrder.indexOf(path);
    return idx >= 0 ? idx : 0;
  };
  const previousRank = getPathRank(previousPathRef.current);
  const currentRank = getPathRank(location.pathname);
  const routeDirectionClass =
    currentRank > previousRank
      ? "routeTransitionForward"
      : currentRank < previousRank
      ? "routeTransitionBackward"
      : "routeTransitionNeutral";

  useEffect(() => {
    previousPathRef.current = location.pathname;
  }, [location.pathname]);

  if (location.pathname === "/lp") {
    return (
      <Routes>
        <Route path="/lp" element={<LandingPage />} />
      </Routes>
    );
  }

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUserId(null);
    setIsSettingsOpen(false);
    navigate("/goals");
  };

  return (
    <div className="appShell gamifiedApp">
      <div className="appContainer">
        <header className={authenticated ? "topHeader" : "topHeader authHeader"}>
          <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
            <img src="/sasa.png" className="sasa" alt="Streeeak mascot" />
            <div className="brandText">
              <h1 className="headerTitle" onClick={() => navigate(authenticated ? "/" : "/goals")} style={{cursor: "pointer"}}>
                Str<span className="text-[#13ec37] drop-shadow-sm">eee</span>ak
              </h1>
            </div>
          </div>
          {authenticated ? (
            <>
              <IconButton 
                onClick={() => setIsSettingsOpen(true)}
                sx={{
                  width: { xs: 52, sm: 56, md: 64 },
                  height: { xs: 52, sm: 56, md: 64 },
                  bgcolor: '#eafbe9',
                  border: { xs: '2px solid #bbf2c4', md: '3px solid #bbf2c4' },
                  color: '#0f1f10',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    bgcolor: '#d1f5d8',
                    borderColor: '#13ec37',
                    transform: 'scale(1.05)'
                  }
                }}
              >
                <SettingsIcon sx={{ fontSize: { xs: 28, sm: 32, md: 36 }, color: '#13ec37' }}/>
              </IconButton>
              <Settings 
                open={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                onLogout={handleLogout} 
              />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/auth/login")}
                style={{ background: "#f8faf8", color: "#0f1f10", border: "1px solid #d8e4d8", width: "auto", margin: 0, padding: "10px 16px" }}
              >
                ログイン
              </button>
              <button
                type="button"
                onClick={() => navigate("/auth/register")}
                className="bg-[#13ec37]/30 hover:bg-[#13ec37] focus:ring-4 focus:ring-[#13ec37]/50 font-medium rounded-lg text-md text-[#0f1f10] px-5 py-2.5 text-center border border-4 border-[#13ec37] hover:border-[#13ec37] transition-colors duration-300"
              >
                新規登録
              </button>
            </div>
          )}
        </header>

        <div className={`routeTransition ${routeDirectionClass}`} key={location.pathname}>
          <Routes>
            <Route path="/tokushoho" element={<Tokushoho />} />
            <Route path="/auth/login" element={<AuthPage initialMode="login" onAuthenticated={(userId) => { setCurrentUserId(userId); navigate("/"); }} />} />
            <Route path="/auth/register" element={<AuthPage initialMode="register" onAuthenticated={(userId) => { setCurrentUserId(userId); navigate("/"); }} />} />

            {authenticated ? (
              <>
                <Route path="/" element={<HomePage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/share" element={<SharePage />} />
                <Route path="*" element={<HomePage />} />
              </>
            ) : (
              <>
                <Route path="/" element={<HomePage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route
                  path="/results"
                  element={
                    <FeatureLockedPage
                      title="STATS はログイン後に利用できます"
                      description="進捗の振り返りや記録の可視化は、アカウントに紐づけて保存します。"
                    />
                  }
                />
                <Route
                  path="/share"
                  element={
                    <FeatureLockedPage
                      title="ソーシャル機能はログイン後に利用できます"
                      description="ランキング、投稿、フレンド機能はログインしたユーザー向けに開放しています。"
                    />
                  }
                />
                <Route path="*" element={<GoalsPage />} />
              </>
            )}
          </Routes>
        </div>
      </div>
      <NavBar /> 
    </div>
  );
}

export default App;
