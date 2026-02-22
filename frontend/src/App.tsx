import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { GoalsPage } from "./pages/GoalsPage";
import { HomePage } from "./pages/HomePage";
import { ResultsPage } from "./pages/ResultsPage";
import { SharePage } from "./pages/SharePage";

function App() {
  const dateStr = new Date().toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="appShell">
      <div className="appContainer">
        <header className="topHeader">
          <div>
            <p className="headerDate">{dateStr}</p>
            <h1 className="headerTitle">Streeeak</h1>
          </div>
          <div className="headerAvatar">あ</div>
        </header>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/share" element={<SharePage />} />
        </Routes>
      </div>
      <NavBar />
    </div>
  );
}

export default App;
