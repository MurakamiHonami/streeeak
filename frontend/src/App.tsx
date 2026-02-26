import { useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { clearAuthSession, getAuthSession } from "./lib/api";
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

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const [currentUserId, setCurrentUserId] = useState<number | null>(() => {
    return getAuthSession()?.userId ?? null;
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  // Landing page renders without app chrome (no header/navbar)
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
  };

  return (
    <div className="appShell gamifiedApp">
      <div className="appContainer">
        <header className={currentUserId ? "topHeader" : "topHeader authHeader"}>
          <div className="flex items-center gap-2">
            <img src="/sasa.png" className="sasa" alt="Streeeak mascot" />
            <div className="brandText">
              <h1 className="headerTitle" onClick={() => navigate("/")} style={{cursor: "pointer"}}>
                Str<span className="text-[#13ec37]">eee</span>ak
              </h1>
            </div>
          </div>
          {currentUserId ? (
            <>
              <IconButton 
                onClick={() => setIsSettingsOpen(true)}
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: '#eafbe9',
                  border: '2px solid #bbf2c4',
                  color: '#0f1f10',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    bgcolor: '#d1f5d8',
                    borderColor: '#13ec37',
                    transform: 'scale(1.05)'
                  }
                }}
              >
                <SettingsIcon fontSize="medium" sx={{color: '#13ec37'}}/>
              </IconButton>
              <Settings 
                open={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                onLogout={handleLogout} 
              />
            </>
          ) : null}
        </header>

        <div className={`routeTransition ${routeDirectionClass}`} key={location.pathname}>
          <Routes>
            <Route path="/tokushoho" element={<Tokushoho />} />

            {currentUserId ? (
              <>
                <Route path="/" element={<HomePage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/share" element={<SharePage />} />
                <Route path="*" element={<HomePage />} />
              </>
            ) : (
              <>
                <Route path="/auth/login" element={<AuthPage initialMode="login" onAuthenticated={(userId) => { setCurrentUserId(userId); navigate("/"); }} />} />
                <Route path="/auth/register" element={<AuthPage initialMode="register" onAuthenticated={(userId) => { setCurrentUserId(userId); navigate("/"); }} />} />
                <Route path="*" element={<AuthPage onAuthenticated={(userId) => { setCurrentUserId(userId); navigate("/"); }} />} />
              </>
            )}
          </Routes>
        </div>
      </div>
      {currentUserId ? <NavBar /> : null}
    </div>
  );
}

export default App;