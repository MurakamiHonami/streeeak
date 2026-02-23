import { useState } from "react";
import { Route, Routes,useNavigate } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { clearAuthSession, getAuthSession } from "./lib/api";
import { AuthPage } from "./pages/AuthPage";
import { GoalsPage } from "./pages/GoalsPage";
import { HomePage } from "./pages/HomePage";
import { ResultsPage } from "./pages/ResultsPage";
import { SharePage } from "./pages/SharePage";

function App() {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<number | null>(() => {
    return getAuthSession()?.userId ?? null;
  });

  return (
    <div className="appShell">
      <div className="appContainer">
        <header className={currentUserId ? "topHeader" : "topHeader authHeader"}>
          <div className="brandBlock">
            <img src="/sasa.png" className="brandIcon" alt="Streeeak mascot" />
            <div className="brandText">
              <h1 className="headerTitle">
                Str<span className="e">eee</span>ak
              </h1>
            </div>
          </div>
          {currentUserId ? (
            <button
              type="button"
              className="headerAvatar logoutBtn"
              onClick={() => {
                clearAuthSession();
                setCurrentUserId(null);
              }}
            >
              ログアウト
            </button>
          ) : null}
        </header>

        {currentUserId ? (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/share" element={<SharePage />} />
          </Routes>
        ) : (
          <AuthPage onAuthenticated={(userId) => {setCurrentUserId(userId); navigate("/");}} />
        )}
      </div>
      {currentUserId ? <NavBar /> : null}
    </div>
  );
}

export default App;
